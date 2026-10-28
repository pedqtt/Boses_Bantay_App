import { MILAGROSA_BOUNDARY } from "@/lib/milagrosa-boundary";
import { parseLocationPin } from "@/lib/map-location";
export function isWithinMilagrosa(value: unknown): boolean {
  const pin = parseLocationPin(value);
  if (!pin) return false;
  const x = pin.longitude, y = pin.latitude;
  let inside = false;
  for (let i = 0, j = MILAGROSA_BOUNDARY.length - 1; i < MILAGROSA_BOUNDARY.length; j = i++) {
    const [ay, ax] = MILAGROSA_BOUNDARY[j], [by, bx] = MILAGROSA_BOUNDARY[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) <= 1e-10 && x >= Math.min(ax, bx) - 1e-10 && x <= Math.max(ax, bx) + 1e-10 && y >= Math.min(ay, by) - 1e-10 && y <= Math.max(ay, by) + 1e-10) return true;
    if ((by > y) !== (ay > y) && x < (ax - bx) * (y - by) / (ay - by) + bx) inside = !inside;
  }
  return inside;
}
