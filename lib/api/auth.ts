import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type ResidentProfile = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  purok: string;
  barangayIdStatus: "unverified" | "secretary_verified" | "pb_authorized";
};

const MOCK_OTP = "123456";

// Temporary in-memory cache to hold pending registration data during the OTP step
const pendingRegistrations: Record<
  string,
  { firstName: string; lastName: string; phone: string; purok: string; password: string }
> = {};

export function normalizePhone(phone: string) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "63" + cleaned.substring(1);
  }
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

/**
 * SIGN UP: Stores inputs locally and prepares for OTP verification
 */
export async function signUpUser(input: {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  purok?: string;
}): Promise<{ ok: true; normalizedPhone: string }> {
  const normalized = normalizePhone(input.phone);

  // Store user registration inputs temporarily until OTP is entered
  pendingRegistrations[normalized] = {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: normalized,
    purok: input.purok ?? "Purok 1",
    password: input.password,
  };

  console.log(`📱 [SIGNUP] Saved pending sign-up for ${input.firstName} (${normalized})`);
  return { ok: true, normalizedPhone: normalized };
}

/**
 * VERIFY PHONE OTP: Hardcoded check for '123456' + Direct DB Insertion
 */
export async function verifyPhoneCode(
  phone: string,
  code: string
): Promise<{ ok: true; profile: ResidentProfile }> {
  const normalized = normalizePhone(phone);

  // 1. Check hardcoded mock OTP
  if (code !== MOCK_OTP) {
    throw new Error("Invalid verification code. Please use 123456.");
  }

  // Retrieve sign-up data from local memory or fallback
  const pending = pendingRegistrations[normalized] || {
    firstName: "Juan",
    lastName: "Dela Cruz",
    phone: normalized,
    purok: "Purok 1",
    password: "Password123!",
  };

  let userId = `user-${Date.now()}`;

  // 2. Insert record into Supabase public.users if connected
  if (isSupabaseConfigured) {
    try {
      // Create account in auth.users using email fallback (bypasses SMS provider completely)
      const fakeEmail = `${normalized.replace("+", "")}@mobile.user`;
      const { data: authData } = await supabase.auth.signUp({
        email: fakeEmail,
        password: pending.password,
        options: {
          data: {
            first_name: pending.firstName,
            last_name: pending.lastName,
            phone: normalized,
            purok: pending.purok,
          },
        },
      });

      if (authData?.user?.id) {
        userId = authData.user.id;
      }

      // Upsert directly into public.users table
      const { error: dbError } = await supabase.from("users").upsert({
        id: userId,
        first_name: pending.firstName,
        last_name: pending.lastName,
        mobile_number: normalized,
        email: fakeEmail,
        address: pending.purok,
        verification_status: "Pending",
        approval_status: "Pending",
      });

      if (dbError) {
        console.log("⚠️ [DB INSERT WARN]:", dbError.message);
      } else {
        console.log("✅ [DB INSERT SUCCESS]: User saved to public.users table!");
      }
    } catch (err) {
      console.log("⚠️ [SUPABASE BYPASS NOTE]: Proceeding with app session.", err);
    }
  }

  // Clean up pending cache
  delete pendingRegistrations[normalized];

  // Construct active profile directly with the user's actual entered name
  const profile: ResidentProfile = {
    id: userId,
    firstName: pending.firstName,
    lastName: pending.lastName,
    fullName: `${pending.firstName} ${pending.lastName}`.trim(),
    phone: normalized,
    purok: pending.purok,
    barangayIdStatus: "unverified",
  };

  return { ok: true, profile };
}

/**
 * LOG IN (Existing Users)
 */
export async function logInUser(
  phone: string,
  password: string
): Promise<{ ok: true; profile: ResidentProfile }> {
  const normalized = normalizePhone(phone);

  if (isSupabaseConfigured) {
    const fakeEmail = `${normalized.replace("+", "")}@mobile.user`;
    // ✅ ADD "error" TO THIS LINE
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: password,
    }); 

    // ✅ ADD THIS LINE TO CATCH WRONG PASSWORDS
    if (error) throw error;

    // Query public.users table
    const { data: dbUser } = await supabase
      .from("users")
      .select("*")
      .eq("mobile_number", normalized)
      .maybeSingle();

    if (dbUser) {
      const firstName = dbUser.first_name ?? "";
      const lastName = dbUser.last_name ?? "";
      return {
        ok: true,
        profile: {
          id: dbUser.id,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim() || "Resident",
          phone: dbUser.mobile_number ?? normalized,
          purok: dbUser.address ?? "",
          barangayIdStatus: "unverified",
        },
      };
    }
  

  // Fallback profile if offline
  return {
    ok: true,
    profile: {
      id: `user-${normalized}`,
      firstName: "User",
      lastName: "",
      fullName: "User",
      phone: normalized,
      purok: "Purok 1",
      barangayIdStatus: "unverified",
    },
  };
}

  // Fallback profile if offline
  return {
    ok: true,
    profile: {
      id: `user-${normalized}`,
      firstName: "User",
      lastName: "",
      fullName: "User",
      phone: normalized,
      purok: "Purok 1",
      barangayIdStatus: "unverified",
    },
  };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
}