import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/api/auth";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";

const ID_STATUS_LABEL: Record<string, string> = {
  unverified: "Not submitted",
  pending: "Pending review",
  verified: "Verified",
};

// No per-row colored icon circle: five identical blue badges in a list read
// as decoration, not information — the label text already carries the
// meaning, and the icon alone (no background) is enough to aid scanning.
function Row({
  icon,
  label,
  value,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="active:opacity-60">
      <View className={`flex-row items-center py-4 ${isLast ? "" : "border-b border-gray-100"}`}>
        <Ionicons name={icon} size={18} color="#6B7280" style={{ width: 26 }} />
        <Text className="flex-1 text-[15px] text-ink">{label}</Text>
        {value && <Text className="text-[13px] text-ink-faint mr-1">{value}</Text>}
        {onPress && <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { profile, signOut: clearSession } = useAuth();

  async function handleLogout() {
    await signOut();
    clearSession();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-5 pt-3 pb-6">
        <Text className="text-[24px] font-semibold text-ink tracking-tight">Profile</Text>
      </View>

      <View className="px-5">
        <View className="items-center mb-9">
          <View className="w-16 h-16 rounded-full bg-brand items-center justify-center mb-3">
            <Text className="text-white text-[22px] font-semibold">
              {(profile?.fullName ?? "R").charAt(0)}
            </Text>
          </View>
          <Text className="text-[17px] font-semibold text-ink">{profile?.fullName ?? "Resident"}</Text>
          <Text className="text-[13px] text-ink-faint mt-0.5">{profile?.phone}</Text>
        </View>

        <SectionLabel>Account</SectionLabel>
        <Card className="px-4 mb-8">
          <Row icon="location-outline" label="Purok / address" value={profile?.purok || "—"} />
          <Row
            icon="card-outline"
            label="Barangay ID"
            value={ID_STATUS_LABEL[profile?.barangayIdStatus ?? "unverified"]}
            onPress={() => {}}
          />
          <Row icon="notifications-outline" label="Notifications" onPress={() => {}} />
          <Row icon="help-circle-outline" label="Help & support" onPress={() => {}} isLast />
        </Card>

        <Pressable onPress={handleLogout} className="items-center py-3 active:opacity-70">
          <Text className="text-[14px] text-red-500 font-medium">Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
