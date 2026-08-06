import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// ✅ Import our custom bypass function and Auth Context
import { logInUser } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";
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
  const { scrollRef, handleFocus, handleContainerLayout, handleScroll, keyboardSpacer } =
    useKeyboardFocusScroll();
  // "Next" on the keyboard moves from phone straight to password; "Done"
  // on password submits, same as tapping Mag-login.
  const passwordRef = useRef<TextInput>(null);

  // ✅ Get signIn from our context so the app knows we are logged in
  const { signIn } = useAuth();

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
        {/* The action cluster (button + link) used to be the last item
            inside this ScrollView, which meant it moved every time the
            view scrolled - including the scroll-to-focused-field motion
            from useKeyboardFocusScroll. A resident tapping the phone
            field would see the login button drift upward along with
            everything else, which read as "the whole screen is doing
            something," not "the field I tapped is coming into view."
            Splitting it into its own sibling below the ScrollView (a
            real fixed footer, not scrollable content) means only the
            header + fields scroll; the button and link stay anchored to
            the bottom of the screen the entire time, the way a
            messaging app's send button never moves while the message
            list above it scrolls. */}
        <ScrollView
          ref={scrollRef}
          onLayout={handleContainerLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardSpacer }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Two vertical zones now (header, then centered fields) - the
              third zone (actions) lives outside the ScrollView, below. */}
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
                onFocus={handleFocus}
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
                    onFocus={(e) => {
                      setPasswordFocused(true);
                      handleFocus(e);
                    }}
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
          </View>
        </ScrollView>

        {/* Fixed footer, outside the ScrollView - see the comment above
            the ScrollView for why. Only this container gets an iOS
            keyboard offset: Android already resizes the whole window on
            keyboard open (adjustResize), so this footer rides up for
            free as a natural side effect of sitting below a ScrollView
            that just got shorter. iOS doesn't resize the window, so
            without this it would sit right where it always does - behind
            the keyboard - the one place a manual offset is still needed. */}
        <View
          className="px-8"
          style={{ paddingBottom: 56 + (Platform.OS === "ios" ? keyboardSpacer : 0) }}
        >
          {/* The primary button and the "no account yet" escape hatch
              belong together as one cluster - both are "leaving this
              screen" actions, distinct from the fields above - and
              sitting at the bottom puts the main action in easy thumb
              reach (Fitts's Law) instead of mid-screen. */}
          <AuthActionGroup
            secondary={
              // flex-wrap on the row itself (not flexShrink on the Text
              // nodes - that combination can trigger Android's native
              // text justification and visibly spread out letter/word
              // spacing) lets this row break onto a second line at
              // larger system font sizes instead of pushing wider than
              // the screen.
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
      </ScreenBackground>
    </SafeAreaView>
  );
}