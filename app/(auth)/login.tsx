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
import { Link, router } from "expo-router";
import { requestOtp } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { setPendingPhone } = useAuth();
  const { scrollRef, handleFocus, handleContainerLayout } = useKeyboardFocusScroll();

  async function handleSendCode() {
    if (phone.replace(/\s/g, "").length < 10) {
      Alert.alert("Invalid number", "Enter a valid mobile number, e.g. +63 912 345 6789.");
      return;
    }
    setLoading(true);
    try {
      await requestOtp(phone);
      setPendingPhone(phone);
      router.push({ pathname: "/(auth)/otp", params: { phone, mode: "login" } });
    } catch (err: any) {
      Alert.alert("Couldn't send code", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Keyboard was covering the phone input because the layout was a
          fixed, vertically-centered View with no way to shift or scroll
          when the keyboard opens. KeyboardAvoidingView + a scrollable
          container fixes that on both platforms. */}
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
            <View className="mb-12">
              <View className="w-12 h-12 rounded-2xl bg-brand items-center justify-center mb-6">
                <Text className="text-white text-xl font-bold">B</Text>
              </View>
              <Text className="text-[28px] font-semibold text-ink tracking-tight">
                Boses Bantay
              </Text>
              <Text className="text-[15px] text-ink-soft mt-1.5 leading-5">
                Report, track, and get updates from your barangay.
              </Text>
            </View>

            {!isSupabaseConfigured && (
              <View className="mb-8">
                <Text className="text-[13px] text-brand leading-5">
                  Mock mode — no backend connected yet. Any number works, code is 123456.
                </Text>
              </View>
            )}

            <View className="mb-8">
              <Text className="text-[13px] font-medium text-ink-soft mb-2 uppercase tracking-wide">
                Mobile number
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                onFocus={handleFocus}
                keyboardType="phone-pad"
                placeholder="+63 912 345 6789"
                placeholderTextColor="#9CA3AF"
                autoFocus
                className="text-[17px] text-ink border-b border-gray-200 pb-3 focus:border-brand"
              />
            </View>

            <Pressable
              onPress={handleSendCode}
              disabled={loading}
              className="bg-brand rounded-2xl py-4 items-center active:opacity-85"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-[16px]">Send code</Text>
              )}
            </Pressable>

            <View className="flex-row justify-center mt-8">
              <Text className="text-ink-soft text-[14px]">No account yet? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text className="text-brand font-semibold text-[14px]">Register</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
