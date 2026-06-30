# Architecture

A local-first, collaborative document editor: the browser is the source of truth, the network is never
on the critical path, and concurrent offline edits merge deterministically without data loss.
This document explains the design; merge specifics are in
[CONFLICT_RESOLUTION.md](./CONFLICT_RESOLUTION.md).

## Principles

- **Local-first.** Reads/writes hit IndexedDB and the in-memory CRDT first; sync happens in the
  background. Open / edit / close never blocks on the network.
- **Architecture first.** Clean layers with dependencies pointing inward — `lib/*` is
  framework-agnostic and the UI depends on it, never the reverse.
- **Fail closed.** Security is enforced at the database (Postgres RLS), not just the app layer.
- **Small files, one responsibility each.**

## Layers

```
app/                routes + REST route handlers (api)         ← depends on lib + components
components/         small client/server UI components          ← depends on lib
lib/local           IndexedDB (Dexie): the local source of truth
lib/crdt            Yjs wrapper: document model + deterministic merge
lib/sync            offline queue + push / state-vector pull + compaction
lib/versions        snapshots + safe restore
lib/auth            JWT session + role helpers
lib/db              Drizzle schema, migrations, RLS policies, request-scoped tenant context
lib/validation      Zod schemas for every payload
lib/http            bounded request-body reader (DoS guard)
types/              shared types
tests/              unit (node:test) + e2e (Playwright)
```

`lib/crdt`, `lib/sync`, `lib/local` never import React or Next; the editor composes them through hooks.

## Data model (Postgres)

| Table | Purpose |
|---|---|
| `users` | accounts (email, bcrypt hash) |
| `documents` | metadata + `owner_id` + `compacted_state` / `compacted_seq` (compaction base) |
| `document_members` | per-document RBAC: `(document_id, user_id, role)` where role ∈ owner/editor/viewer |
| `document_updates` | append-only log of binary Yjs updates; `seq bigserial` gives storage order |
| `document_snapshots` | named full-state checkpoints for the version timeline |

Content is **not** stored as text — it lives in the Yjs update log, so merges are lossless and the
server never has to understand document structure.

## Local-first store

Each document is one `Y.Doc` (body in a `Y.Text`, title in a `Y.Map`). Every edit emits a binary
update that is appended to Dexie's `updates` table and, on load, the doc is rebuilt with
`Y.mergeUpdates`. Typing only touches memory + an async IndexedDB write, so there is **no client-side
lag** and edits **survive reload offline**. React state mirrors the CRDT via observers; local edits
update the textarea directly (no caret jump) while remote/restore changes refresh it.

## Sync engine

A reconcile cycle (`lib/sync/engine.ts`):

1. **Push** the offline queue (local updates with `synced = 0`) to `POST /api/docs/:id/push`, then
   mark them synced. The server bootstraps the document on first push and appends each update.
2. **Pull** via a **Yjs state-vector diff**: the client sends `encodeStateVector(doc)`, the server
   rebuilds the document from `compacted_state` + later updates and returns exactly the ops the client
   is missing. This is **gap-free by construction** — unlike a sequence-number cursor, it cannot skip
   an update that committed out of allocation order (a real concurrency race we fixed after review).

Cycles are triggered by edits (debounced), the `online` event (reconnect), and a poll interval, and
are **coalesced** so only one runs at a time. Connection state surfaces as a global online/offline
badge and a per-document sync status.

## Conflict resolution

Yjs CRDT: concurrent operations commute, so all replicas converge to identical state regardless of
reconnect order, and the append-only server log never overwrites work. Proven by a determinism unit
test and a two-client offline e2e test. Full reasoning in
[CONFLICT_RESOLUTION.md](./CONFLICT_RESOLUTION.md).

## Version history & safe restore

Snapshots store the full Yjs state with an author and label. **Restore is a forward edit**, not a
history rewind: the snapshot's content is diffed onto the live document and applied as a normal update,
so it merges and syncs to collaborators without corrupting shared state.

## Document state growth over time

The update log is append-only, so it is compacted: once a document accrues `COMPACT_THRESHOLD`
uncompacted updates, a background `after()` task merges them into `documents.compacted_state` and drops
them. Compaction runs under a row lock (serialized against pushes and other compactions) and a
`SECURITY DEFINER` function only ever advances `compacted_seq`, so a stale or concurrent compaction can
never delete an update a newer one already folded in. Pull transparently serves the compacted base plus
later updates, so catch-up stays correct and cheap as documents age.

## Roles, tenancy & security

- **Membership-based RLS is the security boundary.** The app connects to Postgres as a **non-superuser
  role (`app_user`)** so RLS is actually enforced; every request runs inside a transaction that sets
  `app.user_id` via `set_config`, and policies resolve the caller through `SECURITY DEFINER` helpers
  (`app_role_on`, `app_can_write`, …) that bypass RLS to avoid policy recursion. Unset context →
  **no rows** (fail closed).
- **Owner / Editor / Viewer.** RLS lets any member read, only editors/owners insert updates and
  snapshots, and only owners manage members or delete the document. **Viewers cannot push — enforced at
  the database**, not merely hidden in the UI (verified by an e2e test that hand-crafts a push and gets
  a 403).
- **Pre-session operations** (register, login lookup, add-collaborator-by-email) go through narrow
  `SECURITY DEFINER` functions because the caller has no readable rows yet under RLS.
- **Defense in depth:** API routes re-check the session and validate every id (`z.uuid()` + 404) to
  block IDOR; the `proxy.ts` redirect is optimistic UX only, never the security boundary.
- **Lesson encoded in the schema:** `INSERT … ON CONFLICT` evaluates RLS `WITH CHECK` against a STABLE
  function in a way that fails even valid rows, so document/member bootstrap uses DEFINER functions
  instead of upserts under RLS.

## Validation & DoS guards

Every payload is parsed with Zod (array/string caps). Bodies are read through a **bounded streaming
reader** with a hard byte budget, so a missing or forged `Content-Length` (chunked encoding) cannot
exhaust memory. Base64 decoding is wrapped so malformed input returns 400, not 500. Login runs bcrypt
against a real dummy hash on the not-found path to avoid a timing oracle for user enumeration.

## Auth

Stateless JWT (HS256 via `jose`) in an httpOnly, SameSite=Lax cookie; `getSession()` is the single,
request-cached verification point used by pages and route handlers. Passwords are bcrypt (pure-JS, so
no native build on Vercel).

## Performance

Server Components by default; the editor and stores are the only client bundles. Sync endpoints are
dynamic (uncached) — correct for a live sync API. Typing never awaits the network. The diff algorithm
applies the minimal single-region edit and is surrogate-pair-safe so emoji are never corrupted.

## Testing

- **Unit** (`node:test`): CRDT determinism, no-data-loss, compaction equivalence, surrogate safety.
- **E2E** (Playwright): offline persistence, reconnect reconciliation, two-client conflict merge,
  version restore, and viewer-blocked-from-pushing.
- A multi-agent adversarial review pass hardened the sync cursor, text diff, body limits, and auth.
- CI (GitHub Actions) runs typecheck + unit + Playwright against a Postgres service on every push.

## Tradeoffs & future work

- **REST poll, not realtime.** Sync is push/pull on an interval; a `y-websocket` / PartyKit layer for
  live cursors and presence is the natural next step (kept out of scope to nail the offline core first).
- **Title is last-writer-wins** within the CRDT map; body merges character-by-character.
- **Compaction is threshold-triggered**; a scheduled job could compact idle documents too.
