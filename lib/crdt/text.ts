import type * as Y from "yjs";

const isHighSurrogate = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLowSurrogate = (c: number) => c >= 0xdc00 && c <= 0xdfff;

// Apply the minimal single-region insert/delete that turns ytext from `prev` into `next`.
// Boundaries are snapped to whole code points so surrogate pairs (emoji) are never split.
export function applyTextDiff(ytext: Y.Text, prev: string, next: string): void {
  if (prev === next) return;

  let start = 0;
  const min = Math.min(prev.length, next.length);
  while (start < min && prev[start] === next[start]) start++;
  // If the common prefix ended just after a high surrogate, back up so the pair stays whole.
  if (start > 0 && isHighSurrogate(prev.charCodeAt(start - 1))) start--;

  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  // If the common suffix begins on a low surrogate, pull the whole pair into the changed region.
  if (endPrev < prev.length && isLowSurrogate(prev.charCodeAt(endPrev))) {
    endPrev++;
    endNext++;
  }

  const deleteCount = endPrev - start;
  const insert = next.slice(start, endNext);
  if (deleteCount > 0) ytext.delete(start, deleteCount);
  if (insert.length > 0) ytext.insert(start, insert);
}
