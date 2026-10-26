import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Text, TextInput } from "@/components/AppText";
import { useRef, useState } from "react";
import { View, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { resetPassword } from "@/lib/api/auth";
import {
  getNewPasswordError,
  getConfirmPasswordError,
  PASSWORD_REQUIREMENTS_HINT,
  CONFIRM_PASSWORD_HINT,
} from "@/lib/validation";
import { AuthScreenFrame as ScreenBackground, AuthFormCard, authStyles } from "@/components/auth/AuthScreenFrame";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { colors, fieldBorderColor } from "@/lib/theme";

/**
 * Step 3 of "forgot password" - reached only after forgot-password.tsx
 * confirmed the number has an account and otp.tsx's "reset" mode checked
 * the mock code. See resetPassword in lib/api/auth.ts for why this is a
 * TEMPORARY pass-through: it can't actually change the password
 * server-side yet without a backend endpoint.
 */
// Both password fields below set autoCapitalize="none" / autoCorrect={false}
// / spellCheck={false} - without it, TextInput defaults to
// autoCapitalize="sentences", which auto-capitalizes the first letter typed
// in each field independently. Since these fields are masked
// (secureTextEntry), that transformation is invisible: two people can type
// the exact same characters into "Bagong Password" and "Ulitin ang
// Password" and still get two different stored strings, which is exactly
// what "Ulitin ang password isn't working even though they match" turned
// out to be - the mismatch was real, just not visible to whoever typed it.
export default function ResetPasswordScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  // "Next" moves from the new password into the confirmation field;
  // "Done" on confirm submits, same as tapping I-save ang Password.
  const confirmRef = useRef<TextInput>(null);

  // Scrollable form content keeps large accessibility text reachable.
  const canSubmit = !getNewPasswordError(password) && !getConfirmPasswordError(password, confirmPassword);

  async function handleReset() {
    const nextPasswordError = getNewPasswordError(password);
    const nextConfirmError = getConfirmPasswordError(password, confirmPassword);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) return;

    setLoading(true);
    try {
      await resetPassword(phone, password);
      Alert.alert("Tagumpay", "Na-update ang inyong password. Mag-login na po.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err: any) {
      Alert.alert("Hindi Na-update", err.message ?? "Pakisubukan po muli.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: "#FFFFFF" }}>
      <ScreenBackground>
      <View style={{ flex: 1 }}>

        {/* Heading as header at top, field group centered in the space
            below it, action cluster as the last item. */}
        {/* Padding via `style`, matching login.tsx: same 72 value on
            every auth screen that has no back button at the top. */}
        <KeyboardAwareScrollView className="flex-1" keyboardShouldPersistTaps="handled" bottomOffset={24} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 }}>
          <AuthFormCard>
            <View>
              <Text variant="screenTitle" className="text-[28px] font-semibold text-ink tracking-tight mb-2">
                Bagong Password
              </Text>
              <Text className="text-[15px] text-ink-soft leading-7">
                Maglagay po ng bagong password para sa inyong account.
              </Text>
            </View>

            <View className="pt-6">
            <View className="mb-7">
              <Text className="text-[12px] font-semibold text-ink-faint mb-2 uppercase tracking-wider">
                Bagong Password
              </Text>
              <View
                className="flex-row items-center"
                style={{
                  ...authStyles.inputBox,
                  borderColor: fieldBorderColor({ error: !!passwordError, focused: passwordFocused }),
                }}
              >
                {/* Wrapped in its own flex-1 View instead of putting
                    flex-1 on the TextInput directly. This field is
                    autoFocus, which meant its very first layout pass
                    happened at the same moment the keyboard was opening -
                    the extra timing pressure on an already-ambiguous
                    width (flex-1 with no explicit basis) is what was
                    triggering Android's native text justification here
                    specifically, spreading the masked dots/typed text
                    apart. Giving Yoga a definite width up front removes
                    the ambiguity regardless of timing. */}
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (passwordError) setPasswordError(getNewPasswordError(t));
                      if (confirmError) setConfirmError(getConfirmPasswordError(t, confirmPassword));
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => {
                      setPasswordFocused(false);
                      setPasswordError(getNewPasswordError(password));
                    }}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    placeholder="Password"
                    placeholderTextColor={colors.outline}
                    secureTextEntry={!visible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoFocus
                    // See the confirm field below for why letterSpacing: 0
                    // is needed on every secureTextEntry input here.
                    style={{ letterSpacing: 0, paddingVertical: 12 }}
                    className="text-[16px] text-ink"
                  />
                </View>
                {/* hitSlop 14, not 10 - a 20px icon at hitSlop 10 only
                    reaches a 40dp tap target, under the 48dp minimum
                    (android-expo-ui skill, rule 4 / MD3 touch targets). */}
                <Pressable onPress={() => setVisible((v) => !v)} hitSlop={14} style={authStyles.passwordEye}>
                  <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.outline} />
                </Pressable>
              </View>
              <Text className="text-[13px] text-ink-faint mt-1.5">{PASSWORD_REQUIREMENTS_HINT}</Text>
              {passwordError && <Text className="text-[13px] text-alert mt-1">{passwordError}</Text>}
            </View>

            <View className="mb-8">
              <Text className="text-[12px] font-semibold text-ink-faint mb-2 uppercase tracking-wider">
                Ulitin ang Password
              </Text>
              <View
                className="flex-row items-center"
                style={{
                  ...authStyles.inputBox,
                  borderColor: fieldBorderColor({ error: !!confirmError, focused: confirmFocused }),
                }}
              >
                <View style={{ flex: 1 }}>
                  <TextInput
                    ref={confirmRef}
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      if (confirmError) setConfirmError(getConfirmPasswordError(password, t));
                    }}
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => {
                      setConfirmFocused(false);
                      setConfirmError(getConfirmPasswordError(password, confirmPassword));
                    }}
                    returnKeyType="done"
                    onSubmitEditing={handleReset}
                    placeholder="Ulitin ang password"
                    placeholderTextColor={colors.outline}
                    secureTextEntry={!confirmVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    // letterSpacing: 0 is not a no-op here. On Android,
                    // secureTextEntry applies the password font's wide
                    // character spacing to the PLACEHOLDER too, not just
                    // the masked dots - which is why "Ulitin ang password"
                    // rendered as "U l i t i n  a n g  p a s s w o" and
                    // ran off the end of the field. Setting it explicitly
                    // overrides that inherited spacing.
                    style={{ letterSpacing: 0, paddingVertical: 12 }}
                    className="text-[16px] text-ink"
                  />
                </View>
                <Pressable onPress={() => setConfirmVisible((v) => !v)} hitSlop={14} style={authStyles.passwordEye}>
                  <Ionicons
                    name={confirmVisible ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.outline}
                  />
                </Pressable>
              </View>
              <Text className="text-[13px] text-ink-faint mt-1.5">{CONFIRM_PASSWORD_HINT}</Text>
              {confirmError && <Text className="text-[13px] text-alert mt-1">{confirmError}</Text>}
            </View>
            </View>

            <View className="mt-2" style={{ paddingBottom: 0 }}>
              {/* No secondary link here - a resident mid-reset has no
                  sensible alternative action to offer, so this renders the
                  button alone rather than a divider with nothing under it. */}
              <AuthActionGroup>
                <Pressable
                  onPress={handleReset}
                  disabled={loading || !canSubmit}
                  className={`rounded-2xl py-4 items-center overflow-hidden ${
                    !canSubmit || loading ? "bg-[#647392]" : "bg-brand active:opacity-95"
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text variant="body" className="text-white font-semibold text-[18px]">I-save ang Password</Text>
                  )}
                </Pressable>
              </AuthActionGroup>
            </View>
        </AuthFormCard>
        </KeyboardAwareScrollView>
      </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}
