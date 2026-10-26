import { Text, TextInput } from "@/components/AppText";
import { useCallback, useState } from "react";
import { View, Pressable, Image, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/lib/auth-context";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors } from "@/lib/theme";

// Uses the existing local demo submission flow; server-side review is not connected yet.
export default function VerifyIdScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [focused, setFocused] = useState(false);
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

  async function pickPhoto(source: "camera" | "gallery") {
    if (picking || loading) return;
    setPicking(true);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { Alert.alert("Kailangan ang pahintulot", "Payagan ang camera sa settings para makuhanan ang inyong ID, o pumili ng larawan sa gallery."); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [8, 5], quality: 0.7 };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets?.[0]?.uri) setImageUri(result.assets[0].uri);
    } catch { Alert.alert("Hindi mabuksan ang larawan", "Pakisubukan muli ang camera o gallery."); }
    finally { setPicking(false); }
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

  return <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
    <ScreenBackground backgroundColor={colors.residentBackground}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Bumalik" disabled={loading} onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(resident)/profile"); }} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.primary} /></Pressable>
        <Text variant="screenTitle" accessibilityRole="header" style={styles.headerTitle}>Barangay ID</Text>
        <View style={styles.headerIcon}><Ionicons name="shield-checkmark-outline" size={21} color={colors.primary} /></View>
      </View>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.intro}><Text style={styles.title}>I-verify ang inyong ID</Text><Text style={styles.subtitle}>Magdagdag ng malinaw na larawan at ilagay ang numerong nakalimbag sa inyong Barangay ID.</Text></View>
        <View style={styles.card}>
          <View style={styles.sectionHeading}><View style={styles.step}><Text style={styles.stepText}>1</Text></View><Text style={styles.sectionTitle}>Larawan ng ID</Text>{imageUri && <Ionicons name="checkmark-circle" size={20} color="#397354" />}</View>
          <View style={[styles.preview, !imageUri && styles.previewEmpty]}>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" accessibilityLabel="Napiling larawan ng Barangay ID" /> : <View style={styles.placeholder}><View style={styles.placeholderIcon}><Ionicons name="card-outline" size={34} color={colors.primary} /></View><Text style={styles.placeholderTitle}>Ipakita ang buong ID</Text><Text style={styles.placeholderText}>Dapat mabasa ang pangalan at ID number.</Text></View>}
          </View>
          <View style={styles.photoHint}><Ionicons name="scan-outline" size={15} color="#64748B" /><Text style={styles.hintText}>{imageUri ? "Suriin kung malinaw at walang putol ang larawan." : "Malinaw ang kuha · Walang glare · Buong ID"}</Text></View>
          <View style={styles.photoActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Kuhanan ng larawan ang ID" disabled={loading || picking} onPress={() => void pickPhoto("camera")} style={[styles.photoButton, styles.cameraButton, (loading || picking) && styles.disabled]}><Ionicons name="camera-outline" size={20} color="white" /><Text style={styles.cameraText}>Camera</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Pumili ng ID mula sa gallery" disabled={loading || picking} onPress={() => void pickPhoto("gallery")} style={[styles.photoButton, styles.galleryButton, (loading || picking) && styles.disabled]}><Ionicons name="images-outline" size={20} color={colors.primary} /><Text style={styles.galleryText}>Gallery</Text></Pressable>
          </View>
          {imageUri && <Pressable accessibilityRole="button" accessibilityLabel="Alisin ang larawan ng ID" disabled={loading || picking} onPress={() => setImageUri(null)} style={styles.remove}><Ionicons name="trash-outline" size={14} color="#A33A46" /><Text style={styles.removeText}>Alisin ang larawan</Text></Pressable>}
        </View>
        <View style={styles.card}>
          <View style={styles.sectionHeading}><View style={styles.step}><Text style={styles.stepText}>2</Text></View><Text style={styles.sectionTitle}>Numero ng ID</Text>{Boolean(idNumber.trim()) && <Ionicons name="checkmark-circle" size={20} color="#397354" />}</View>
          <Text style={styles.fieldLabel}>Barangay ID number</Text>
          <View style={[styles.inputBox, focused && styles.inputFocused]}><Ionicons name="card-outline" size={19} color={focused ? colors.primary : "#64748B"} /><TextInput accessibilityLabel="Numero ng Barangay ID" value={idNumber} onChangeText={setIdNumber} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} editable={!loading} placeholder="Hal. BGY-2026-00123" placeholderTextColor="#64748B" autoCapitalize="characters" autoCorrect={false} maxLength={100} returnKeyType="done" style={styles.input} /></View>
          <Text style={styles.fieldHint}>Kopyahin nang eksakto ang numerong nasa inyong ID.</Text>
        </View>
        <View style={styles.consent}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Pahintulot sa paggamit ng larawan at numero ng ID para sa verification" accessibilityState={{ checked: consentGiven, disabled: loading }} disabled={loading} onPress={() => setConsentGiven(value => !value)} style={styles.checkbox}><Ionicons name={consentGiven ? "checkbox" : "square-outline"} size={24} color={consentGiven ? colors.primary : "#64748B"} /></Pressable>
          <Text style={styles.consentText}>Sumasang-ayon akong gamitin ang larawan at numero ng aking ID para sa verification lamang.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading || picking || !canSubmit, busy: loading }} onPress={handleSubmit} disabled={loading || picking || !canSubmit} style={[styles.submit, (!canSubmit || picking || loading) && styles.submitDisabled]}>{loading ? <ActivityIndicator color="white" /> : <><Text style={styles.submitText}>Isumite ang ID</Text><Ionicons name="arrow-forward" size={19} color="white" /></>}</Pressable>
        {!canSubmit && <Text style={styles.submitHint}>Kumpletuhin ang larawan, ID number, at pahintulot.</Text>}
      </KeyboardAwareScrollView>
    </ScreenBackground>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "white" }, header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, back: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F2F4FA", alignItems: "center", justifyContent: "center" }, headerTitle: { flex: 1, fontSize: 23, lineHeight: 31, fontWeight: "600", color: "#14244B", letterSpacing: -0.4 }, headerIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" }, body: { padding: 20, paddingBottom: 32 }, intro: { marginBottom: 24 }, title: { fontSize: 24, lineHeight: 32, fontWeight: "600", color: "#172033", letterSpacing: -0.4 }, subtitle: { fontSize: 14, lineHeight: 23, color: "#64748B", marginTop: 8 },
  card: { backgroundColor: "white", padding: 18, borderRadius: 20, borderWidth: 1, borderColor: "#DFE5EF", marginBottom: 18 }, sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }, step: { minWidth: 27, minHeight: 27, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 9, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" }, stepText: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: colors.primary }, sectionTitle: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: "600", color: "#172033" },
  preview: { width: "100%", aspectRatio: 8 / 5, borderRadius: 15, overflow: "hidden", backgroundColor: "#F8FAFD", borderWidth: 1, borderColor: "#DEE5F1" }, previewEmpty: { borderStyle: "dashed" }, image: { width: "100%", height: "100%" }, placeholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 8 }, placeholderIcon: { width: 56, height: 48, borderRadius: 15, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" }, placeholderTitle: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: "#374151" }, placeholderText: { fontSize: 11, lineHeight: 18, color: "#64748B", textAlign: "center" }, photoHint: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12, marginBottom: 16 }, hintText: { flex: 1, fontSize: 11, lineHeight: 18, color: "#64748B" }, photoActions: { flexDirection: "row", gap: 10 }, photoButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 48, gap: 8, borderRadius: 13, paddingHorizontal: 10 }, cameraButton: { backgroundColor: colors.primary }, galleryButton: { backgroundColor: colors.residentTint }, cameraText: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: "white" }, galleryText: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: colors.primary }, disabled: { opacity: 0.55 }, remove: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 44, gap: 6, marginTop: 7 }, removeText: { fontSize: 11, lineHeight: 18, color: "#A33A46" },
  fieldLabel: { fontSize: 12, lineHeight: 19, fontWeight: "500", color: "#52617A", marginBottom: 8 }, inputBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, borderRadius: 13, backgroundColor: "#FAFBFD", borderWidth: 1, borderColor: "#DCE3EF" }, inputFocused: { borderColor: colors.primary, backgroundColor: "#FFFFFF" }, input: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 13, fontSize: 16, lineHeight: 24, color: "#172033" }, fieldHint: { fontSize: 11, lineHeight: 18, color: "#64748B", marginTop: 8 }, consent: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 2, marginBottom: 20 }, checkbox: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, consentText: { flex: 1, fontSize: 12, lineHeight: 21, color: "#52617A", paddingTop: 7 }, submit: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 16, backgroundColor: colors.primary, paddingHorizontal: 16 }, submitDisabled: { backgroundColor: "#7E8DAF" }, submitText: { fontSize: 15, lineHeight: 22, fontWeight: "600", color: "white" }, submitHint: { fontSize: 11, lineHeight: 18, color: "#64748B", textAlign: "center", marginTop: 10 },
});
