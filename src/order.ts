/** Returns a copy of `list` with the item at `from` moved to index `to` (both clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(Math.min(Math.max(to, 0), out.length), 0, item);
  return out;
}

/** Returns a copy of `list` with `item` inserted at `index` (clamped; past the end appends). */
export function insertAt<T>(list: readonly T[], item: T, index: number): T[] {
  const out = list.slice();
  out.splice(Math.min(Math.max(index, 0), out.length), 0, item);
  return out;
}
