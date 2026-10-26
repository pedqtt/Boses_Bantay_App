export type NavbarScrollState = { y: number | null; travel: number };
export function advanceNavbarScroll(previous: NavbarScrollState, offset: number, maxOffset: number): {
  state: NavbarScrollState; hidden?: boolean;
} {
  // Clamp refresh/overscroll bounce so it cannot reverse the navigation state.
  const y = Math.max(0, Math.min(offset, Math.max(0, maxOffset)));
  if (y <= 12) return { state: { y, travel: 0 }, hidden: false };
  if (previous.y === null) return { state: { y, travel: 0 } };
  const delta = y - previous.y;
  if (Math.abs(delta) < 0.5) return { state: { ...previous, y } };
  const travel = Math.sign(delta) === Math.sign(previous.travel) ? previous.travel + delta : delta;
  if (travel >= 22) return { state: { y, travel: 0 }, hidden: true };
  if (travel <= -10) return { state: { y, travel: 0 }, hidden: false };
  return { state: { y, travel } };
}
