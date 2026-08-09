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
 *
 * FIXED: this used to swallow every Supabase error and return
 * `{ ok: true }` regardless of what actually happened server-side - the
 * resident would see "success" and land on Home even when nothing was
 * written to the database. Root cause was `const { data: authData } =
 * await supabase.auth.signUp(...)`, which destructured `data` only and
 * silently dropped `error`. When signUp failed (a very likely case here
 * for repeat testers: this project has "Confirm email" auth setting; the
 * synthetic `<number>@mobile.user` address it uses isn't a real one that
 * can ever be confirmed, so re-registering the same number after a first
 * attempt hits "Email not confirmed"/"User already registered"), `userId`
 * fell back to a non-UUID placeholder (`user-${Date.now()}`), the upsert
 * into `public.users` then failed too (invalid UUID for the `id` column),
 * and that failure was only ever `console.log`'d, never thrown.
 *
 * Now: every Supabase error is checked and thrown, so otp.tsx's existing
 * `catch (err) { Alert.alert(...) }` actually fires and tells the resident
 * their account wasn't created, instead of routing them into the app on
 * top of an empty database row.
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

  let userId: string | null = null;

  // 2. Create the auth account + insert into public.users, if configured.
  // Any failure here now throws instead of being logged and ignored - a
  // resident who hits this needs to know their account wasn't actually
  // created, not be waved into the app on an empty row.
  if (isSupabaseConfigured) {
    // Create account in auth.users using email fallback (bypasses SMS provider completely)
    const fakeEmail = `${normalized.replace("+", "")}@mobile.user`;
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
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

    if (signUpError) {
      // "already registered" means a previous attempt got as far as
      // creating the auth.users row but likely failed on the public.users
      // insert (the exact bug this function used to have) - rather than
      // dead-ending the resident here, sign them in with the password they
      // just typed so they can proceed and this insert can complete.
      const alreadyExists = /already registered|already exists/i.test(signUpError.message);
      if (alreadyExists) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: pending.password,
        });
        if (signInError || !signInData.user) {
          throw new Error(
            "May account na pong gamit ang numerong ito. Mag-login na lamang po, o gamitin ang 'Nakalimutan ang password?' kung hindi na maalala ang password."
          );
        }
        userId = signInData.user.id;
      } else {
        throw new Error(`Hindi nakapagrehistro: ${signUpError.message}`);
      }
    } else if (authData?.user?.id) {
      userId = authData.user.id;
    } else {
      // No error, but also no user - happens when "Confirm email" is on
      // and Supabase doesn't return a user object pre-confirmation on some
      // project configs. Without a real userId we can't safely write
      // public.users (its id must match auth.users.id), so this has to
      // surface rather than fabricate a placeholder that will just fail
      // the next insert too.
      throw new Error(
        "Hindi makumpleto ang pagrehistro. Pakisubukan po muli, o makipag-ugnayan sa Barangay kung magpapatuloy ito."
      );
    }

    // Upsert directly into public.users table - userId is guaranteed to be
    // a real auth.users UUID at this point (thrown above otherwise).
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
      throw new Error(`Hindi na-save ang account: ${dbError.message}`);
    }

    console.log("✅ [DB INSERT SUCCESS]: User saved to public.users table!");
    // This number just became registered - flip the cache instead of
    // waiting for it to expire on its own, so an immediate re-check
    // in this same session (e.g. someone else tries the same number
    // right after) reflects reality rather than a stale "available"
    // answer from before this insert happened.
    phoneRegisteredCache.set(normalized, true);
  } else {
    // Supabase isn't configured at all (local/offline dev) - keep the app
    // usable with a session-only synthetic profile, same as before.
    userId = `user-${Date.now()}`;
  }

  // Clean up pending cache
  delete pendingRegistrations[normalized];

  // Construct active profile directly with the user's actual entered name
  const profile: ResidentProfile = {
    id: userId!,
    firstName: pending.firstName,
    lastName: pending.lastName,
    fullName: `${pending.firstName} ${pending.lastName}`.trim(),
    phone: normalized,
    purok: pending.purok,
    // TEMPORARY: forced to fully verified regardless of actual ID review
    // status, so the report-filing gate (report.tsx's isFullyVerified,
    // profile.tsx's status pill) doesn't block anyone while barangay ID
    // verification isn't wired up to a real reviewer yet. Search this file
    // for "TEMPORARY" for the other flows built the same way. Revert to
    // "unverified" once verify-id.tsx submissions actually get reviewed.
    barangayIdStatus: "pb_authorized",
  };

  return { ok: true, profile };
}

/**
 * LOG IN (Existing Users)
 *
 * FIXED: a misplaced closing brace used to put the "offline fallback"
 * return INSIDE the `if (isSupabaseConfigured)` block instead of after it.
 * That meant a resident whose sign-in succeeded (real password, real
 * session) but whose `public.users` row was missing - exactly what the
 * signUp bug above could leave behind - silently got a fabricated
 * "User" / "Purok 1" profile with a fake id instead of any indication
 * something was wrong. There was also a second, dead copy of the same
 * fallback after the function's closing brace that never ran. Both are
 * gone now: a missing row after a successful sign-in throws, since a
 * resident in that state needs the account fixed, not a fake profile
 * masking the gap.
 */
export async function logInUser(
  phone: string,
  password: string
): Promise<{ ok: true; profile: ResidentProfile }> {
  const normalized = normalizePhone(phone);

  if (!isSupabaseConfigured) {
    // Offline/local dev only - keep the app usable without a backend.
    return {
      ok: true,
      profile: {
        id: `user-${normalized}`,
        firstName: "User",
        lastName: "",
        fullName: "User",
        phone: normalized,
        purok: "Purok 1",
        // TEMPORARY: see the matching note in verifyPhoneCode above.
        barangayIdStatus: "pb_authorized",
      },
    };
  }

  const fakeEmail = `${normalized.replace("+", "")}@mobile.user`;
  const { error } = await supabase.auth.signInWithPassword({
    email: fakeEmail,
    password,
  });

  if (error) throw error;

  // Query public.users table
  const { data: dbUser, error: dbError } = await supabase
    .from("users")
    .select("*")
    .eq("mobile_number", normalized)
    .maybeSingle();

  if (dbError) {
    throw new Error(`Hindi ma-load ang profile: ${dbError.message}`);
  }

  if (!dbUser) {
    // Auth succeeded but there's no matching row - the account exists but
    // is incomplete (most likely leftover from the signUp bug fixed
    // above). Surfacing this is what lets a resident know to contact the
    // Barangay instead of quietly getting a fake profile.
    throw new Error(
      "Nahanap ang account pero hindi kumpleto ang impormasyon. Makipag-ugnayan po sa Barangay."
    );
  }

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
      // TEMPORARY: see the matching note in verifyPhoneCode above - ignores
      // whatever's actually on the users row and forces every logged-in
      // resident to read as fully verified.
      barangayIdStatus: "pb_authorized",
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

/**
 * `userId` is optional but should always be passed when known (see
 * profile.tsx) - it's what lets sign-out also wipe that resident's local
 * report draft. See reportDraft.ts: drafts are scoped per-account
 * specifically so one resident's leftover draft can never surface under a
 * different account signed into the same phone, and clearing it here on an
 * explicit sign-out is the complementary half of that fix - an unfiled
 * draft is personal information under RA 10173 and has no reason to
 * outlive the session it belongs to.
 */
export async function signOut(userId?: string): Promise<void> {
  if (userId) {
    const { clearDraft } = await import("@/lib/api/reportDraft");
    await clearDraft(userId).catch(() => {});
  }
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
}