// Auth layer with a real Supabase path and a mock path.
// Every screen calls THESE functions, never `supabase` directly, so
// flipping isSupabaseConfigured to true is the only change needed
// when the real backend is ready.

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type ResidentProfile = {
  id: string;
  fullName: string;
  phone: string;
  purok: string;
  barangayIdStatus: "unverified" | "pending" | "verified";
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Mock in-memory "backend" -------------------------------------------
let mockOtpSentTo: string | null = null;
const MOCK_OTP = "123456";

const mockProfileStore: Record<string, ResidentProfile> = {};

function normalizePhone(phone: string) {
  return phone.trim().replace(/\s+/g, "");
}

// --- Public API ------------------------------------------------------------

export async function requestOtp(phone: string): Promise<{ ok: true }> {
  const normalized = normalizePhone(phone);

  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    if (error) throw error;
    return { ok: true };
  }

  await delay(700);
  mockOtpSentTo = normalized;
  console.log(`[mock] OTP sent to ${normalized}. Use code ${MOCK_OTP} to verify.`);
  return { ok: true };
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ ok: true; profile: ResidentProfile }> {
  const normalized = normalizePhone(phone);

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: code,
      type: "sms",
    });
    if (error) throw error;
    const profile = mockProfileStore[normalized] ?? {
      id: data.user?.id ?? normalized,
      fullName: "Resident",
      phone: normalized,
      purok: "",
      barangayIdStatus: "unverified",
    };
    return { ok: true, profile };
  }

  await delay(600);
  if (mockOtpSentTo !== normalized) {
    throw new Error("Request a new code for this number first.");
  }
  if (code !== MOCK_OTP) {
    throw new Error("Invalid code. Try 123456 in mock mode.");
  }
  const profile =
    mockProfileStore[normalized] ??
    (mockProfileStore[normalized] = {
      id: `mock-${normalized}`,
      fullName: "Juan Dela Cruz",
      phone: normalized,
      purok: "Purok 3",
      barangayIdStatus: "unverified",
    });
  return { ok: true, profile };
}

export async function registerResident(input: {
  fullName: string;
  phone: string;
  purok: string;
}): Promise<{ ok: true }> {
  const normalized = normalizePhone(input.phone);

  if (isSupabaseConfigured) {
    // Real flow: create the auth user via OTP, then upsert profile row
    // into `users` table once verified (do that after verifyOtp succeeds).
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    if (error) throw error;
    return { ok: true };
  }

  await delay(500);
  mockProfileStore[normalized] = {
    id: `mock-${normalized}`,
    fullName: input.fullName,
    phone: normalized,
    purok: input.purok,
    barangayIdStatus: "unverified",
  };
  mockOtpSentTo = normalized;
  console.log(`[mock] Registered ${input.fullName}. OTP code is ${MOCK_OTP}.`);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
    return;
  }
  await delay(200);
}
