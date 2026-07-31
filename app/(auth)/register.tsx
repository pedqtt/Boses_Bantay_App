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
import { router } from "expo-router";
import { registerResident } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";

function Field({
  label,
  value,
  onChangeText,
  onFocus,
  placeholder,
  keyboardType,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onFocus?: (e: any) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad";
  autoFocus?: boolean;
}) {
  return (
    <View className="mb-7">
      <Text className="text-[13px] font-medium text-ink-soft mb-2 uppercase tracking-wide">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? "default"}
        autoFocus={autoFocus}
        className="text-[17px] text-ink border-b border-gray-200 pb-3"
      />
    </View>
  );
}

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [purok, setPurok] = useState("");
  const [loading, setLoading] = useState(false);
  const { setPendingPhone } = useAuth();
  const { scrollRef, handleFocus, handleContainerLayout } = useKeyboardFocusScroll();

  async function handleRegister() {
    if (!fullName.trim() || !purok.trim() || phone.replace(/\s/g, "").length < 10) {
      Alert.alert("Missing info", "Fill in your full name, purok, and a valid mobile number.");
      return;
    }
    setLoading(true);
    try {
      await registerResident({ fullName, phone, purok });
      setPendingPhone(phone);
      router.push({ pathname: "/(auth)/otp", params: { phone, mode: "register" } });
    } catch (err: any) {
      Alert.alert("Registration failed", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Mobile number is the last field — without KeyboardAvoidingView the
          keyboard was covering it while typing, since a ScrollView alone
          doesn't auto-shift to keep the focused input visible. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          onLayout={handleContainerLayout}
          className="flex-1 px-8 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} className="mb-8 -ml-1 py-1 self-start">
            <Text className="text-brand text-[15px]">← Back</Text>
          </Pressable>

          <Text className="text-[26px] font-semibold text-ink tracking-tight mb-1.5">
            Create your account
          </Text>
          <Text className="text-[15px] text-ink-soft mb-10 leading-5">
            You'll upload your Barangay ID for verification after this step.
          </Text>

          <Field
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            onFocus={handleFocus}
            placeholder="Juan Dela Cruz"
            autoFocus
          />
          <Field
            label="Purok / address"
            value={purok}
            onChangeText={setPurok}
            onFocus={handleFocus}
            placeholder="Purok 3"
          />
          <Field
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            onFocus={handleFocus}
            placeholder="+63 912 345 6789"
            keyboardType="phone-pad"
          />

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className="bg-brand rounded-2xl py-4 items-center mt-4 mb-10 active:opacity-85"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-[16px]">Continue</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
