# Local-first Docs

A **local-first, collaborative document editor** with offline sync, deterministic conflict
resolution, and version history. The browser's IndexedDB is the source of truth — you can open, edit,
and close documents with **zero network blocking the UI**; changes reconcile automatically on
reconnect and merge **without data loss**.

Built for the House of EdTech full-stack assignment. Live demo + repo links are in the app footer.

## Highlights

- **Local-first** — every edit is written to IndexedDB (Dexie) and the in-memory CRDT first; the
  network is never on the critical path. Edits survive a full reload offline.
- **Rich-text editing** — a **Tiptap** (ProseMirror) editor bound directly to the Yjs document via the
  Collaboration extension: headings, bold/italic, lists, quotes and code blocks all merge as CRDT
  operations, with Yjs-aware undo that never rolls back collaborators' work.
- **Background sync engine** — an offline queue of changes is pushed on reconnect and remote changes
  are pulled, with a coalesced push-then-pull cycle that never clobbers offline work.
- **Deterministic conflict resolution** — content is a **Yjs CRDT**; concurrent offline edits from
  multiple clients converge to identical state with no data loss (deterministic CRDT convergence).
- **Version history & time travel** — snapshot the document, browse the timeline, and **safely
  restore** an old version as a forward edit that never corrupts collaborators' shared state.
- **Auth & roles** — JWT sessions; per-document **Owner / Editor / Viewer** roles. **Viewers cannot
  push** updates — enforced both in the UI and at the database via row-level security.
- **Security** — Zod validation and payload-size caps on every server action; **PostgreSQL
  Row-Level Security** with a non-superuser role for strict tenant isolation.
- **Connection-aware UI** — global online/offline indicator and a per-document sync status.

## Tech stack

Next.js 16 (App Router + Server Actions) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
PostgreSQL + Drizzle ORM (RLS) · Yjs (CRDT) · Tiptap v3 (rich text) · Dexie (IndexedDB) · jose (JWT) · Zod.

## Architecture

Clean layers with dependencies pointing inward (`lib/*` is framework-agnostic; UI depends on `lib`):

```
app/            routes (App Router pages)
components/     small, one-per-file UI (incl. the Tiptap editor)
lib/local       IndexedDB (Dexie) — local source of truth
lib/crdt        Yjs wrapper + deterministic merge
lib/sync        offline queue + push/pull reconcile engine
lib/versions    snapshots + safe restore
lib/auth        JWT session + role guards
lib/db          Drizzle schema, migrations, RLS policies
lib/validation  Zod schemas for every payload
lib/*/actions   Server Actions — the entire client↔server API (no REST routes)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/CONFLICT_RESOLUTION.md`](docs/CONFLICT_RESOLUTION.md) for the full design.

## Local development

Prerequisites: **Node 20.9+** and **Docker** (for Postgres).

```bash
npm install
cp .env.example .env.local        # then set AUTH_SECRET: openssl rand -base64 32
npm run db:up                     # start Postgres in Docker
npm run db:migrate                # create schema, roles and RLS policies
npm run dev                       # http://localhost:3000
```

The app connects to Postgres as a **non-superuser** role (`app_user`) so RLS is actually enforced;
migrations run as the owner and create that role plus all policies.

## Quality

```bash
npm run typecheck     # tsc --noEmit (strict)
npm run build         # production build
```

TypeScript strict throughout; the key scenarios — offline persistence, reconnect reconciliation,
two-client conflict merge, version restore, and viewer-blocked-from-pushing — were verified during
development. The security-critical core (RLS, sync, auth, CRDT) was hardened by an adversarial review.

## Deployment

Deploys to **Vercel**; point `DATABASE_URL` / `MIGRATION_DATABASE_URL` at a managed Postgres (e.g.
Neon) and set `AUTH_SECRET`. CI (GitHub Actions) runs typecheck, build, and migrations against a
Postgres service on every push — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Author

**Ajay Kumar** · [GitHub](https://github.com/AjayLuhach) ·
[LinkedIn](https://www.linkedin.com/in/ajayluhach7) · [ajayluhach.in](https://ajayluhach.in/)
