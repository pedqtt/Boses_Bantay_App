import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

// ✅ Import our custom bypass function here
import { verifyPhoneCode, MOCK_OTP } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { BackButton } from "@/components/BackButton";
import { ScreenBackground } from "@/components/ScreenBackground";
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
    <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
      <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* No ScrollView here on purpose - this screen has one field and
            fits without scrolling, so it's a static View. Fields don't
            move, scroll, or get chased by the keyboard; focus is shown by
            the field's own border highlight only. */}
        {/* Same structure as the rest of the auth flow, and switched to
            Tagalog + the shared BackButton - this screen had been left
            behind in English with the old "← Back" text link while
            login/register moved over. */}
        {/* Same 24 top as forgot-password.tsx - both have a back
            button, so they share the smaller top value. */}
        <View className="flex-1 px-8" style={{ paddingTop: 24 }}>
            <View className="mb-8 self-start">
              <BackButton onPress={() => router.back()} />
            </View>

            <View>
              <Text className="text-[28px] font-semibold text-ink tracking-tight mb-2">
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

            <View className="flex-1 justify-center py-8">
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
                className="text-[34px] font-semibold text-ink tracking-[12px] text-center border-b border-gray-200 pb-4"
              />
            </View>

            <View className="mt-8" style={{ paddingBottom: 56 }}>
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
                  className={`rounded-2xl py-4 items-center overflow-hidden ${loading ? "bg-gray-300" : "bg-brand active:opacity-85"}`}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold text-[18px]">I-verify</Text>
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