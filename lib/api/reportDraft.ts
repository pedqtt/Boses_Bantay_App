// In-progress report persistence.
//
// WHY THIS EXISTS
// ───────────────
// The realistic filing scenario from the barangay interviews is a resident
// narrating an incident on the way to the barangay hall. That means the app
// is backgrounded, walked around with, and competing for memory with
// whatever else is on a low-end Android phone. Losing three recordings and a
// full narrative to an OS kill would be a severe failure - the resident
// would have to tell the whole story again, from the start, at exactly the
// moment they're least inclined to.
//
// WHY SecureStore AND NOT AsyncStorage
// ────────────────────────────────────
// A draft holds an unfiled incident narrative: names of complainants,
// respondents and witnesses, an address, and an account of what happened.
// Under the Data Privacy Act of 2012 (RA 10173) that's personal information
// the barangay is accountable for, and it's sitting on a personal device
// before any officer has ever seen it. Encrypted-at-rest storage is the
// right default for it, not a convenience choice.
//
// SecureStore caps a single value at 2048 bytes, which a narrative will
// exceed easily, so values are chunked across numbered keys - the same
// approach already proven in lib/supabase.ts's storage adapter.

import * as SecureStore from "expo-secure-store";

// FIXED: this used to be a single device-wide key with no account scoping.
// A resident who started (but never finished) a report, then logged out and
// a different resident logged into a *new* account on the same phone, would
// have that stranger's leftover draft picked up automatically - wrong
// answers, wrong chunk transcripts, resumed mid-flow on "Ikwento ang
// nangyari" as if it were their own in-progress report. Every key below is
// now suffixed with the signed-in resident's id, so an account switch on
// the same device can never surface another account's unfiled draft. This
// also means logging out doesn't strictly need to wipe the draft for
// *this* fix to hold, but see auth.ts's signOut() - it clears it anyway,
// since an unfiled draft is personal information under RA 10173 and has no
// reason to linger on a device once its owner has signed out.
const DRAFT_KEY = "bb_report_draft";
// Comfortably under SecureStore's 2048-byte ceiling, leaving headroom for
// multi-byte characters: Tagalog text is mostly ASCII but a narrative can
// contain accented characters, and length in JS characters is not the same
// as length in bytes.
const CHUNK_SIZE = 1500;

/** SecureStore keys only allow alphanumerics, ".", "-", and "_". Supabase
 *  user ids are UUIDs already within that set, but this guards against any
 *  id shape (including the offline synthetic `user-<timestamp>` ids) that
 *  isn't. */
function scopeKey(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${DRAFT_KEY}_u_${safe}`;
}

export type PersistedDraft = {
  /** Bumped whenever the shape below changes incompatibly, so an old draft
   *  left on a phone by a previous build is discarded rather than restored
   *  into a flow that no longer understands it. */
  version: number;
  savedAt: string;
  answers: unknown;
  chunks: unknown;
  stage: string;
  chunkIndex: number;
};

export const DRAFT_VERSION = 2;

export async function saveDraft(
  userId: string,
  draft: Omit<PersistedDraft, "version" | "savedAt">
): Promise<void> {
  try {
    const base = scopeKey(userId);
    const metaKey = `${base}_chunks`;
    const payload: PersistedDraft = {
      ...draft,
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);

    await clearDraft(userId);

    const parts = serialized.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
    for (let i = 0; i < parts.length; i++) {
      await SecureStore.setItemAsync(`${base}_${i}`, parts[i]);
    }
    await SecureStore.setItemAsync(metaKey, String(parts.length));
  } catch (err) {
    // A failed save must never interrupt filing. The resident loses only the
    // crash-resilience, not the session they're currently in.
    console.warn("[draft] save failed; continuing without persistence.", err);
  }
}

export async function loadDraft(userId: string): Promise<PersistedDraft | null> {
  try {
    const base = scopeKey(userId);
    const metaKey = `${base}_chunks`;
    const countRaw = await SecureStore.getItemAsync(metaKey);
    if (!countRaw) return null;

    const count = Number(countRaw);
    if (!Number.isFinite(count) || count <= 0) return null;

    let serialized = "";
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${base}_${i}`);
      // A missing chunk means a partially-written or partially-wiped draft.
      // Restoring half a report would be worse than restoring none.
      if (part === null) {
        await clearDraft(userId);
        return null;
      }
      serialized += part;
    }

    const parsed = JSON.parse(serialized) as PersistedDraft;
    if (parsed.version !== DRAFT_VERSION) {
      await clearDraft(userId);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn("[draft] load failed; starting fresh.", err);
    await clearDraft(userId);
    return null;
  }
}

export async function clearDraft(userId: string): Promise<void> {
  try {
    const base = scopeKey(userId);
    const metaKey = `${base}_chunks`;
    const countRaw = await SecureStore.getItemAsync(metaKey);
    const count = Number(countRaw ?? 0);
    if (Number.isFinite(count)) {
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${base}_${i}`);
      }
    }
    await SecureStore.deleteItemAsync(metaKey);
  } catch {
    // Nothing actionable - a stale draft is caught by the version check and
    // the missing-chunk guard above on the next load.
  }
}
