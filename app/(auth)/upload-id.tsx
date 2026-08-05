import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";

export default function UploadIdScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  // Per the barangay's actual verification process: staff cross-check the
  // ID number against their own records, they don't just eyeball the photo.
  // Without this field, the photo alone gives the reviewing officer nothing
  // to look up.
  const [idNumber, setIdNumber] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth(); // Grab the resident's data from context

  // 1. Open the camera to snap a photo
  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Kailangan ang pahintulot", "Kailangan po namin ng access sa camera para makakuha ng larawan ng inyong ID.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      // Locked landscape ID-card ratio, centered on screen — see
      // verify-id.tsx for the full reasoning. Pinch to zoom, drag to pan
      // the photo into the frame.
      aspect: [8, 5],
      quality: 0.7, // Compress slightly to save storage space
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  // 2. Fallback: Choose from gallery
  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [8, 5],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  // 3. Upload to Supabase and Update Profile Status
  async function handleSubmit() {
    if (!imageUri) {
      Alert.alert("Kulang ang larawan", "Kumuha po muna ng larawan ng inyong Barangay ID.");
      return;
    }

    if (!idNumber.trim()) {
      Alert.alert("Kulang ang numero ng ID", "Ilagay po ang numero ng ID na nakalimbag sa inyong Barangay ID.");
      return;
    }

    if (!profile?.id) {
      Alert.alert("May Problema", "Walang nahanap na profile. Mangyaring mag-login muli.");
      return;
    }

    if (!consentGiven) {
      Alert.alert("Kailangan ang pahintulot", "Paki-check po ang consent bago magpatuloy.");
      return;
    }

    setLoading(true);

    try {
      if (isSupabaseConfigured) {
        // A. Convert the local image URI into a blob for Supabase upload
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // B. Generate a unique file name (e.g., UUID/1623432423.jpeg)
        const filePath = `${profile.id}/${Date.now()}.jpeg`;

        // C. Upload to the secure 'barangay_ids' bucket
        const { error: uploadError } = await supabase.storage
          .from("barangay_ids")
          .upload(filePath, blob, {
            contentType: "image/jpeg",
          });

        if (uploadError) throw uploadError;

        // D. Update the user's database record to link the image and set status to pending
        // NOTE: idNumber isn't written here yet — the backend team is adding a
        // barangay_id_number column (see the resident-signup DB plan) for staff
        // to cross-reference against their own records. Add it to this update
        // once that column exists; it's already validated and captured above.
        const { error: dbError } = await supabase
          .from("profiles")
          .update({
            barangay_id_url: filePath,
            barangay_id_status: "pending", // Now waiting for Secretary review
          })
          .eq("id", profile.id);

        if (dbError) throw dbError;
      }

      // Route to a pending approval screen (we will build this next)
      router.replace("/(resident)/pending");

    } catch (err: any) {
      Alert.alert("Hindi na-upload", err.message ?? "Subukan po muling isumite.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = Boolean(imageUri) && Boolean(idNumber.trim()) && consentGiven;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1 px-5 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        >
          <Text className="text-[24px] font-semibold text-ink tracking-tight mb-1.5">
            I-verify ang Barangay ID
          </Text>
          <Text className="text-[14px] text-ink-soft mb-8 leading-5">
            Bago po kayo makapag-file ng blotter report o reklamo, kailangan muna naming
            i-verify na tunay kayong residente na may Barangay ID. Susuriin ito ng aming
            staff bago aprubahan ang inyong account. Hindi po ito paghingi ng bagong ID,
            para lamang kumpirmahin ang ID na mayroon na kayo.
          </Text>

          <SectionLabel>Larawan ng Barangay ID</SectionLabel>
          <Card className="p-4 mb-8">
            <View
              className="w-full bg-gray-50 rounded-xl items-center justify-center overflow-hidden mb-4"
              style={{
                aspectRatio: 8 / 5,
                borderWidth: imageUri ? 1 : 2,
                borderColor: imageUri ? "#E5E7EB" : "#D1D5DB",
                borderStyle: imageUri ? "solid" : "dashed",
              }}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} className="w-full h-full resize-contain" />
              ) : (
                <Ionicons name="card-outline" size={32} color="#D1D5DB" />
              )}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={handleTakePhoto}
                className="flex-1 flex-row bg-brand py-3.5 rounded-xl items-center justify-center active:opacity-85"
              >
                <Ionicons name="camera" size={18} color="white" style={{ marginRight: 6 }} />
                <Text className="text-white font-semibold text-[14px]">Kumuha ng Larawan</Text>
              </Pressable>

              <Pressable
                onPress={handlePickImage}
                className="flex-1 flex-row bg-white border border-brand py-3.5 rounded-xl items-center justify-center active:opacity-70"
              >
                <Ionicons name="image-outline" size={18} color="#1D4ED8" style={{ marginRight: 6 }} />
                <Text className="text-brand font-semibold text-[14px]">Piliin sa Gallery</Text>
              </Pressable>
            </View>
          </Card>

          <SectionLabel>Detalye ng ID</SectionLabel>
          <Card className="p-4 mb-10">
            <Text className="text-[12px] font-medium text-ink-soft mb-2 uppercase tracking-wide">
              Numero ng Barangay ID
            </Text>
            <TextInput
              value={idNumber}
              onChangeText={setIdNumber}
              placeholder="hal. BGY-2026-00123"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              className="text-[17px] text-ink border-b border-gray-200 pb-3"
            />
          </Card>

          {/* Submit Button */}
          <View className="mt-auto">
            {/* Only the checkbox itself is the tap target, not the whole
                row — see verify-id.tsx for the full reasoning. */}
            <View className="flex-row items-start mb-5">
              <Pressable
                onPress={() => setConsentGiven((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentGiven }}
                hitSlop={10}
                className="active:opacity-70"
                style={{ marginRight: 10, marginTop: 1 }}
              >
                <Ionicons
                  name={consentGiven ? "checkbox" : "square-outline"}
                  size={22}
                  color={consentGiven ? "#1D4ED8" : "#9CA3AF"}
                />
              </Pressable>
              <Text className="flex-1 text-[13px] text-ink-soft leading-5">
                Sumasang-ayon ako na gamitin ng Barangay ang larawan at numero ng aking ID
                para sa layunin ng pag-verify lamang.
              </Text>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={loading || !canSubmit}
              className={`rounded-2xl py-4 items-center ${
                !canSubmit || loading ? "bg-gray-300" : "bg-brand active:opacity-85"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-[16px]">
                  Isumite para Aprubahan
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}