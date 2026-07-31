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
import { verifyOtp, requestOtp } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";

export default function OtpScreen() {
  const { phone, mode } = useLocalSearchParams<{ phone: string; mode: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { signIn } = useAuth();
  const { scrollRef, handleFocus, handleContainerLayout } = useKeyboardFocusScroll();

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert("Enter code", "The verification code is 6 digits.");
      return;
    }
    setLoading(true);
    try {
      const { profile } = await verifyOtp(phone, code);
      signIn(profile);
      router.replace("/(resident)/home");
    } catch (err: any) {
      Alert.alert("Verification failed", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await requestOtp(phone);
      Alert.alert("Code sent", "A new code has been sent.");
    } catch (err: any) {
      Alert.alert("Couldn't resend", err.message ?? "Please try again.");
    } finally {
      setResending(false);
    }
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
            <Pressable onPress={() => router.back()} className="mb-8 -ml-1 py-1 self-start absolute top-4 left-8">
              <Text className="text-brand text-[15px]">← Back</Text>
            </Pressable>

            <Text className="text-[26px] font-semibold text-ink tracking-tight mb-1.5">
              Verify your number
            </Text>
            <Text className="text-[15px] text-ink-soft mb-10 leading-5">
              Enter the 6-digit code sent to{"\n"}
              <Text className="text-ink font-medium">{phone}</Text>
              {mode === "register" ? " to finish creating your account." : "."}
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

            <Pressable onPress={handleResend} disabled={resending} className="items-center py-2">
              <Text className="text-brand text-[14px] font-medium">
                {resending ? "Resending…" : "Resend code"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
