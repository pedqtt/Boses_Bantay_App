import { useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { isPhoneRegistered, normalizePhone } from "@/lib/api/auth";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";
import { getPhoneError, PHONE_FORMAT_HINT } from "@/lib/validation";
import { PhoneInput } from "@/components/PhoneInput";
import { BackButton } from "@/components/BackButton";
import { ScreenBackground } from "@/components/ScreenBackground";
import { AuthActionGroup } from "@/components/AuthActionGroup";

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
  const { scrollRef, handleFocus, handleContainerLayout, handleScroll, keyboardSpacer } =
    useKeyboardFocusScroll();

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
    <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
      <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* Footer lives outside this ScrollView - see login.tsx for why. */}
        <ScrollView
          ref={scrollRef}
          onLayout={handleContainerLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardSpacer }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Nav + heading act as the header at top, the field group is
              centered in the space below it - the action cluster is now
              the fixed footer below the ScrollView. */}
          {/* 24 top - the back button supplies its own visual offset from
              the edge. */}
          <View className="flex-1 px-8" style={{ paddingTop: 24 }}>
            <View className="mb-8 self-start">
              <BackButton onPress={() => router.back()} />
            </View>

            <View>
              <Text className="text-[28px] font-semibold text-ink tracking-tight mb-2">
                Nakalimutan ang Password
              </Text>
              <Text className="text-[15px] text-ink-soft leading-7">
                Ilagay ang numero ng mobile na ginamit ninyo noong nagparehistro. Magpapadala
                kami ng verification code para makapag-set ng bagong password.
              </Text>
            </View>

            <View className="flex-1 justify-center py-8">
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
                returnKeyType="send"
                onSubmitEditing={handleSendCode}
              />
              <Text className="text-[13px] text-ink-faint mt-1.5">{PHONE_FORMAT_HINT}</Text>
            </View>
          </View>
        </ScrollView>

        <View
          className="px-8"
          style={{ paddingBottom: 56 + (Platform.OS === "ios" ? keyboardSpacer : 0) }}
        >
          <AuthActionGroup
            secondary={
              <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
                <Text className="text-brand text-[16px] font-medium">Bumalik sa Login</Text>
              </Pressable>
            }
          >
            <Pressable
              onPress={handleSendCode}
              disabled={checking}
              className={`rounded-2xl py-4 items-center overflow-hidden ${checking ? "bg-gray-300" : "bg-brand active:opacity-85"}`}
            >
              {checking ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-[18px]">Magpadala ng Code</Text>
              )}
            </Pressable>
          </AuthActionGroup>
        </View>
      </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}
