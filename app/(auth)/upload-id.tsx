import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function UploadIdScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth(); // Grab the resident's data from context

  // 1. Open the camera to snap a photo
  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "We need camera permissions to take a photo of your ID.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
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
      Alert.alert("Missing ID", "Please take a photo of your Barangay ID first.");
      return;
    }

    if (!profile?.id) {
      Alert.alert("Error", "No user profile found. Please log in again.");
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
      Alert.alert("Upload failed", err.message ?? "Please try submitting again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-8 pt-10">
        <Text className="text-[26px] font-semibold text-ink tracking-tight mb-2">
          Verify your identity
        </Text>
        <Text className="text-[15px] text-ink-soft mb-8 leading-5">
          Please upload a clear photo of your official Barangay ID. This is required before you can access the system.
        </Text>

        {/* Image Preview Box */}
        <View className="w-full h-56 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center mb-6 overflow-hidden">
          {imageUri ? (
            <Image source={{ uri: imageUri }} className="w-full h-full resize-cover" />
          ) : (
            <Text className="text-gray-400 font-medium text-[15px]">No ID selected</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View className="flex-row justify-between mb-10">
          <Pressable 
            onPress={handleTakePhoto}
            className="flex-1 bg-brand/10 py-3 rounded-xl items-center mr-2 active:opacity-75"
          >
            <Text className="text-brand font-semibold text-[15px]">Take Photo</Text>
          </Pressable>

          <Pressable 
            onPress={handlePickImage}
            className="flex-1 bg-gray-100 py-3 rounded-xl items-center ml-2 active:opacity-75"
          >
            <Text className="text-ink font-semibold text-[15px]">Choose Gallery</Text>
          </Pressable>
        </View>

        {/* Submit Button */}
        <View className="mt-auto mb-10">
          <Pressable
            onPress={handleSubmit}
            disabled={loading || !imageUri}
            className={`rounded-2xl py-4 items-center ${
              !imageUri || loading ? "bg-gray-300" : "bg-brand active:opacity-85"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-[16px]">
                Submit for Approval
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}