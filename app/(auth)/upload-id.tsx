import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { ScreenBackground } from "@/components/ScreenBackground";
import { PhotoSourceButtons } from "@/components/PhotoSourceButtons";
import { colors } from "@/lib/theme";

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
  const { scrollRef, handleFocus, handleContainerLayout, handleScroll, keyboardSpacer } =
    useKeyboardFocusScroll();

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
    <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
      <ScreenBackground>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          onLayout={handleContainerLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          // flex: 1 via style, not className - see register.tsx for why
          // (the same NativeWind quirk let this ScrollView shrink to its
          // content instead of stretching above the fixed footer).
          style={{ flex: 1 }}
          className="px-5 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 + keyboardSpacer }}
        >
          <Text className="text-[28px] font-semibold text-ink tracking-tight mb-1.5">
            I-verify ang Barangay ID
          </Text>
          <Text className="text-[15px] text-ink-soft mb-8 leading-7">
            Bago po kayo makapag-file ng blotter report o reklamo, kailangan muna naming
            i-verify na tunay kayong residente na may Barangay ID. Susuriin ito ng aming
            staff bago aprubahan ang inyong account. Hindi po ito paghingi ng bagong ID,
            para lamang kumpirmahin ang ID na mayroon na kayo.
          </Text>

          <SectionLabel>Larawan ng Barangay ID</SectionLabel>
          <Card className="p-4 mb-8">
            <View
              className="w-full bg-gray-50 rounded-2xl items-center justify-center overflow-hidden mb-4"
              style={{
                aspectRatio: 8 / 5,
                borderWidth: imageUri ? 1 : 2,
                borderColor: imageUri ? colors.outlineVariant : colors.outlineFaint,
                borderStyle: imageUri ? "solid" : "dashed",
              }}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} className="w-full h-full resize-contain" />
              ) : (
                <Ionicons name="card-outline" size={32} color={colors.outlineFaint} />
              )}
            </View>

            <PhotoSourceButtons onTakePhoto={handleTakePhoto} onPickImage={handlePickImage} />
          </Card>

          <SectionLabel>Detalye ng ID</SectionLabel>
          <Card className="p-4 mb-10">
            <Text className="text-[12px] font-semibold text-ink-faint mb-2 uppercase tracking-wider">
              Numero ng Barangay ID
            </Text>
            <TextInput
              value={idNumber}
              onChangeText={setIdNumber}
              onFocus={handleFocus}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              placeholder="hal. BGY-2026-00123"
              placeholderTextColor={colors.outline}
              autoCapitalize="characters"
              className="text-[19px] text-ink border-b border-gray-200 pb-3"
            />
          </Card>

          {/* Back inside the same scroll body as the rest of the form -
              see register.tsx for why the fixed-footer split got merged
              back in. */}
          {/* Only the checkbox itself is the tap target, not the whole
              row — see verify-id.tsx for the full reasoning. */}
          <View className="flex-row items-start mb-5">
            <Pressable
              onPress={() => setConsentGiven((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentGiven }}
              // 13, not 10 - reaches the 48dp touch-target minimum for a
              // 22px checkbox icon (android-expo-ui skill).
              hitSlop={13}
              className="active:opacity-70"
              style={{ marginRight: 10, marginTop: 1 }}
            >
              <Ionicons
                name={consentGiven ? "checkbox" : "square-outline"}
                size={22}
                color={consentGiven ? colors.primary : colors.outline}
              />
            </Pressable>
            <Text className="flex-1 text-[15px] text-ink-soft leading-7">
              Sumasang-ayon ako na gamitin ng Barangay ang larawan at numero ng aking ID
              para sa layunin ng pag-verify lamang.
            </Text>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !canSubmit}
            className={`rounded-2xl py-4 items-center overflow-hidden ${
              !canSubmit || loading ? "bg-gray-300" : "bg-brand active:opacity-85"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-[18px]">
                Isumite para Aprubahan
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}