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
import { signUpUser } from "@/lib/api/auth";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";

function Field({
  label,
  value,
  onChangeText,
  onFocus,
  placeholder,
  keyboardType,
  autoFocus,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onFocus?: (e: any) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
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
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        className="text-[17px] text-ink border-b border-gray-200 pb-3"
      />
    </View>
  );
}

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [purok, setPurok] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { scrollRef, handleFocus, handleContainerLayout } = useKeyboardFocusScroll();

  async function handleRegister() {
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !purok.trim() ||
      !phone.trim() ||
      !password.trim()
    ) {
      Alert.alert("Missing info", "Please fill out all fields.");
      return;
    }

    setLoading(true);

    try {
      const { normalizedPhone } = await signUpUser({
        phone: phone.trim(),
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
      Alert.alert("Registration failed", err.message ?? "Please try again.");
    } finally {
      setLoading(false);
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
          className="flex-1 px-8 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} className="mb-8 -ml-1 py-1 self-start">
            <Text className="text-brand text-[15px]">← Back</Text>
          </Pressable>

          <Text className="text-[26px] font-semibold text-ink tracking-tight mb-8">
            Create your account
          </Text>

          <Field
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            onFocus={handleFocus}
            placeholder="Juan"
            autoFocus
          />
          <Field
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            onFocus={handleFocus}
            placeholder="Dela Cruz"
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
            placeholder="09171234567"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            onFocus={handleFocus}
            placeholder="Enter a secure password"
            secureTextEntry={true}
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