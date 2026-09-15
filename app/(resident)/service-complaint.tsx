import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  { id: "Flooding / Drainage", label: "Flooding / Drainage", icon: "water-outline" },
  { id: "Garbage / Waste", label: "Garbage / Waste", icon: "trash-outline" },
  { id: "Road Hazard", label: "Road Hazard / Pothole", icon: "warning-outline" },
  { id: "Damaged Facility", label: "Damaged Facility", icon: "construct-outline" },
  { id: "Other Hazard", label: "Other Hazard", icon: "ellipsis-horizontal-circle-outline" },
];

function getCategoryWhyReason(selectedCategory: string): string {
  switch (selectedCategory) {
    case "Flooding / Drainage":
      return "Risk of water overflow, property damage, and sanitation hazards";
    case "Garbage / Waste":
      return "Public health hazard, odor pollution, and pest attraction";
    case "Road Hazard":
      return "Traffic hazard and physical danger to pedestrians and vehicles";
    case "Damaged Facility":
      return "Safety risk and unusable public infrastructure needing urgent repair";
    default:
      return "Community safety hazard requiring barangay inspection and action";
  }
}

export default function ServiceComplaintScreen() {
  const router = useRouter();
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!description.trim() || !address.trim()) {
      Alert.alert("Missing Details", "Please fill in both the location and issue description.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to submit a report.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const complainantName =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email ||
        "Resident";
      const complainantPhone =
        profile?.phone_number ||
        profile?.phone ||
        user.user_metadata?.phone ||
        "N/A";
      const complainantAddress =
        profile?.address ||
        profile?.purok ||
        address.trim();

      const refNo = `SC-${Math.floor(100000 + Math.random() * 900000)}`;

      const formattedDate = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const whyReason = getCategoryWhyReason(category);

      // Insert into 'reports' table for mobile app display and web admin syncing
      const { error } = await supabase.from("reports").insert({
        reference_no: refNo,
        user_id: user.id,
        category: category,
        summary: category,
        description: description.trim(),
        location: address.trim(),
        status: "Under Review",
        full_details: {
          what: category,
          who: "Hindi Alam",
          where: address.trim(),
          when: formattedDate,
          why: whyReason,
          how: description.trim(),
          description: description.trim(),
          location: address.trim(),
          complainant_name: complainantName,
          complainant_phone: complainantPhone,
          complainant_address: complainantAddress,
        },
      });

      if (error) throw error;

      setDescription("");
      setAddress("");
      setCategory(CATEGORIES[0].id);

      Alert.alert(
        "Report Submitted",
        `Your complaint reference code is ${refNo}.`,
        [
          {
            text: "View Reports",
            onPress: () => router.push("/(resident)/reports"),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Submission Failed", err?.message ?? "Unable to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-5 pt-2 pb-4 flex-row items-center border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:opacity-70 mr-3"
        >
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
        </Pressable>
        <Text className="text-[20px] font-semibold text-gray-900 tracking-tight">
          Community Hazard Report
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          1. Select Category
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-1">
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategory(cat.id)}
                className={`flex-row items-center px-4 py-2.5 rounded-full border mr-2 ${
                  isSelected ? "bg-amber-500 border-amber-500" : "bg-gray-50 border-gray-200"
                }`}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={16}
                  color={isSelected ? "white" : "#4B5563"}
                  style={{ marginRight: 6 }}
                />
                <Text className={`text-[13px] font-medium ${isSelected ? "text-white" : "text-gray-700"}`}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          2. Location / Address
        </Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. Purok 4 near street corner / Basketball court"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-[14px] text-gray-900 mb-6"
        />

        <Text className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          3. Describe the Issue
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholder="Provide details about the problem..."
          textAlignVertical="top"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-[14px] text-gray-900 mb-6 h-28"
        />

        <Text className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          4. Physical Evidence Note
        </Text>
        <View className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl flex-row items-start mb-8">
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#2563EB"
            style={{ marginRight: 10, marginTop: 2 }}
          />
          <Text className="flex-1 text-[13px] text-blue-900 leading-5">
            Kung mayroon kayong mga larawan o karagdagang ebidensya, maaari niyo itong dalhin sa Barangay Hall para sa pagsusuri at beripikasyon.
          </Text>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="w-full bg-amber-500 p-4 rounded-xl items-center active:opacity-80 mb-10"
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-[15px]">Submit Report</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}