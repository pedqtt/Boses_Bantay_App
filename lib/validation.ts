/**
 * Shared input validation for the auth screens (login, register). Kept
 * separate from lib/api/auth.ts's normalizePhone - that function's job is
 * turning input into the +63 format the backend expects; these functions'
 * job is telling a resident *before* they submit whether what they typed
 * could ever be valid, so an error shows up next to the actual field
 * that's wrong instead of as one generic "invalid phone number or
 * password" alert after a failed request leaves them guessing which part
 * was the problem.
 */

// "+63" is shown as a fixed label in the UI (see components/PhoneInput.tsx)
// but the field itself keeps the leading "0" the resident actually types  -
// the full local format, "09171234567", 11 digits. These two functions are
// what enforce that shape as the resident types, not just at submit time.

/**
 * Turns whatever a resident typed/pasted into the 11-digit number the app
 * actually stores. Strips everything but digits, then caps at 11 so
 * nothing past that point can be typed or pasted in at all - not just
 * trimmed after the fact, capped at the source, so there's never a moment
 * where a 12th+ digit is visible before being corrected away.
 */
export function normalizePhoneDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.slice(0, 11);
}

/** 0917 123 4567 - grouped 4-3-4, the same shape people already read a PH
 *  mobile number in out loud (area/network code, then the rest). */
export function formatPhoneDisplay(digits: string): string {
  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean);
  return parts.join(" ");
}

/** Always-visible guide under the mobile number field, same idea as
 *  PASSWORD_REQUIREMENTS_HINT - shown before any error, not only after. */
export const PHONE_REQUIREMENTS_HINT =
  "11 na numero, magsimula sa 09 (hal. 0917 123 4567). Isang account lang bawat numero.";

/** Login's version of the phone guide - a resident logging in already
 *  knows their own number, so this points back to "the one you signed up
 *  with" rather than reciting a format spec (that's what the register
 *  screen's hint is for, where the number is being created for the first
 *  time). Kept short and in the same polite "po" register as the rest of
 *  the app's copy. */
export const PHONE_FORMAT_HINT =
  "Ang numero po na ginamit ninyo noong nagparehistro (hal. 0917 123 4567).";

/** Shown under login's password field - not requirements (login doesn't
 *  enforce password strength, only that something was typed), just a
 *  friendly pointer back to what the password actually is. */
export const LOGIN_PASSWORD_HINT = "Ang password po na ginamit ninyo noong nagparehistro.";

export function getPhoneError(digits: string): string | null {
  if (!digits) return "Kailangan ang mobile number.";
  if (digits.length < 11) {
    return "Kulang ang numero. Dapat 11 digits, magsimula sa 0 (hal. 09171234567).";
  }
  if (!digits.startsWith("09")) {
    return "Dapat magsimula sa 09 ang numero (hal. 0917 123 4567).";
  }
  return null;
}

const MIN_PASSWORD_LENGTH = 8;

/** Shown under the password field at signup so the requirement is visible
 *  before a resident gets the error, not just after. */
export const PASSWORD_REQUIREMENTS_HINT =
  `Hindi bababa sa ${MIN_PASSWORD_LENGTH} na karakter, may isang malaking letra (A-Z) at isang numero (0-9).`;

// Applies at signup - a new password has to actually meet a minimum bar:
// length, at least one uppercase letter, and at least one digit. Checked in
// this order so the error message always points at the first thing still
// missing, not just "invalid password."
export function getNewPasswordError(password: string): string | null {
  if (!password) return "Kailangan ang password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Dapat pong hindi bababa sa ${MIN_PASSWORD_LENGTH} na karakter ang password.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Dapat pong may kasamang malaking letra (A-Z) ang password.";
  }
  if (!/[0-9]/.test(password)) {
    return "Dapat pong may kasamang numero (0-9) ang password.";
  }
  return null;
}

// Login only checks that something was typed - strength rules belong at
// signup, not re-applied to an existing account whose password may predate
// a rule change.
export function getLoginPasswordError(password: string): string | null {
  return password ? null : "Kailangan ang password.";
}

/** Always-visible guide under the confirm-password field, same pattern as
 *  PASSWORD_REQUIREMENTS_HINT - shown before any mismatch error, not only
 *  after typing something that doesn't match. */
export const CONFIRM_PASSWORD_HINT = "Siguraduhing tugma ang password sa itaas.";

// Used on the reset-password screen's second field - checks the new
// password's own strength requirements first (via the caller running
// getNewPasswordError on it separately), this only checks that the two
// fields actually match, so a typo in the confirm field gets caught before
// a resident locks themselves out with a password they didn't mean to set.
export function getConfirmPasswordError(newPassword: string, confirmPassword: string): string | null {
  if (!confirmPassword) return "Kailangan po ulitin ang password.";
  if (confirmPassword !== newPassword) return "Hindi magkatugma ang password.";
  return null;
}

// Letters (including basic accented ones), spaces, hyphens, and apostrophes
// only - covers "Dela Cruz", "Ma. Teresa", "D'Souza"-style names without
// accepting digits or symbols someone mistyped or pasted in by mistake.
// This can't confirm a name is the resident's *real* name - that's what
// the Barangay ID cross-reference step is actually for - it only catches
// obviously-wrong input (numbers, gibberish symbols, a blank field) before
// it reaches that step at all.
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ.'\- ]+$/;

// One shared line under the Pangalan/Apelyido row, not repeated per field  -
// the two sit side by side and the rule is identical for both, so saying it
// twice in a row only added clutter without adding information.
export const NAME_REQUIREMENTS_HINT = "Titik lang, walang numero o simbolo.";
export const ADDRESS_REQUIREMENTS_HINT =
  "Buong address - Purok, Kalye, atbp. (hal. Purok 3, Kalye Mabini).";

// fieldLabel only names the field for the "required" message ("Kailangan
// ang pangalan.") so that one reads as a complete sentence, same as every
// other required-field error in this file. The length/pattern messages
// stay generic since which field is wrong is already obvious from position.
export function getNameError(value: string, fieldLabel: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `Kailangan ang ${fieldLabel}.`;
  if (trimmed.length < 2) return "Masyadong maikli.";
  if (!NAME_PATTERN.test(trimmed)) return "Titik lang, walang numero o simbolo.";
  return null;
}

// Address just has to look like an actual address, not a real-time
// verification against any registry - same reasoning as names above: this
// blocks placeholder junk ("asd", "123", a single character) so the record
// a barangay officer eventually reviews starts from something legible,
// not a guarantee of truth that only a human cross-check can give.
export function getAddressError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Kailangan ang address.";
  if (trimmed.length < 5) {
    return "Masyadong maikli - ilagay po ang buong address (Purok, Kalye, atbp.).";
  }
  if (!/[A-Za-z]/.test(trimmed)) {
    return "Dapat may kasamang pangalan ng purok o kalye, hindi lang numero.";
  }
  return null;
}
