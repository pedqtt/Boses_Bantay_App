import { useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { isPhoneRegistered, normalizePhone } from "@/lib/api/auth";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";
import { getPhoneError, PHONE_FORMAT_HINT } from "@/lib/validation";
import { PhoneInput } from "@/components/PhoneInput";
import { BackButton } from "@/components/BackButton";

/**
 * Step 1 of "forgot password": confirm the number actually has an account
 * before sending it into the OTP screen (mode="reset") — reusing
 * isPhoneRegistered here (the same check register.tsx uses to block
 * duplicates) the other way around, to block a number that has *no*
 * account from going any further, instead of only discovering that after
 * a resident types in a code and lands on the reset-password screen for
 * nothing.
 */
export default function ForgotPasswordScreen() {
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const { scrollRef, handleFocus, handleContainerLayout } = useKeyboardFocusScroll();

  async function handleSendCode() {
    const formatError = getPhoneError(phone);
    setPhoneError(formatError);
    if (formatError) return;

    setChecking(true);
    try {
      const exists = await isPhoneRegistered(phone);
      if (!exists) {
        setPhoneError("Walang account na naka-rehistro gamit ang numerong ito.");
        return;
      }

      // Normalized ("+639171234567"), same as register.tsx's push into
      // this same OTP screen - keeps the displayed number and the value
      // reset-password.tsx eventually receives consistent with the
      // signup flow instead of one path passing raw local digits and the
      // other passing the +63 form.
      router.push({
        pathname: "/(auth)/otp",
        params: { phone: normalizePhone(phone), mode: "reset" },
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          ref={scrollRef}
          onLayout={handleContainerLayout}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-8 pt-6">
            <View className="mb-8 self-start">
              <BackButton onPress={() => router.back()} />
            </View>

            <Text className="text-[26px] font-semibold text-ink tracking-tight mb-2">
              Nakalimutan ang Password
            </Text>
            <Text className="text-[13px] text-ink-soft mb-8 leading-5">
              Ilagay ang numero ng mobile na ginamit ninyo noong nagparehistro. Magpapadala
              kami ng verification code para makapag-set ng bagong password.
            </Text>

            <View className="mb-8">
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
              />
              <Text className="text-[12px] text-ink-faint mt-1.5">{PHONE_FORMAT_HINT}</Text>
            </View>

            <Pressable
              onPress={handleSendCode}
              disabled={checking}
              className="bg-brand rounded-2xl py-4 items-center mb-4 active:opacity-85"
            >
              {checking ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-[16px]">Magpadala ng Code</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.replace("/(auth)/login")} className="items-center py-2">
              <Text className="text-brand text-[14px] font-medium">Bumalik sa Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
