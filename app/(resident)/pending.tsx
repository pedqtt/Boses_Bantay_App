import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/api/auth";

/**
 * Resident-side "waiting on approval" screen — a deliberate duplicate of
 * app/(auth)/pending.tsx for the same reason verify-id.tsx duplicates
 * upload-id.tsx: app/_layout.tsx bounces any signed-in session out of the
 * (auth) group on every render, so a route living there is only reachable
 * in the narrow gap before that redirect fires. verify-id.tsx already
 * routes here after a successful submission (router.replace("/(resident)/pending")),
 * which previously pointed at a screen that didn't exist at that path.
 */
export default function PendingScreen() {
  const { profile, signOut: clearSession } = useAuth();
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
            "Almost there!",
            "The Secretary has verified your ID. We are just waiting for final authorization from the Punong Barangay."
          );
          return;
        }

        Alert.alert(
          "Still pending",
          "Your account is still in the review queue. Please check back a little later."
        );
      } else {
        Alert.alert("Mock Mode", "In mock mode, update the status in Supabase to test approval.");
      }
    } catch (err: any) {
      Alert.alert("Error checking status", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    clearSession();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-8 justify-center items-center">
        <View className="w-20 h-20 rounded-full bg-orange-100 items-center justify-center mb-8">
          <Text className="text-[32px]">⏳</Text>
        </View>

        <Text className="text-[24px] font-semibold text-ink tracking-tight mb-3 text-center">
          Account Under Review
        </Text>

        <Text className="text-[15px] text-ink-soft mb-2 text-center leading-6">
          Thank you for uploading your Barangay ID, {profile?.firstName || "Resident"}.
        </Text>

        <Text className="text-[15px] text-ink-soft mb-10 text-center leading-6">
          Your account is currently pending review by the Barangay Secretary and final authorization by the Punong Barangay.
        </Text>

        <Pressable
          onPress={handleCheckStatus}
          disabled={loading}
          className="bg-brand w-full rounded-2xl py-4 items-center mb-4 active:opacity-85"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-[16px]">Check Approval Status</Text>
          )}
        </Pressable>

        <Pressable onPress={handleSignOut} className="py-4">
          <Text className="text-ink-soft font-medium text-[15px]">Log out for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
