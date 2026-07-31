// Shared tertiary-tier timestamp formatter. Report cards had a createdAt
// field that was fetched but never actually rendered — the tertiary/
// metadata tier the component-hierarchy skill calls for (timestamps,
// smallest, muted) was simply missing. One formatter, reused wherever a
// report's age needs to show.
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffD = diffH / 24;
  if (diffD < 7) return `${Math.floor(diffD)}d ago`;
  const diffW = diffD / 7;
  return `${Math.floor(diffW)}w ago`;
}
