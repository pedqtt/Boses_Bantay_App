import { useEffect, useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";

export const BOT_BUTTON_SIZES = [
  { id: "small", label: "Maliit", size: 56 },
  { id: "standard", label: "Karaniwan", size: 72 },
  { id: "large", label: "Malaki", size: 88 },
] as const;
export type BotButtonSize = typeof BOT_BUTTON_SIZES[number]["id"];
export function getBotButtonSize(id: BotButtonSize): number {
  return BOT_BUTTON_SIZES.find(option => option.id === id)?.size ?? 72;
}

type Preferences = { botButtonSize: BotButtonSize; showBot: boolean; fadeBotWhenIdle: boolean; notificationsEnabled: boolean };
export const DEFAULT_PREFERENCES: Preferences = { showBot: true, fadeBotWhenIdle: true, notificationsEnabled: true, botButtonSize: "standard" };
type Snapshot = { preferences: Preferences; loaded: boolean; error: string };
let snapshot: Snapshot = { preferences: DEFAULT_PREFERENCES, loaded: false, error: "" };
const listeners = new Set<() => void>();
const key = "boses_bantay_device_preferences";
let started = false;
let writes: Promise<void> = Promise.resolve();
function publish(next: Snapshot) { snapshot = next; listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function getSnapshot() { return snapshot; }
async function load() {
  if (started) return;
  started = true;
  try {
    const raw = await SecureStore.getItemAsync(key);
    const saved = raw ? JSON.parse(raw) : {};
    publish({ loaded: true, error: "", preferences: {
      botButtonSize: BOT_BUTTON_SIZES.some(option => option.id === saved?.botButtonSize) ? saved.botButtonSize : "standard",
      notificationsEnabled: typeof saved?.notificationsEnabled === "boolean" ? saved.notificationsEnabled : true,
      showBot: typeof saved?.showBot === "boolean" ? saved.showBot : true,
      fadeBotWhenIdle: typeof saved?.fadeBotWhenIdle === "boolean" ? saved.fadeBotWhenIdle : true,
    } });
  } catch { publish({ ...snapshot, loaded: true, error: "Hindi ma-load ang preferences sa device. Maaari mong itakda muli ang mga ito." }); }
}
export function updateAppPreferences(patch: Partial<Preferences>) {
  if (!snapshot.loaded) return;
  const preferences = { ...snapshot.preferences, ...patch };
  publish({ preferences, loaded: true, error: "" });
  writes = writes.catch(() => {}).then(async () => {
    try { await SecureStore.setItemAsync(key, JSON.stringify(preferences)); }
    catch { publish({ ...snapshot, error: "Gumagana ang pagbabago ngayon, pero hindi ito na-save para sa susunod na pagbukas ng app." }); }
  });
}
export function useAppPreferences() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { void load(); }, []);
  return value;
}
