import type * as Y from "yjs";

// Apply the minimal single-region insert/delete that turns ytext from `prev` into `next`.
export function applyTextDiff(ytext: Y.Text, prev: string, next: string): void {
  if (prev === next) return;
  let start = 0;
  const min = Math.min(prev.length, next.length);
  while (start < min && prev[start] === next[start]) start++;

  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }

  const deleteCount = endPrev - start;
  const insert = next.slice(start, endNext);
  if (deleteCount > 0) ytext.delete(start, deleteCount);
  if (insert.length > 0) ytext.insert(start, insert);
}
