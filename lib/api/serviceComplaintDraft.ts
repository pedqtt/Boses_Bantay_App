import { parseLocationPin, type LocationPin } from "@/lib/map-location";
import * as SecureStore from "expo-secure-store";
import { COMPLAINT_STEPS, type ComplaintStep } from "@/lib/serviceComplaintFlow";
import type { VoiceDescriptionDraft } from "@/components/report/VoiceDescriptionInput";

export type ComplaintDraft = {
  step: ComplaintStep; categoryId: string | null; location: string; locationPin?: LocationPin | null; description: string;
  images: string[]; voiceDraft: VoiceDescriptionDraft;
  pendingPhoto: { replaceUri: string | null } | null;
};
type Manifest = { revision: string; count: number };
const queues = new Map<string, Promise<void>>();
function key(userId: string) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(userId)) throw new Error("Invalid draft owner");
  return `service_complaint_${userId}`;
}
function enqueue(userId: string, action: () => Promise<void>): Promise<void> {
  const prior = queues.get(userId) ?? Promise.resolve();
  const job = prior.catch(() => {}).then(action);
  queues.set(userId, job);
  return job;
}
async function manifest(base: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(base);
  if (!raw) return null;
  const value = JSON.parse(raw) as Manifest;
  return typeof value.revision === "string" && /^[a-zA-Z0-9-]+$/.test(value.revision) && Number.isInteger(value.count) && value.count > 0 && value.count <= 512 ? value : null;
}
async function removeParts(base: string, saved: Manifest | null) {
  if (saved) for (let i = 0; i < saved.count; i++) await SecureStore.deleteItemAsync(`${base}_${saved.revision}_${i}`);
}
export function saveComplaintDraft(userId: string, draft: ComplaintDraft): Promise<void> {
  // Serialize now so queued writes preserve the requested checkpoint.
  const serialized = JSON.stringify({ version: 1, draft });
  return enqueue(userId, async () => {
    const base = key(userId), old = await manifest(base);
    const parts = serialized.match(/[\s\S]{1,500}/g) ?? [];
    if (parts.length > 512) throw new Error("Draft is too large");
    const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(`${base}_${revision}_${i}`, parts[i]);
    // Switch the manifest only after all encrypted parts have been saved.
    await SecureStore.setItemAsync(base, JSON.stringify({ revision, count: parts.length }));
    try { await removeParts(base, old); } catch { /* A stale generation does not affect the checkpoint. */ }
  });
}
export async function loadComplaintDraft(userId: string): Promise<ComplaintDraft | null> {
  await queues.get(userId)?.catch(() => {});
  const base = key(userId), saved = await manifest(base);
  if (!saved) return null;
  let text = "";
  for (let i = 0; i < saved.count; i++) {
    const part = await SecureStore.getItemAsync(`${base}_${saved.revision}_${i}`);
    if (part === null) return null;
    text += part;
  }
  const value = JSON.parse(text) as { version: number; draft: ComplaintDraft };
  const draft = value.draft;
  if (value.version !== 1 || !draft || !COMPLAINT_STEPS.includes(draft.step) ||
    typeof draft.location !== "string" || typeof draft.description !== "string" ||
    !Array.isArray(draft.images) || !draft.images.every(uri => typeof uri === "string") ||
    !draft.voiceDraft || !Array.isArray(draft.voiceDraft.clips)) return null;
  return { ...draft, locationPin: parseLocationPin(draft.locationPin), images: draft.images.slice(0, 5), pendingPhoto: draft.pendingPhoto && (draft.pendingPhoto.replaceUri === null || typeof draft.pendingPhoto.replaceUri === "string") ? draft.pendingPhoto : null };
}
export function clearComplaintDraft(userId: string): Promise<void> {
  return enqueue(userId, async () => {
    const base = key(userId), old = await manifest(base);
    await SecureStore.deleteItemAsync(base);
    await removeParts(base, old);
  });
}
