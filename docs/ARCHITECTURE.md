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
app/                routes (App Router pages)                  ← depends on lib + components
components/         small client/server UI components          ← depends on lib
lib/local           IndexedDB (Dexie): the local source of truth
lib/crdt            Yjs wrapper: document model + deterministic merge
lib/sync            offline queue + push / state-vector pull + compaction
lib/versions        snapshots + safe restore
lib/auth            JWT session + role helpers
lib/db              Drizzle schema, migrations, RLS policies, request-scoped tenant context
lib/validation      Zod schemas for every payload
lib/*/actions.ts    Server Actions — the whole client↔server API (no REST route handlers)
types/              shared types
```

Each domain module pairs a `"use server"` actions file (session check + validation + SQL) with a thin
client adapter (`lib/*/api.ts`) that maps its typed results onto what the hooks expect, so transport
details never leak into components. Binary Yjs payloads cross the boundary as raw `Uint8Array`s —
React's serialization handles typed arrays natively, so there is no base64 layer.

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

Each document is one `Y.Doc` (rich-text body in a `Y.XmlFragment`, title in a `Y.Map`). Every edit
emits a binary update that is appended to Dexie's `updates` table and, on load, the doc is rebuilt with
`Y.mergeUpdates`. Typing only touches memory + an async IndexedDB write, so there is **no client-side
lag** and edits **survive reload offline**.

The editor is **Tiptap (ProseMirror) bound directly to the Yjs fragment** via the Collaboration
extension: keystrokes become CRDT operations, remote updates flow back into the view without caret
jumps, and undo is Yjs-aware (undoes only your own changes, never a collaborator's). Documents created
before the rich-text editor stored the body as a `Y.Text`; on first open by an editor, a one-time
migration lifts that text into fragment paragraphs and flags the doc (`lib/crdt/richbody.ts`).

## Sync engine

A reconcile cycle (`lib/sync/engine.ts`):

1. **Push** the offline queue (local updates with `synced = 0`) through the `pushAction` server
   action, then mark them synced. The server bootstraps the document on first push and appends each
   update.
2. **Pull** via a **Yjs state-vector diff**: the client sends `encodeStateVector(doc)`, the server
   rebuilds the document from `compacted_state` + later updates and returns exactly the ops the client
   is missing. This is **gap-free by construction** — unlike a sequence-number cursor, it cannot skip
   an update that committed out of allocation order (a real concurrency race we fixed after review).

Cycles are triggered by edits (debounced), the `online` event (reconnect), and a poll interval, and
are **coalesced** so only one runs at a time. Connection state surfaces as a global online/offline
badge and a per-document sync status.

## Conflict resolution

Yjs CRDT: concurrent operations commute, so all replicas converge to identical state regardless of
reconnect order, and the append-only server log never overwrites work. Verified with two offline
clients that diverge and reconcile to byte-identical state. Full reasoning in
[CONFLICT_RESOLUTION.md](./CONFLICT_RESOLUTION.md).

## Version history & safe restore

Snapshots store the full Yjs state with an author and label. **Restore is a forward edit**, not a
history rewind: the snapshot's body nodes replace the live fragment inside one ordinary transaction,
so it merges and syncs to collaborators without corrupting shared state. Snapshots that predate the
rich-text editor are lifted from plain text into paragraphs on the fly.

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
  the database**, not merely hidden in the UI (a hand-crafted push from a Viewer is rejected with a
  403 by RLS, independent of the UI).
- **Pre-session operations** (register, login lookup, add-collaborator-by-email) go through narrow
  `SECURITY DEFINER` functions because the caller has no readable rows yet under RLS.
- **Defense in depth:** server actions are public POST endpoints, so every action re-checks the
  session and validates every id (`z.uuid()`) to block IDOR; the `proxy.ts` redirect is optimistic UX
  only, never the security boundary.
- **Lesson encoded in the schema:** `INSERT … ON CONFLICT` evaluates RLS `WITH CHECK` against a STABLE
  function in a way that fails even valid rows, so document/member bootstrap uses DEFINER functions
  instead of upserts under RLS.

## Validation & DoS guards

Every payload is parsed with Zod (byte-length caps on every `Uint8Array`, array/string caps
elsewhere), and Next's `serverActions.bodySizeLimit` bounds the raw request before it is parsed.
Errors cross the boundary as typed result codes, never thrown (production masks thrown messages).
Login runs bcrypt against a real dummy hash on the not-found path to avoid a timing oracle for user
enumeration.

## Auth

Stateless JWT (HS256 via `jose`) in an httpOnly, SameSite=Lax cookie; `getSession()` is the single,
request-cached verification point used by pages and server actions. Passwords are bcrypt (pure-JS, so
no native build on Vercel).

## Performance

Server Components by default; the editor and stores are the only client bundles. Server actions are
dynamic (uncached) — correct for a live sync API. Typing never awaits the network: ProseMirror
transactions map to minimal Yjs operations through the Collaboration binding.

## Verification

- **Behaviours verified during development:** CRDT determinism / no-data-loss, compaction equivalence,
  surrogate safety, offline persistence, reconnect reconciliation, two-client conflict merge, version
  restore, and viewer-blocked-from-pushing (including a hand-crafted push rejected by RLS with 403).
- A multi-agent adversarial review pass hardened the sync cursor, text diff, body limits, and auth.
- CI (GitHub Actions) runs typecheck + build + migrations against a Postgres service on every push.

## Tradeoffs & future work

- **Polled sync, not realtime.** Sync is push/pull on an interval; a `y-websocket` / PartyKit layer for
  live cursors and presence is the natural next step (kept out of scope to nail the offline core first).
- **Title is last-writer-wins** within the CRDT map; body merges per-character/per-node.
- **Compaction is threshold-triggered**; a scheduled job could compact idle documents too.
