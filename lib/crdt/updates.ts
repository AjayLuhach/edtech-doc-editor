import * as Y from "yjs";

// Thin wrapper over Yjs encoding so the rest of the app never imports yjs directly.
export function encodeState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function encodeStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}

// Updates in `doc` that the peer at `stateVector` is missing (the delta to send).
export function diffFrom(doc: Y.Doc, stateVector: Uint8Array): Uint8Array {
  return Y.encodeStateAsUpdate(doc, stateVector);
}

export function applyUpdate(doc: Y.Doc, update: Uint8Array, origin?: unknown): void {
  Y.applyUpdate(doc, update, origin);
}

// Deterministically combine many updates into one (used for load and compaction).
export function mergeUpdates(updates: Uint8Array[]): Uint8Array {
  return Y.mergeUpdates(updates);
}
