/** Moves one item; priorities are then the 1-based positions in the result. */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  if (
    from < 0 ||
    from >= items.length ||
    to < 0 ||
    to >= items.length ||
    from === to
  ) {
    return [...items];
  }
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

export const MAIN_ENVELOPES = 3;

/** Envelopes shown on a wallet card: the first few by priority, the rest counted. */
export function mainEnvelopes<T extends { priority: number }>(
  envelopes: readonly T[],
): { shown: T[]; more: number } {
  const sorted = [...envelopes].sort((a, b) => a.priority - b.priority);
  return {
    shown: sorted.slice(0, MAIN_ENVELOPES),
    more: Math.max(sorted.length - MAIN_ENVELOPES, 0),
  };
}
