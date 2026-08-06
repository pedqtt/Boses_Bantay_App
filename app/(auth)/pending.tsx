import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { ScreenBackground } from "@/components/ScreenBackground";

export default function PendingScreen() {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleCheckStatus() {
    setLoading(true);
    try {
      if (isSupabaseConfigured && profile?.id) {
        const { data, error } = await supabase
          .from("profiles")
          .select("barangay_id_status")
          .eq("id", profile.id)
          .single();

        if (error) throw error;

        if (data?.barangay_id_status === "pb_authorized") {
          router.replace("/(resident)/home");
          return;
        }

        if (data?.barangay_id_status === "secretary_verified") {
          Alert.alert(
            "Malapit na po!",
            "Na-verify na po ng Secretary ang inyong ID. Hinihintay na lang po ang huling pag-apruba ng Punong Barangay."
          );
          return;
        }

        Alert.alert(
          "Pending pa po",
          "Nasa review queue pa po ang inyong account. Paki-check po muli mamaya."
        );
      } else {
        Alert.alert("Mock Mode", "In mock mode, update the status in Supabase to test approval.");
      }
    } catch (err: any) {
      Alert.alert("May problema sa pag-check", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
      <ScreenBackground>
      <View className="flex-1 px-8 justify-center items-center">
        <View className="w-20 h-20 rounded-full bg-orange-100 items-center justify-center mb-8">
          <Text className="text-[34px]">⏳</Text>
        </View>

        <Text className="text-[28px] font-semibold text-ink tracking-tight mb-3 text-center">
          Sinusuri pa ang Account
        </Text>

        <Text className="text-[15px] text-ink-soft mb-2 text-center leading-7">
          Salamat po sa pag-upload ng inyong Barangay ID, {profile?.firstName || "Residente"}.
        </Text>

        <Text className="text-[15px] text-ink-soft mb-10 text-center leading-7">
          Kasalukuyang sinusuri po ang inyong account ng Barangay Secretary, at hinihintay ang
          huling pag-apruba ng Punong Barangay.
        </Text>

        <Pressable
          onPress={handleCheckStatus}
          disabled={loading}
          className={`w-full rounded-2xl py-4 items-center mb-4 overflow-hidden ${loading ? "bg-gray-300" : "bg-brand active:opacity-85"}`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-[18px]">
              I-check ang Status
            </Text>
          )}
        </Pressable>

        <Pressable onPress={handleSignOut} className="py-4" hitSlop={8}>
          <Text className="text-ink-soft font-medium text-[17px]">
            Mag-log out muna
          </Text>
        </Pressable>
      </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}