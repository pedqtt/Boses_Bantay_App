export type DateSortOrder = "newest" | "oldest";
export function sortByDate<T>(items: readonly T[], getDate: (item: T) => string, order: DateSortOrder): T[] {
  return items.map((item, index) => ({ item, index, time: Date.parse(getDate(item)) })).sort((a, b) => {
    if (!Number.isFinite(a.time)) return Number.isFinite(b.time) ? 1 : a.index - b.index;
    if (!Number.isFinite(b.time)) return -1;
    return (order === "newest" ? b.time - a.time : a.time - b.time) || a.index - b.index;
  }).map(entry => entry.item);
}
