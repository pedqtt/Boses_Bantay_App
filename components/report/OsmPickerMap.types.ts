import type { LocationPin } from "@/lib/map-location";
export type OsmPickerMapProps = { initialPin: LocationPin | null; focusPin?: LocationPin | null; onPin: (pin: LocationPin) => void; onReady: () => void; onError: () => void; onOutside: () => void };
