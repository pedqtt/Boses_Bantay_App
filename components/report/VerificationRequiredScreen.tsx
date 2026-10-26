import { Text } from "@/components/AppText";
import { BackButton } from "@/components/BackButton";
import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";

type BarangayIdStatus = "unverified" | "secretary_verified" | "pb_authorized";
type VerificationRequiredScreenProps = {
  status: BarangayIdStatus;
  onGoVerify: () => void;
  onGoBack: () => void;
};
const COPY = {
  unverified: {
    label: "Kailangan ng verification",
    title: "I-verify ang inyong Barangay ID",
    body: "Para makapagsumite ng blotter report o service complaint, kailangan munang ma-verify ng barangay ang inyong ID.",
    action: "I-verify ang Barangay ID",
    icon: "shield-checkmark-outline",
  },
  secretary_verified: {
    label: "Nasa huling hakbang",
    title: "Hinihintay ang huling pag-apruba",
    body: "Na-verify na ng Secretary ang inyong ID. Hinihintay pa ang pag-apruba ng Punong Barangay bago kayo makapagsumite ng report.",
    action: "Tingnan ang status",
    icon: "time-outline",
  },
  pb_authorized: {
    label: "Kumpleto ang verification",
    title: "Verified na ang inyong account",
    body: "Maaari na po kayong magsumite ng report.",
    action: "Magpatuloy",
    icon: "shield-checkmark-outline",
  },
} as const;

export function VerificationRequiredScreen({ status, onGoVerify, onGoBack }: VerificationRequiredScreenProps) {
  const copy = COPY[status];
  return <SafeAreaView edges={["top", "bottom"]} style={s.screen}>
    <View style={s.header}>
      <BackButton showLabel={false} onPress={onGoBack} />
      <Text variant="title" accessibilityRole="header" style={s.headerTitle}>Barangay ID</Text>
    </View>
    <ScrollView style={s.scroll} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <View style={s.content}>
        <View style={s.card}>
          <View style={s.statusRow}>
            <View style={[s.icon, status !== "secretary_verified" && s.securityIcon]}><Ionicons name={copy.icon} size={27} color={status === "secretary_verified" ? colors.primary : "#15803D"} /></View>
            <View style={[s.statusPill, status === "unverified" && s.unverifiedPill]}><View style={[s.statusDot, status === "unverified" && s.unverifiedDot]} /><Text variant="caption" style={[s.eyebrow, status === "unverified" && s.unverifiedLabel]}>{copy.label}</Text></View>
          </View>
          <Text variant="heading" accessibilityRole="header" style={s.title}>{copy.title}</Text>
          <Text variant="body" style={s.description}>{copy.body}</Text>
          {status === "unverified" && <View style={s.requirements}>
            <Text variant="label" style={s.requirementsTitle}>Ihanda bago mag-verify</Text>
            <View style={s.requirementRow}>
              <View style={s.smallIcon}><Text variant="label" style={s.stepNumber}>1</Text></View>
              <View style={s.rowText}><Text variant="label" style={s.itemTitle}>Larawan ng Barangay ID</Text><Text variant="caption" style={s.itemHint}>Malinaw at nababasa ang detalye.</Text></View>
            </View>
            <View style={s.divider} />
            <View style={s.requirementRow}>
              <View style={s.smallIcon}><Text variant="label" style={s.stepNumber}>2</Text></View>
              <View style={s.rowText}><Text variant="label" style={s.itemTitle}>Numero ng Barangay ID</Text><Text variant="caption" style={s.itemHint}>Kopyahin ang numerong nasa inyong ID.</Text></View>
            </View>
          </View>}
          {status === "secretary_verified" && <View style={s.statusNote}>
            <Ionicons name="checkmark-circle-outline" size={21} color={colors.primary} />
            <Text variant="secondary" style={s.statusText}>Tapos na ang verification ng Secretary. Huling approval na lang ang hinihintay.</Text>
          </View>}
        </View>
      </View>
    </ScrollView>
    <View style={s.footer}>
      <View style={s.footerContent}>
        <Pressable onPress={onGoVerify} accessibilityRole="button" accessibilityLabel={copy.action} android_ripple={{ color: "rgba(255,255,255,0.12)" }} style={s.primary}>
          <Text variant="body" style={s.primaryText}>{copy.action}</Text>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerTitle: { flex: 1, color: "#14244B", fontWeight: "600" },
  scroll: { flex: 1, backgroundColor: colors.residentBackground },
  body: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 32 },
  content: { width: "100%", maxWidth: 520, alignSelf: "center" },
  card: { backgroundColor: "#FFFFFF", padding: 24, borderRadius: 22, borderWidth: 1, borderColor: "#DFE5EF" },
  statusRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22 },
  icon: { width: 56, height: 56, borderRadius: 17, backgroundColor: colors.residentTint, borderWidth: 1, borderColor: colors.residentAccentOutline, alignItems: "center", justifyContent: "center" },
  securityIcon: { backgroundColor: "#EAF7EE", borderColor: "#B7DEC3" },
  statusPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginLeft: "auto", gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, backgroundColor: "#EEF3FC", borderWidth: 1, borderColor: "#D8E3F5" },
  unverifiedPill: { backgroundColor: "#FDECEE", borderColor: "#F2C6CC" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  unverifiedDot: { backgroundColor: "#B42336" },
  eyebrow: { color: colors.primary, fontWeight: "600" },
  unverifiedLabel: { color: "#A51F32" },
  title: { color: "#14244B", fontWeight: "700", letterSpacing: -0.4, marginBottom: 12 },
  description: { color: "#52617A", lineHeight: 24 },
  requirements: { marginTop: 26, padding: 18, borderRadius: 17, backgroundColor: "#F4F7FD", borderWidth: 1, borderColor: "#E0E7F3" },
  requirementsTitle: { color: "#24395F", fontWeight: "700", marginBottom: 18 },
  requirementRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  smallIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C9D8F0", alignItems: "center", justifyContent: "center" },
  stepNumber: { color: colors.primary, fontWeight: "700" },
  rowText: { flex: 1, minWidth: 0 },
  itemTitle: { color: "#253858", fontWeight: "600" },
  itemHint: { color: "#64748B", marginTop: 3 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#DDE5F2", marginVertical: 16, marginLeft: 46 },
  statusNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 16, backgroundColor: "#EEF3FC", borderRadius: 14, marginTop: 24 },
  statusText: { flex: 1, color: "#34486C" },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, borderTopWidth: 1, borderTopColor: "#E5E7EB", backgroundColor: "#FFFFFF" },
  footerContent: { width: "100%", maxWidth: 520, alignSelf: "center" },
  primary: { minHeight: 56, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden" },
  primaryText: { color: "#FFFFFF", fontWeight: "600", flexShrink: 1, textAlign: "center" },
});
