# edtech-doc-editor

House of EdTech — Full-Stack Developer assignment (v2.1).
**Task:** a Local-First, Collaborative Document Editor with offline sync,
deterministic conflict resolution, and version history / time-travel.

📄 Full brief + original docs: **[docs/BRIEF.md](docs/BRIEF.md)** (JD + assignment PDFs alongside it).

## Deadline & submission
- **Due: 1 Jul 2026, 2:00 PM** (Natnetra). Tight — consider asking for an extension.
- Submit: GitHub repo + **live deployment** → https://forms.gle/wVMiwrTcCeKZzHUb6
- Put **name / GitHub / LinkedIn in the app footer**.

## Mandatory stack
Next.js 16 (App Router) · React · TypeScript · Tailwind · PostgreSQL · Git.
Good-to-have: AI (AI-SDK / OpenAI / Gemini / Groq).

## What's graded (build for these)
1. **Local-first store** = source of truth (open/edit/close with zero network blocking).
2. **Background sync engine** — push local + pull remote on reconnect, never clobber offline edits.
3. **Deterministic conflict resolution** — merge without data loss.
4. **Version history + safe restore** (don't corrupt others' shared state).
5. **Auth + roles** Owner/Editor/Viewer — Viewers can't push updates.
6. **Security** — validate sync payloads, prevent OOM from malformed payloads, Postgres RLS / tenant isolation.
7. **UI** — responsive, accessible, **real-time connection-status indicator**, no typing lag.
8. **Deploy + CI/CD** (Vercel).

## Suggested MVP order (if time-boxed)
local-first editor (IndexedDB) → offline change queue → sync push/pull on reconnect →
deterministic merge → version snapshot/restore → auth + Owner/Editor/Viewer gating →
payload validation/RLS → connection-status UI → deploy → (AI add-on if time).

---
*Scaffolding to be done in a fresh session.*
