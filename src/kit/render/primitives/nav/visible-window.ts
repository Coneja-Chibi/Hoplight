/**
 * Keep a bounded slice centered around an active row. Terminal list shells use the returned start
 * offset to preserve global selection identity while rendering only rows that fit on screen.
 */

export interface VisibleWindow<T> {
  readonly items: readonly T[];
  readonly start: number;
}

export const visibleWindow = <T>(
  items: readonly T[],
  activeIndex: number,
  requestedLimit: number,
): VisibleWindow<T> => {
  const limit = Math.max(1, Math.floor(requestedLimit));
  if (items.length <= limit) return { items, start: 0 };
  const active = Math.max(0, Math.min(items.length - 1, activeIndex));
  const start = Math.max(0, Math.min(items.length - limit, active - Math.floor(limit / 2)));
  return { items: items.slice(start, start + limit), start };
};
