import { MILAGROSA_STREETS } from "@/lib/milagrosa-streets";
export type LocationPin = { latitude: number; longitude: number; address?: string };
export function parseLocationPin(value: unknown): LocationPin | null {
  if (!value || typeof value !== "object") return null;
  const { latitude, longitude } = value as Record<string, unknown>;
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    ? { latitude, longitude, ...(typeof (value as Record<string, unknown>).address === "string" && String((value as Record<string, unknown>).address).trim() ? { address: String((value as Record<string, unknown>).address).trim().slice(0, 300) } : {}) } : null;
}
export function pinCoordinates(pin: LocationPin): string { return pin.latitude.toFixed(6) + ", " + pin.longitude.toFixed(6); }
export function pinMapUrl(pin: LocationPin): string {
  return "https://www.openstreetmap.org/?mlat=" + pin.latitude + "&mlon=" + pin.longitude + "#map=18/" + pin.latitude + "/" + pin.longitude;
}
export function parseMapMessage(raw: unknown): { type: "ready" | "error" | "outside" } | { type: "pin"; pin: LocationPin } | null {
  let message: unknown = raw;
  try { if (typeof raw === "string") message = JSON.parse(raw); } catch { return null; }
  if (!message || typeof message !== "object") return null;
  const data = message as Record<string, unknown>;
  if (data.channel !== "boses-map-picker") return null;
  if (data.type === "ready" || data.type === "error" || data.type === "outside") return { type: data.type };
  const pin = parseLocationPin(data.pin);
  return data.type === "pin" && pin ? { type: "pin", pin } : null;
}

/** Offline nearest mapped road, not a verified property or postal address. */
export function nearestStreetAddress(pin: LocationPin): string | undefined {
  const scaleX = 111320 * Math.cos(pin.latitude * Math.PI / 180), scaleY = 111320;
  let distance = Infinity, name: string | undefined;
  for (const road of MILAGROSA_STREETS) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const ax = (a[1] - pin.longitude) * scaleX, ay = (a[0] - pin.latitude) * scaleY;
      const dx = (b[1] - a[1]) * scaleX, dy = (b[0] - a[0]) * scaleY;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < distance) { distance = d; name = road.name; }
    }
  }
  return name && distance <= 80 ? `Malapit sa ${name}, Barangay Milagrosa, Quezon City` : undefined;
}
