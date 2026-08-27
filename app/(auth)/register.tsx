import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { signUpUser, isPhoneRegistered } from "@/lib/api/auth";
import { useKeyboardHeight } from "@/lib/useKeyboardHeight";
import {
  getPhoneError,
  getNewPasswordError,
  getNameError,
  getAddressError,
  PASSWORD_REQUIREMENTS_HINT,
  PHONE_REQUIREMENTS_HINT,
  NAME_REQUIREMENTS_HINT,
  ADDRESS_REQUIREMENTS_HINT,
} from "@/lib/validation";
import { PhoneInput } from "@/components/PhoneInput";
import { BackButton } from "@/components/BackButton";
import { ScreenBackground } from "@/components/ScreenBackground";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { FormField as Field } from "@/components/FormField";
import { colors } from "@/lib/theme";

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [purok, setPurok] = useState("");
  // 11 raw digits, leading "0" included (e.g. "09171234567"). See components/PhoneInput.tsx.
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // Barangay Milagrosa's own stated privacy practice for resident data
  // ("all information gathered... will only be stored in the barangay")
  // is what this consent restates back to the resident, so requiring an
  // explicit yes here - not a pre-checked box - matches that promise
  // instead of just decorating the form with it.
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  // null = untouched/valid, string = the message shown under the field.
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Phone is split into two independently-tracked pieces instead of one
  // combined error string, because it used to be possible for one to
  // silently erase the other: onBlur was recomputing ONLY the format
  // check (getPhoneError) and writing that straight over phoneError - so
  // tapping out of the field after seeing "number already registered"
  // would wipe that warning the instant you lost focus, even though the
  // number was still a duplicate. The condition wasn't satisfied; the
  // warning just got overwritten by a check that didn't know about it.
  //
  // phoneTouched gates the format error the same way blur always has
  // (don't show "required" before the resident has typed anything), but
  // phoneDuplicate is set exclusively by the debounced lookup below and
  // is never touched by onBlur, onFocus, or onChangeText - the only thing
  // that can clear it is the backend confirming the current number isn't
  // a duplicate. That's what "persists until the condition is satisfied"
  // actually requires: the warning's lifetime is tied to the fact it
  // represents, not to focus state.
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneDuplicate, setPhoneDuplicate] = useState(false);
  const DUPLICATE_PHONE_MESSAGE =
    "May account na pong naka-rehistro gamit ang numerong ito. Mag-login na lamang po.";
  const phoneError: string | null =
    (phoneTouched ? getPhoneError(phone) : null) ?? (phoneDuplicate ? DUPLICATE_PHONE_MESSAGE : null);

  // True while the debounced duplicate-number lookup below is in flight -
  // shown as a small "checking" note under the field so a resident who's
  // already sitting on a valid 11-digit number isn't left wondering why
  // Continue hasn't turned into an error or a green check yet.
  const [checkingPhone, setCheckingPhone] = useState(false);

  // Live duplicate check: once the number is a complete, correctly-shaped
  // 11 digits, wait for a short pause in typing (not every keystroke -
  // that would fire a query per digit) and ask the backend if it's
  // registered. Clears phoneDuplicate up front on every change (a number
  // that's still being edited can't be trusted to still be the one that
  // was flagged) and only sets it back to true once the fresh lookup for
  // *this* value confirms it - never left as a stale guess from before.
  //
  // 300ms, not 500 - the general UX research on debounced input validation
  // (form fields specifically, not full-text search-as-you-type) puts the
  // responsive sweet spot around 300ms: long enough that a resident still
  // mid-keystroke doesn't trigger a query per digit, short enough that the
  // check feels immediate once they pause. isPhoneRegistered itself (in
  // lib/api/auth.ts) is also cached and uses a lighter head-only count
  // query now, so shortening the wait here doesn't just move the same
  // network cost earlier - the check that fires after this delay is
  // cheaper than it used to be too.
  useEffect(() => {
    setPhoneDuplicate(false);

    if (getPhoneError(phone)) {
      setCheckingPhone(false);
      return;
    }

    let cancelled = false;
    setCheckingPhone(true);

    const timer = setTimeout(async () => {
      try {
        const exists = await isPhoneRegistered(phone);
        if (!cancelled) setPhoneDuplicate(exists);
      } finally {
        if (!cancelled) setCheckingPhone(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone]);

  // "Next" on the keyboard walks straight down the form in the same order
  // a resident would fill it in by tapping - Pangalan, Apelyido, Address,
  // phone, then Password, which submits. Each ref is only used to call
  // .focus() on the next field; it never reads state.
  const lastNameRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // FIXED - KeyboardAwareScrollView auto-scrolled on every focus change
  // down this five-field form, even when the newly focused field was
  // already visible - each little correction read as the field "moving"
  // rather than the screen just resizing. Plain ScrollView now; the
  // trailing spacer reserves the keyboard's real height as scroll range
  // (frame-synced, lib/useKeyboardHeight.ts) so a field can still be
  // reached by the resident's own scroll, but nothing scrolls for them.
  const keyboardHeight = useKeyboardHeight();
  const spacerStyle = useAnimatedStyle(() => ({ height: keyboardHeight.value }));

  // Recomputed straight from the current values on every render, same as
  // phoneError above - not a separate piece of state that could drift out
  // of sync with what's actually in the fields. Magpatuloy only turns
  // active once every one of these is true at once: every field passes
  // its own validator, the phone number isn't mid-check or a known
  // duplicate, and the consent box is checked. Any single one failing
  // keeps the button gray and disabled, same pattern as the Submit button
  // on verify-id.tsx.
  const canSubmit =
    !getNameError(firstName, "pangalan") &&
    !getNameError(lastName, "apelyido") &&
    !getAddressError(purok) &&
    !getPhoneError(phone) &&
    !phoneDuplicate &&
    !checkingPhone &&
    !getNewPasswordError(password) &&
    consentGiven;

  async function handleRegister() {
    // Runs the real validators on submit (not just on blur) so a resident
    // who never leaves a field - e.g. pastes a number and taps Continue
    // immediately - still gets an inline error instead of the generic
    // signup-failed alert that used to be the only feedback.
    const nextFirstNameError = getNameError(firstName, "pangalan");
    const nextLastNameError = getNameError(lastName, "apelyido");
    const nextAddressError = getAddressError(purok);
    // Computed straight from the raw checks here, not the touched-gated
    // `phoneError` above - a resident who pastes a number and hits
    // Continue without ever blurring the field still needs to be blocked
    // if it's malformed or a duplicate, not waved through because the
    // display hasn't "turned on" for this field yet.
    const nextPhoneError = getPhoneError(phone) ?? (phoneDuplicate ? DUPLICATE_PHONE_MESSAGE : null);
    const nextPasswordError = getNewPasswordError(password);
    setFirstNameError(nextFirstNameError);
    setLastNameError(nextLastNameError);
    setAddressError(nextAddressError);
    setPasswordError(nextPasswordError);
    setPhoneTouched(true);

    if (
      nextFirstNameError ||
      nextLastNameError ||
      nextAddressError ||
      nextPhoneError ||
      nextPasswordError
    ) {
      return;
    }

    if (!consentGiven) {
      Alert.alert(
        "Kailangan ang pahintulot",
        "Paki-check po ang data privacy consent bago magpatuloy."
      );
      return;
    }

    setLoading(true);

    try {
      // NOTE: consentGiven isn't passed to signUpUser yet - the backend
      // team is adding the consent_at / data_privacy_consent columns
      // (see the resident-signup DB plan). Once that lands, add
      // `consentGiven` here so it's actually persisted, not just
      // enforced client-side.
      // phone is already the full local format ("09171234567")  -
      // signUpUser's normalizePhone converts the leading 0 to +63 itself,
      // so no manual prefixing is needed here.
      const { normalizedPhone } = await signUpUser({
        phone,
        password: password.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        purok: purok.trim(),
      });

      router.push({
        pathname: "/(auth)/otp",
        params: { phone: normalizedPhone, mode: "register" },
      });
    } catch (err: any) {
      Alert.alert("Hindi Nakapagrehistro", err.message ?? "Pakisubukan po muli.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
      <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* One whole scrollable page - consent, submit, and the "already
            have an account" link are inside the scroll view as its last
            items, not split into a separate fixed footer below it, so the
            page reads as one page rather than "a page plus a stuck-on
            bottom bar." Plain ScrollView, no auto-scroll-to-field - see the
            comment above `spacerStyle` for why. */}
        <ScrollView
          style={{ flex: 1 }}
          className="px-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 56 }}
        >
          <View className="mb-8 self-start">
            <BackButton onPress={() => router.back()} />
          </View>

          {/* Heading cluster: title + the "this must be truthful" note
              belong together as one block, separated from the fields
              below by a single larger gap rather than each carrying its
              own margin. */}
          <View className="mb-10">
            <Text className="text-[28px] font-semibold text-ink tracking-tight mb-2">
              Gumawa ng Account
            </Text>
            {/* Sets the expectation once, up top, instead of only implying it
                through the per-field format hints below - those catch
                obviously-wrong input, but a resident should also know
                up front that what they enter here has to be their real,
                accurate information, not just correctly-shaped text. */}
            <Text className="text-[15px] text-ink-soft leading-7">
              Siguraduhing totoo at tama ang impormasyong ilalagay dito - ito ang
              gagamitin ng Barangay upang kumpirmahin ang inyong pagkakakilanlan.
            </Text>
          </View>

          {/* Errors are live and persistent, not cleared just because the
              resident started typing again: once a field has been checked
              once (on blur, or already showing an error), every further
              keystroke re-validates immediately, so the warning updates or
              disappears in step with what's actually typed - it only goes
              away once the requirement is genuinely satisfied. The shared
              rule for both name fields is stated once below the row, not
              repeated per column - same rule, same line, side by side. */}
          <View className="flex-row gap-3">
            <Field
              label="Pangalan"
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                if (firstNameError) setFirstNameError(getNameError(t, "pangalan"));
              }}
              onBlur={() => setFirstNameError(getNameError(firstName, "pangalan"))}
              placeholder="Juan"
              autoFocus
              error={firstNameError}
              wrapperClassName="flex-1 mb-1.5"
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
            <Field
              ref={lastNameRef}
              label="Apelyido"
              value={lastName}
              onChangeText={(t) => {
                setLastName(t);
                if (lastNameError) setLastNameError(getNameError(t, "apelyido"));
              }}
              onBlur={() => setLastNameError(getNameError(lastName, "apelyido"))}
              placeholder="Dela Cruz"
              error={lastNameError}
              wrapperClassName="flex-1 mb-1.5"
              returnKeyType="next"
              onSubmitEditing={() => addressRef.current?.focus()}
            />
          </View>
          <Text className="text-[13px] text-ink-faint mb-7">{NAME_REQUIREMENTS_HINT}</Text>
          <Field
            ref={addressRef}
            label="Address"
            value={purok}
            onChangeText={(t) => {
              setPurok(t);
              if (addressError) setAddressError(getAddressError(t));
            }}
            onBlur={() => setAddressError(getAddressError(purok))}
            placeholder="Purok 3, Kalye Mabini"
            error={addressError}
            hint={ADDRESS_REQUIREMENTS_HINT}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
          <View className="mb-8">
            <PhoneInput
              ref={phoneRef}
              label="Numero ng Mobile"
              digits={phone}
              onChangeDigits={setPhone}
              onBlur={() => setPhoneTouched(true)}
              error={phoneError}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Text className="text-[13px] text-ink-faint mt-1.5">
              {checkingPhone && !phoneError ? "Sinusuri ang numero..." : PHONE_REQUIREMENTS_HINT}
            </Text>
          </View>
          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (passwordError) setPasswordError(getNewPasswordError(t));
            }}
            onBlur={() => setPasswordError(getNewPasswordError(password))}
            placeholder="Password"
            isPassword
            // Same fix as reset-password.tsx: without this, the keyboard's
            // default autoCapitalize="sentences" silently uppercases the
            // first character typed here - invisible behind the masked
            // dots, but it means the password actually stored at signup
            // wouldn't match what the resident thinks they typed, and
            // login would fail with a password that looks right to them.
            autoCapitalize="none"
            error={passwordError}
            hint={PASSWORD_REQUIREMENTS_HINT}
            // Last field in the form: "done" instead of "next", and
            // submitting from the keyboard runs the same handler as
            // tapping Magpatuloy - it's still gated by canSubmit inside
            // handleRegister, so an incomplete form can't be submitted
            // just by pressing the keyboard's return key.
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          {/* Consent + submit form one cluster, set apart from the input
              fields above by a hairline rule: everything above is "enter
              your details," everything below is "agree and continue."
              Still the wider mt-6/mb-8 spacing from the "too high" fix -
              that part of the feedback still applies now that this is
              back inside the scroll body. */}
          <View className="h-px bg-gray-200 mt-6 mb-8" />

          {/* Same pattern as verify-id.tsx: only the checkbox icon is the tap
              target, the label text is a plain sibling, Tagalog-only. */}
          <View className="flex-row items-start mb-8">
            <Pressable
              onPress={() => setConsentGiven((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentGiven }}
              // 13, not 10 - reaches the 48dp touch-target minimum for a
              // 22px checkbox icon (android-expo-ui skill).
              hitSlop={13}
              className="active:opacity-70"
              style={{ marginRight: 10, marginTop: 1 }}
            >
              <Ionicons
                name={consentGiven ? "checkbox" : "square-outline"}
                size={22}
                color={consentGiven ? colors.primary : colors.outline}
              />
            </Pressable>
            <Text className="flex-1 text-[15px] text-ink-soft leading-7">
              Sumasang-ayon ako na gamitin ng Barangay ang aking impormasyon para sa
              layunin ng pagpaparehistro at pag-verify lamang.
            </Text>
          </View>

          {/* Mirrors login's cluster exactly - same component, so the
              rule weight and the 24px gaps around it can't drift between
              the two screens a resident bounces between most. */}
          <AuthActionGroup
            secondary={
              <View className="flex-row flex-wrap justify-center items-center">
                <Text className="text-ink-soft text-[16px]">Meron nang account? </Text>
                <Pressable onPress={() => router.replace("/(auth)/login")}>
                  <Text className="text-brand font-semibold text-[16px]">Mag-login</Text>
                </Pressable>
              </View>
            }
          >
            <Pressable
              onPress={handleRegister}
              disabled={loading || !canSubmit}
              className={`rounded-2xl py-4 items-center overflow-hidden ${
                !canSubmit || loading ? "bg-gray-300" : "bg-brand active:opacity-85"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-[18px]">Magpatuloy</Text>
              )}
            </Pressable>
          </AuthActionGroup>
          <Animated.View style={spacerStyle} />
        </ScrollView>
      </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}