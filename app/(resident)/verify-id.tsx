import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { BackButton } from "@/components/BackButton";
import { ScreenBackground } from "@/components/ScreenBackground";
import { PhotoSourceButtons } from "@/components/PhotoSourceButtons";
import { colors } from "@/lib/theme";

/**
 * Resident-side Barangay ID submission. This is a deliberate duplicate of
 * app/(auth)/upload-id.tsx, not a reuse of it - the root layout
 * (app/_layout.tsx) redirects any signed-in session straight out of the
 * (auth) group and into (resident)/home, so upload-id.tsx is only ever
 * reachable in the narrow window between OTP verification and the first
 * redirect. A resident who skips it, or whose account gets reset to
 * "unverified" later, previously had no way back to it at all - which is
 * the actual bug behind "there's no submission screen." Living inside
 * (resident) instead of (auth) is what makes it reachable at any time:
 * from the Profile tab, or from the report-flow gate when an unverified
 * account tries to file a blotter report.
 *
 * TEMPORARY: no real verification yet. handleSubmit below is a pass-through
 * - it accepts whatever photo + ID number were entered, marks the account
 * "pb_authorized" locally, and moves on. No Supabase upload, no pending
 * review, no staff cross-reference. This intentionally skips the actual
 * approval workflow described in the resident-signup plan (secretary
 * review, then Captain authorization) so the rest of the app - especially
 * the report-flow gate - can be built and tested without a working
 * backend blocking it. Search this file for "TEMPORARY" when the real
 * verification backend lands; everything that needs to change is marked.
 *
 * REDESIGN NOTE (minimalist-product-design + bosesbantay-component-hierarchy)
 * ────────────────────────────────────────────────────────────────────────
 * Went through two intermediate versions before this one: first, two
 * bg-brand-50 card boxes with buttons crammed inside them (reused `brand`
 * as decorative fill, against this app's own "brand = actions only" rule);
 * then a version that hid the capture actions behind one tappable frame +
 * an Alert.alert action sheet - cleaner-looking, but wrong for this
 * audience, since a resident who isn't confident with apps has no reason
 * to know an image box is secretly tappable, and a system action sheet
 * doesn't look like "the app" the way a real button does.
 *
 * This version: the photo frame and its two capture buttons live together
 * inside one plain white Card (the "Larawan" zone), the ID number lives in
 * its own Card (the "Detalye" zone) - real structure via the app's
 * standard Card + SectionLabel components, not colored fills. Buttons stay
 * permanently visible and icon-labeled rather than hidden behind a tap
 * gesture. Explanatory paragraphs were cut; the section labels, button
 * labels, and field label carry the meaning on their own.
 */
export default function VerifyIdScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const { profile, signIn } = useAuth();

  // This screen was still showing the bottom tab bar the whole time,
  // unlike report.tsx and bot.tsx. Harmless while the keyboard is closed,
  // but the moment the resident taps into "Numero ng Barangay ID" and the
  // keyboard opens, the tab bar has nowhere to go but stay put right above
  // it - which is exactly what "submit button stuck to the navbar with no
  // space" was: the button, the tab bar, and the keyboard all stacked with
  // zero breathing room between them. Hiding the tab bar here, same recipe
  // as those two screens, removes the thing the button was colliding with.
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Kailangan ang pahintulot",
        "Kailangan po namin ng access sa camera para makakuha ng larawan ng inyong ID."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      // Locked to a landscape ID-card ratio (85.6mm x 53.98mm ISO ID-1 ≈
      // 1.586:1; 8:5 = 1.6 is the closest clean fraction). This gives a
      // fixed, centered crop box - the resident pinches to zoom and drags
      // to pan the photo underneath it to fit the card into the frame.
      aspect: [8, 5],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [8, 5], // same centered landscape ID-card frame as the camera path
      quality: 0.7,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

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

    // TEMPORARY pass-through - replace this whole block with the real flow
    // once the backend exists:
    //   1. Upload `imageUri` to Supabase storage (barangay_ids bucket, or
    //      resident_documents per the DB plan).
    //   2. Write idNumber + the uploaded file path to the resident's row,
    //      with barangay_id_status/verification_status set to "pending"  -
    //      NOT authorized yet.
    //   3. router.replace("/(resident)/pending") so the resident waits for
    //      an actual officer to cross-reference the ID, matching the real
    //      barangay process (secretary review, then Captain sign-off).
    // For now there's no officer to do that cross-reference, so submitting
    // goes straight to "pb_authorized" and into the app.
    setTimeout(() => {
      signIn({ ...profile, barangayIdStatus: "pb_authorized" });
      setLoading(false);
      router.replace("/(resident)/home");
    }, 600); // brief delay so the loading state is visible, not a network call
  }

  const canSubmit = Boolean(imageUri) && Boolean(idNumber.trim()) && consentGiven;

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
      <ScreenBackground>
      {/* FIXED - was KeyboardAvoidingView + ScrollView, betting on Android's
          native resize to make "height" behavior work. That bet was wrong
          often enough elsewhere in this app (see bot.tsx's own history)
          that every screen with a keyboard is now standardized on
          KeyboardAwareScrollView (react-native-keyboard-controller)
          instead - one mechanism, frame-synced to the real keyboard
          animation, rather than each screen guessing its own. */}
      <KeyboardAwareScrollView
        bottomOffset={24}
        className="flex-1 px-5 pt-3"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // Padding on the container, not just a margin on the last
        // element - guarantees breathing room below the submit button
        // regardless of how much content is above it.
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      >
          <View className="mb-8 self-start">
            <BackButton onPress={() => router.back()} />
          </View>

          <Text className="text-[28px] font-semibold text-ink tracking-tight mb-1.5">
            I-verify ang Barangay ID
          </Text>
          {/* Expanded back out from a one-liner - "why do you need this"
              deserves a real answer, not just a fact with no context, so
              this covers the three things a resident would actually
              wonder: why it's asked for, who checks it, and what it isn't
              (a new-ID application). Still capped at a few short
              sentences, not a wall of text. */}
          <Text className="text-[16px] text-ink-soft mb-8 leading-7">
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
            <Text className="text-[14px] font-medium text-ink-soft mb-2 uppercase tracking-wide">
              Numero ng Barangay ID
            </Text>
            <TextInput
              value={idNumber}
              onChangeText={setIdNumber}
              placeholder="hal. BGY-2026-00123"
              placeholderTextColor={colors.outline}
              autoCapitalize="characters"
              className="text-[19px] text-ink border-b border-gray-200 pb-3"
            />
          </Card>

          <View className="mt-auto">
            {/* Only the checkbox itself is the tap target now, not the
                whole row - the text is a label describing what checking it
                means, not a second way to trigger the same action. Kept
                Tagalog-only per the actual audience; the English line was
                doubling the reading without adding anything a non-English
                speaker needed. */}
            <View className="flex-row items-start mb-5">
              <Pressable
                onPress={() => setConsentGiven((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentGiven }}
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
                <Text className="text-white font-semibold text-[18px]">Isumite para Aprubahan</Text>
              )}
            </Pressable>
          </View>
      </KeyboardAwareScrollView>
    </ScreenBackground>
    </SafeAreaView>
  );
}
