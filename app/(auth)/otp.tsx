import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

// ✅ Import our custom bypass function here
import { verifyPhoneCode, MOCK_OTP } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";

export default function OtpScreen() {
  const { phone, mode } = useLocalSearchParams<{ phone: string; mode: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { scrollRef, handleFocus, handleContainerLayout } = useKeyboardFocusScroll();

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
    Alert.alert("Code resent", "Use the mock code: 123456");
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          onLayout={handleContainerLayout}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-8 justify-center">
            <Pressable
              onPress={() => router.back()}
              className="mb-8 -ml-1 py-1 self-start absolute top-4 left-8"
            >
              <Text className="text-brand text-[15px]">← Back</Text>
            </Pressable>

            <Text className="text-[26px] font-semibold text-ink tracking-tight mb-1.5">
              Verify your number
            </Text>
            <Text className="text-[15px] text-ink-soft mb-10 leading-5">
              Enter the 6-digit code sent to{"\n"}
              <Text className="text-ink font-medium">{phone}</Text>
              {mode === "register"
                ? " to finish creating your account."
                : mode === "reset"
                  ? " to reset your password."
                  : "."}
            </Text>

            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
              onFocus={handleFocus}
              keyboardType="number-pad"
              placeholder="······"
              placeholderTextColor="#D1D5DB"
              maxLength={6}
              autoFocus
              className="text-[32px] font-semibold text-ink tracking-[12px] text-center border-b border-gray-200 pb-4 mb-10"
            />

            <Pressable
              onPress={handleVerify}
              disabled={loading}
              className="bg-brand rounded-2xl py-4 items-center mb-4 active:opacity-85"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-[16px]">Verify</Text>
              )}
            </Pressable>

            <Pressable onPress={handleResend} className="items-center py-2">
              <Text className="text-brand text-[14px] font-medium">
                Didn't get the code?
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}