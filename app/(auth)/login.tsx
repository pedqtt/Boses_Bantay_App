import { useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// ✅ Import our custom bypass function and Auth Context
import { logInUser } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import {
  getPhoneError,
  getLoginPasswordError,
  PHONE_FORMAT_HINT,
  LOGIN_PASSWORD_HINT,
} from "@/lib/validation";
import { PhoneInput } from "@/components/PhoneInput";
import { ScreenBackground } from "@/components/ScreenBackground";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { colors, fieldBorderColor } from "@/lib/theme";

export default function LoginScreen() {
  // 11 raw digits, leading "0" included (e.g. "09171234567"). See components/PhoneInput.tsx.
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // null = no error to show. Same inline-under-the-field pattern as
  // register.tsx, instead of one generic "invalid phone number or
  // password" alert that doesn't say which one was wrong.
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Focus-highlight, same reasoning as PhoneInput/register.tsx's Field:
  // the password field here is a plain TextInput rather than a shared
  // component, so the highlight is tracked locally instead.
  const [passwordFocused, setPasswordFocused] = useState(false);
  // "Next" on the keyboard moves from phone straight to password; "Done"
  // on password submits, same as tapping Mag-login.
  const passwordRef = useRef<TextInput>(null);

  // ✅ Get signIn from our context so the app knows we are logged in
  const { signIn } = useAuth();

  // FIXED - no ScrollView at all now, not even one with a spacer: two
  // fields fit on screen without it, and any scrolling (even passive,
  // non-auto-focus scrolling) still read as the layout being unstable.
  // Fully static View - the only thing that changes on focus is the
  // field's own border highlight (fieldBorderColor below).

  async function handleLogin() {
    const nextPhoneError = getPhoneError(phone);
    const nextPasswordError = getLoginPasswordError(password);
    setPhoneError(nextPhoneError);
    setPasswordError(nextPasswordError);
    if (nextPhoneError || nextPasswordError) {
      return;
    }

    setLoading(true);

    try {
      // ✅ Call OUR bypass wrapper instead of supabase directly!
      // phone is already the full local format ("09171234567")  - 
      // logInUser's normalizePhone converts the leading 0 to +63 itself.
      const response = await logInUser(phone, password.trim());

      if (response.ok) {
        if (signIn) {
          await signIn(response.profile);
        }
        router.replace("/(resident)/home");
      }
    } catch (err: any) {
      Alert.alert("Hindi Nakapag-login", err.message ?? "Mali ang numero o password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
      <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* No ScrollView - fully static. The button lives at the bottom of
            this same View as its last item (register.tsx's pattern for
            where the button sits, just without any scrolling container
            around it). */}
        {/* Two vertical zones (header, then centered fields), plus the
            action cluster as a third. */}
        {/* Padding set via `style`, not className: NativeWind utility
            classes were being applied here but the large vertical
            values weren't taking effect visually, so these are passed
            as plain RN style values where there's no compilation step
            between what's written and what renders. */}
        <View className="flex-1 px-8" style={{ paddingTop: 72 }}>
            {/* Zone 1: header - title + one-line description, anchored
                at the top of the screen. */}
            <View>
              <Text className="text-[28px] font-bold text-ink tracking-tight mb-2">
                Mag-login
              </Text>
              <Text className="text-[15px] text-ink-soft leading-7">
                Mag-login po para ma-access ang inyong barangay account.
              </Text>
            </View>

            {/* Zone 2: the form group, vertically centered in the space
                between the header and the actions - justify-center here
                (rather than on the whole screen) is what keeps the two
                fields reading as one balanced cluster instead of
                sticking to the header. */}
            <View className="flex-1 justify-center py-8">
            {/* Same persistence rule as register.tsx: once an error is
                showing, every keystroke re-validates instead of blanking
                it out, so it only clears when what's typed actually fixes
                it - not just because the resident started typing again. */}
            <View className="mb-6">
              <PhoneInput
                label="Numero ng Mobile"
                digits={phone}
                onChangeDigits={(d) => {
                  setPhone(d);
                  if (phoneError) setPhoneError(getPhoneError(d));
                }}
                onBlur={() => setPhoneError(getPhoneError(phone))}
                error={phoneError}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Text className="text-[13px] text-ink-faint mt-1.5">{PHONE_FORMAT_HINT}</Text>
            </View>

            <View className="mb-8">
              <Text className="text-[12px] font-semibold text-ink-faint mb-2 uppercase tracking-wider">
                Password
              </Text>
              <View
                className="flex-row items-center border-b"
                style={{
                  borderColor: fieldBorderColor({ error: !!passwordError, focused: passwordFocused }),
                }}
              >
                {/* Wrapped in its own flex-1 View - flex-1 directly on a
                    TextInput inside a flex-row leaves its width ambiguous,
                    which can trigger Android's native text justification
                    and visibly spread out letter/word spacing. */}
                <View style={{ flex: 1 }}>
                  <TextInput
                    ref={passwordRef}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (passwordError) setPasswordError(getLoginPasswordError(t));
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => {
                      setPasswordFocused(false);
                      setPasswordError(getLoginPasswordError(password));
                    }}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    placeholder="Ilagay ang password"
                    placeholderTextColor={colors.outline}
                    secureTextEntry={!showPassword}
                    // Same fix as register.tsx and reset-password.tsx:
                    // without this, the keyboard's default
                    // autoCapitalize="sentences" silently uppercases the
                    // first character typed here, invisible behind the
                    // masked dots - a resident whose password actually
                    // starts lowercase could fail login with what looks
                    // like the exact password they typed.
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    // On Android, secureTextEntry applies the password
                    // font's wide character spacing to the placeholder as
                    // well as the masked dots, stretching it out and
                    // running it past the field edge. Setting
                    // letterSpacing explicitly overrides that.
                    style={{ letterSpacing: 0 }}
                    className="text-[19px] text-ink pb-3"
                  />
                </View>
                {/* hitSlop 14, not 10 - reaches the 48dp touch-target
                    minimum for a 20px icon (android-expo-ui skill). */}
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={14} className="pb-3 pl-2">
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.outline} />
                </Pressable>
              </View>
              {passwordError ? (
                <Text className="text-[13px] text-alert mt-1.5">{passwordError}</Text>
              ) : (
                <Text className="text-[13px] text-ink-faint mt-1.5">{LOGIN_PASSWORD_HINT}</Text>
              )}
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                hitSlop={8}
                className="self-end mt-3"
              >
                <Text className="text-brand text-[15px] font-medium">Nakalimutan ang password?</Text>
              </Pressable>
            </View>
            </View>

            {/* Back inside the scroll content, as its last item - see the
                comment above the scroll view for why. Static bottom padding
                (56, matching the old footer's base value) instead of a
                keyboard-tracking one - it doesn't need to dodge the
                keyboard itself; KeyboardAwareScrollView already keeps
                whichever field is focused clear of it. */}
            <View className="mt-8" style={{ paddingBottom: 56 }}>
              <AuthActionGroup
                secondary={
                  <View className="flex-row flex-wrap justify-center items-center">
                    <Text className="text-ink-soft text-[16px]">Wala pang account? </Text>
                    <Pressable onPress={() => router.push("/(auth)/register")}>
                      <Text className="text-brand font-semibold text-[16px]">Magrehistro</Text>
                    </Pressable>
                  </View>
                }
              >
                <Pressable
                  onPress={handleLogin}
                  disabled={loading}
                  className={`rounded-2xl py-4 items-center overflow-hidden ${loading ? "bg-gray-300" : "bg-brand active:opacity-85"}`}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold text-[18px]">Mag-login</Text>
                  )}
                </Pressable>
              </AuthActionGroup>
            </View>
        </View>
      </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}