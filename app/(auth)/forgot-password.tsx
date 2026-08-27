import { useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { isPhoneRegistered, normalizePhone } from "@/lib/api/auth";
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

  // FIXED - no ScrollView, no spacer, same as login.tsx/otp.tsx: fully
  // static layout, only the focused field's border highlight changes.

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
        {/* No ScrollView - fully static, same as login.tsx/otp.tsx. */}
        {/* Nav + heading act as the header at top, the field group is
            centered in the space below it, the action cluster as the
            last item. */}
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
                onBlur={() => setPhoneError(getPhoneError(phone))}
                error={phoneError}
                returnKeyType="send"
                onSubmitEditing={handleSendCode}
              />
              <Text className="text-[13px] text-ink-faint mt-1.5">{PHONE_FORMAT_HINT}</Text>
            </View>

            <View className="mt-8" style={{ paddingBottom: 56 }}>
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
      </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}
