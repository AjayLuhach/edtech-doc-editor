# Conflict Resolution & Merge Design

How this editor merges concurrent, offline edits **deterministically and without data loss** — the
core distributed-systems problem in the assignment.

## Why a CRDT (Yjs), not OT or last-write-wins

- **Last-write-wins** on a whole document silently discards the loser's edits — unacceptable here
  ("merge without data loss" is an explicit requirement).
- **Operational Transformation** converges but needs a central server to transform ops against
  concurrent history in real time; it is hard to make correct offline and across reconnects.
- **CRDTs** converge by construction: concurrent operations commute, so applying the same set of
  updates in **any order** yields the **same state**. That is exactly the guarantee we need for an
  offline-first app where clients reconnect in arbitrary order. We use **Yjs**, a mature text CRDT,
  wrapped behind [`lib/crdt`](../lib/crdt) so the rest of the app never imports `yjs` directly.

## The model: an append-only update log

A document's content is a `Y.Doc` (body text in a `Y.Text`, title in a `Y.Map`). Every edit produces
a small binary **Yjs update**. We never store "the current text" as the source of truth — we store the
**log of updates**:

- **Client** (`lib/local`, IndexedDB via Dexie): every update is appended to a local `updates` table.
  The document is rebuilt on load by `Y.mergeUpdates(allUpdates)` → `applyUpdate`. This is the
  local-first source of truth and works with zero network.
- **Server** (`document_updates` table): an append-only log with a monotonic `seq` (bigserial) that
  defines a **total order** used purely as a sync cursor. The server **never transforms or discards**
  an update — it only appends and serves them back. There is no "overwrite," so an old client can
  never clobber newer work.

Because the server only ever appends, and Yjs merges are order-independent, **a slow or offline
client reconnecting cannot destroy edits made by others** — its updates are added to the union.

## Reconciliation: push-then-pull

One sync cycle ([`lib/sync/engine.ts`](../lib/sync/engine.ts)):

1. **Push** the offline queue — local updates with `synced = 0`. On success they are marked
   `synced = 1`. They are *kept* locally (still part of the document), only re-flagged.
2. **Pull** updates with `seq > lastServerSeq`, apply them to the live `Y.Doc`, and advance the
   cursor.

Pull deliberately runs from the *old* cursor, so it re-fetches the client's own just-pushed updates.
This is safe and intentional: **Yjs is idempotent** — applying an update already present is a no-op
that emits no change event — so re-applying our own work costs a little bandwidth but cannot corrupt
or duplicate state. This keeps the cursor logic trivial and correct even when other clients interleave
updates between our push and pull.

Sync is triggered by: local edits (debounced), the browser `online` event (reconnect), and a poll
interval (REST has no server push). Overlapping triggers are **coalesced** so only one cycle runs at a
time, with a single follow-up if work arrived mid-cycle.

## No data loss — why it holds

Two clients editing the same document offline:

```
base:        "BASE"
client A →   insert "AAA " at 0   ⇒  "AAA BASE"   (queued offline)
client B →   insert " BBB" at end ⇒  "BASE BBB"   (queued offline)
reconnect →  both push; both pull the other's update
result:      "AAA BASE BBB"  on BOTH clients
```

Both edits survive and both clients converge to **byte-identical** state, regardless of who reconnects
first. This is proven two ways:

- **Unit** ([`tests/unit/crdt.test.ts`](../tests/unit/crdt.test.ts)) — applies the two divergent
  updates in both orders and asserts identical output plus both edits present (determinism + no loss).
- **End-to-end** ([`tests/conflict.spec.ts`](../tests/conflict.spec.ts)) — two real browser contexts
  edit offline, reconnect, and must converge with nothing lost.

## Safe version restore

Restoring an old version must **not** rewind CRDT history — deleting operations would diverge from
collaborators who still have them and corrupt the shared state. Instead, restore is a **forward edit**
([`lib/versions/snapshot.ts`](../lib/versions/snapshot.ts)): we load the snapshot into a temporary
doc, read its target text/title, and apply the minimal diff that transforms the *current* content into
the target. That produces an ordinary update which merges and syncs to everyone — restore is just
another edit, so convergence and the no-loss guarantee still hold.

## Document state growth over time

An append-only log grows unboundedly. The schema carries `documents.compacted_state` /
`compacted_seq` for **compaction**: periodically `Y.mergeUpdates` the oldest updates into a single
compacted state and drop the originals, bounding storage while preserving content (a merged update is
equivalent to replaying each one — also asserted in the unit test). Snapshots double as natural
compaction checkpoints. Pull returns the compacted base to any client behind the compaction point,
then the newer updates — so catch-up stays correct and cheap.

## Tagging & persistence rules

Update origin (`lib/crdt/origins.ts`) drives persistence so convergence is never broken:

| Origin    | Source                     | Persisted as | Pushed? |
|-----------|----------------------------|--------------|---------|
| `user`    | local keystroke            | `synced = 0` | yes     |
| `restore` | version restore (forward)  | `synced = 0` | yes     |
| `remote`  | pulled from server         | `synced = 1` | no      |
| `load`    | replay of stored updates   | not re-saved | no      |

This prevents two failure modes: pushing a remote update back to the server (loops), and forgetting to
push a local/restore edit (lost work).
