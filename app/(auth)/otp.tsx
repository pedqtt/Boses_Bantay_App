import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Text, TextInput } from "@/components/AppText";
import { useState } from "react";
import { View, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

// ✅ Import our custom bypass function here
import { verifyPhoneCode, MOCK_OTP } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { AuthBackButton as BackButton } from "@/components/auth/AuthScreenFrame";
import { AuthScreenFrame as ScreenBackground, AuthFormCard, authStyles } from "@/components/auth/AuthScreenFrame";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { colors } from "@/lib/theme";

export default function OtpScreen() {
  const { phone, mode } = useLocalSearchParams<{ phone: string; mode: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert("Enter code", "The verification code is 6 digits.");
      return;
    }

    setLoading(true);

    try {
      // "reset" mode (from forgot-password.tsx) doesn't go through
      // verifyPhoneCode at all - that function's job is specifically
      // "check the code, then create an account from the pending signup
      // data," which would be wrong here: this resident already has an
      // account, they just forgot their password. Checking against the
      // same MOCK_OTP directly, then moving on to reset-password.tsx,
      // keeps this path from accidentally re-running signup logic.
      if (mode === "reset") {
        if (code !== MOCK_OTP) {
          throw new Error("Maling code. Gamitin ang 123456 (demo).");
        }
        router.replace({
          pathname: "/(auth)/reset-password",
          params: { phone },
        });
        return;
      }

      // ✅ Call OUR bypass function instead of supabase.auth directly
      const response = await verifyPhoneCode(phone, code);

      if (response.ok) {
        // Update Auth Context with the real profile returned from our bypass!
        if (signIn) {
          await signIn(response.profile);
        }

        // Straight to Home for both new and existing accounts now. New
        // signups still can't file a report until their Barangay ID is
        // verified (see report.tsx's gate, which sends them to verify-id
        // from there instead) - this just stops forcing that screen
        // immediately after OTP, right when they'd expect to land in the
        // app.
        router.replace("/(resident)/home");
      }
    } catch (err: any) {
      Alert.alert("Verification failed", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    // Mock resend since we are bypassing real SMS
    Alert.alert("Naipadala muli", "Gamitin po ang demo code: 123456");
  }

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: "#FFFFFF" }}>
      <ScreenBackground>
      <View style={{ flex: 1 }}>

        {/* Same structure as the rest of the auth flow, and switched to
            Tagalog + the shared BackButton - this screen had been left
            behind in English with the old "← Back" text link while
            login/register moved over. */}
        {/* Same 24 top as forgot-password.tsx - both have a back
            button, so they share the smaller top value. */}
        <KeyboardAwareScrollView className="flex-1" keyboardShouldPersistTaps="handled" bottomOffset={24} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 }}>
          <AuthFormCard>
            <View className="mb-5 self-start">
              <BackButton onPress={() => router.back()} />
            </View>

            <View>
              <Text variant="screenTitle" className="text-[28px] font-semibold text-ink tracking-tight mb-2">
                I-verify ang Numero
              </Text>
              <Text className="text-[15px] text-ink-soft leading-7">
                Ilagay po ang 6 na numerong code na ipinadala sa{"\n"}
                <Text className="text-ink font-medium">{phone}</Text>
                {mode === "register"
                  ? " para makumpleto ang inyong account."
                  : mode === "reset"
                    ? " para makapag-set ng bagong password."
                    : "."}
              </Text>
            </View>

            <View className="pt-6">
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
                keyboardType="number-pad"
                placeholder="······"
                placeholderTextColor={colors.outlineFaint}
                maxLength={6}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleVerify}
                className="text-[32px] font-semibold text-ink text-center"
                style={{ borderWidth: 1, borderColor: "#DCE3EF", borderRadius: 16, backgroundColor: "#FAFBFD", paddingHorizontal: 12, paddingVertical: 16, letterSpacing: 6 }}
              />
            </View>

            <View className="mt-2" style={{ paddingBottom: 0 }}>
              <AuthActionGroup
                secondary={
                  <Pressable onPress={handleResend} hitSlop={8}>
                    <Text className="text-brand text-[16px] font-medium">
                      Hindi natanggap ang code?
                    </Text>
                  </Pressable>
                }
              >
                <Pressable
                  onPress={handleVerify}
                  disabled={loading}
                  className={`rounded-2xl py-4 items-center overflow-hidden ${loading ? "bg-[#647392]" : "bg-brand active:opacity-95"}`}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text variant="body" className="text-white font-semibold text-[18px]">I-verify</Text>
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
