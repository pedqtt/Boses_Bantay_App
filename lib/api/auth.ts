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

// Exported (not just module-private) so the OTP screen's "reset password"
// mode can check the same mock code directly, without routing a password
// reset through verifyPhoneCode - that function's job is specifically
// "verify code, then create the account," which isn't what should happen
// when an already-registered resident is just trying to get back in.
export const MOCK_OTP = "123456";

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

// Caches confirmed lookup results in memory, keyed by normalized number.
// A resident retyping, backspacing, or bouncing between two numbers while
// filling out the form re-triggers the debounced effect on the register
// screen for values it may have already resolved a moment ago - without
// this, each of those re-checks would repeat a network round trip for an
// answer we already have. A Map lookup is O(1); skipping straight to it
// when the number's already known is strictly faster than any query,
// server-side optimization included. Session-lived only (not persisted) -
// a number's registration status can change from another device, so this
// is a short-lived speedup, not a source of truth.
const phoneRegisteredCache = new Map<string, boolean>();

/**
 * Looks up whether a phone number already has an account. Accepts either
 * raw local digits ("09171234567") or an already-normalized number -
 * normalizePhone is idempotent-ish enough for both to end up the same key.
 * Shared by the live as-you-type check on the register screen and the
 * submit-time guard in signUpUser below, so there's exactly one query
 * definition to keep in sync with the users table, not two.
 *
 * Query shape matters here as much as the cache does: this used to
 * `.select("id")`, which asks Postgres to fetch and return that column's
 * actual value for the matching row. `head: true` with `count: "exact"`
 * asks it to report only how many rows matched (0 or 1, since
 * mobile_number should be unique) without materializing or transferring
 * any row data at all - same index scan on mobile_number underneath
 * either way, but a smaller response to serialize and send back over the
 * network, which is where the real latency in this check lives (a
 * B-tree equality lookup itself is already O(log n) and fast; round-trip
 * time and payload size are what a resident actually waits on). The one
 * lasting win that isn't purely client-side, though, is making sure
 * mobile_number has a real index in Postgres - see the migration note in
 * this file's comments for the SQL to run once in the Supabase SQL
 * editor, since that's a database change this file can't make on its own.
 */
export async function isPhoneRegistered(phone: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const normalized = normalizePhone(phone);

  const cached = phoneRegisteredCache.get(normalized);
  if (cached !== undefined) return cached;

  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("mobile_number", normalized);

  if (error) {
    console.log("⚠️ [PHONE LOOKUP WARN]:", error.message);
    return false;
  }

  const exists = Boolean(count && count > 0);
  phoneRegisteredCache.set(normalized, exists);
  return exists;
}

// MIGRATION NOTE (run once in the Supabase SQL editor):
// A B-tree index on mobile_number is what actually makes the query above
// an O(log n) index scan instead of an O(n) sequential scan through every
// row - without it, this check gets slower as the users table grows,
// regardless of any client-side optimization in this file. If the
// column is meant to be unique per resident anyway (which the "one
// account per number" rule this app enforces implies it should be), a
// unique index gets both the constraint and the speedup in one statement:
//   create unique index if not exists users_mobile_number_key
//     on public.users (mobile_number);

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

  // Re-check at submit time even though the live check on register.tsx
  // already flags this as the resident types - the live check is
  // debounced and best-effort, so this is the guard that actually blocks
  // registration if it was skipped, still in flight, or the number was
  // taken by someone else in the meantime.
  if (await isPhoneRegistered(normalized)) {
    throw new Error(
      "May account na pong naka-rehistro gamit ang numerong ito. Mag-login na lamang po."
    );
  }

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
        // This number just became registered - flip the cache instead of
        // waiting for it to expire on its own, so an immediate re-check
        // in this same session (e.g. someone else tries the same number
        // right after) reflects reality rather than a stale "available"
        // answer from before this insert happened.
        phoneRegisteredCache.set(normalized, true);
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

/**
 * FORGOT PASSWORD - reset flow, step 2. Step 1 (forgot-password.tsx) just
 * confirms the number has an account via isPhoneRegistered; the OTP screen
 * in "reset" mode checks the same MOCK_OTP code as signup; this is where a
 * new password would actually get set once a resident makes it through
 * both of those.
 *
 * TEMPORARY pass-through, same convention as verify-id.tsx's handleSubmit:
 * accepts the new password and reports success without actually changing
 * anything server-side yet. Genuinely changing another account's password
 * from here isn't something the client can safely do - supabase.auth
 * .updateUser() only works for the currently signed-in session, and this
 * resident isn't signed in (that's the whole point of "forgot password").
 * Actually resetting it needs either a backend endpoint using the Supabase
 * service-role key (never safe to bundle into the app itself), or wiring
 * up Supabase's built-in password-recovery email link - which needs real
 * email delivery this app doesn't have, since residents sign up with a
 * phone number, not an email address (the "email" on file is a synthetic
 * `<number>@mobile.user` placeholder, not something a resident can
 * receive mail at). Search this file for "TEMPORARY" for the other flow
 * built the same way. Until the backend team wires up one of those paths,
 * a resident's actual login password stays whatever it was at signup,
 * even after "successfully" completing this flow.
 */
export async function resetPassword(phone: string, newPassword: string): Promise<{ ok: true }> {
  const normalized = normalizePhone(phone);
  console.log(
    `🔑 [RESET PASSWORD] TEMPORARY pass-through for ${normalized} - password not actually changed server-side yet.`
  );
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
}