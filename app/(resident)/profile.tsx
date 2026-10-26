import { useNavbarScroll } from "@/lib/navbar-scroll";
import { Text } from "@/components/AppText";
import { useState } from "react";
import { View, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/api/auth";
import { colors } from "@/lib/theme";
import { homeStyles } from "@/components/home/homeStyles";

const STATUS = {
  unverified: { label: "Hindi pa verified", description: "I-submit ang inyong Barangay ID para sa verification.", icon: "shield-outline", background: "#FFF4DF", foreground: "#855A0B" },
  secretary_verified: { label: "Hinihintay ang authorization", description: "Na-verify na ng secretary. Hinihintay ang authorization ng Punong Barangay.", icon: "time-outline", background: "#FFF4DF", foreground: "#855A0B" },
  pb_authorized: { label: "Verified na", description: "Na-authorize na ng Punong Barangay ang inyong account.", icon: "shield-checkmark-outline", background: "#EAF5EE", foreground: "#246343" },
} as const;

export default function ProfileScreen() {
  const navbarScroll = useNavbarScroll();
  const { profile, signOut: clearSession } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const status = profile?.barangayIdStatus ?? "unverified";
  const verification = STATUS[status] ?? STATUS.unverified;
  const name = [profile?.firstName, profile?.middleName, profile?.lastName].filter(part => part?.trim()).map(part => part!.trim()).join(" ") || profile?.fullName?.trim() || "Resident";
  const initials = [profile?.firstName, profile?.lastName].map(part => Array.from(part?.trim() || "")[0] || "").join("").toLocaleUpperCase();
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await signOut(profile?.id); clearSession(); router.replace("/(auth)/login"); }
    catch { Alert.alert("Hindi makapag-log out", "Pakisubukan muli po."); }
    finally { setLoggingOut(false); }
  }
  return <SafeAreaView edges={["top"]} style={s.screen}>
    <View style={s.header}><Text variant="screenTitle" accessibilityRole="header" style={s.pageTitle}>Profile</Text></View>
    <ScrollView onScroll={navbarScroll.onScroll} onScrollBeginDrag={navbarScroll.onScrollBeginDrag} scrollEventThrottle={16} style={s.content} showsVerticalScrollIndicator={false} contentContainerStyle={[s.body, { paddingBottom: navbarScroll.bottomPadding }]}>
      <View style={s.identityCard}>
        <View style={s.identity}>
          <View style={s.avatar}>{initials ? <Text style={s.initials}>{initials}</Text> : <Ionicons name="person-outline" size={26} color={colors.primary} />}</View>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={s.name}>{name}</Text><Text style={s.resident}>Resident account</Text></View>
        </View>
        <View style={s.details}>
          <InfoRow icon="call-outline" label="Mobile number" value={profile?.phone || "Hindi pa nakatala"} />
          <View style={s.detailDivider} />
          <InfoRow icon="location-outline" label="Purok / address" value={profile?.purok || "Hindi pa nakatala"} />
        </View>
      </View>

      <Text accessibilityRole="header" style={s.sectionTitle}>Barangay ID</Text>
      <View style={s.verificationCard}>
        <View style={s.verificationHeading}>
          <View style={[s.statusIcon, { backgroundColor: verification.background }]}><Ionicons name={verification.icon} size={21} color={verification.foreground} /></View>
          <Text style={[s.statusLabel, { color: verification.foreground }]}>{verification.label}</Text>
          {status === "pb_authorized" && <Ionicons name="checkmark-circle" size={19} color={verification.foreground} />}
        </View>
        <Text style={s.description}>{verification.description}</Text>
        {status !== "pb_authorized" && <Pressable accessibilityRole="button" onPress={() => router.push("/(resident)/verify-id")} android_ripple={{ color: "#DFE7FC" }} style={s.verifyAction}><Text style={s.verifyText}>{status === "secretary_verified" ? "Tingnan ang verification" : "I-verify ang Barangay ID"}</Text><Ionicons name="arrow-forward" size={17} color={colors.primary} /></Pressable>}
      </View>

      <Text accessibilityRole="header" style={s.sectionTitle}>Settings</Text>
      <View style={s.settingsCard}>
        <SettingsRow icon="settings-outline" label="Settings" onPress={() => router.push("/(resident)/settings")} />
        <SettingsRow icon="help-circle-outline" label="Help & support" last />
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ disabled: loggingOut, busy: loggingOut }} disabled={loggingOut} onPress={handleLogout} android_ripple={{ color: "#FBE4E6" }} style={s.logout}>
        <View style={s.logoutIcon}>{loggingOut ? <ActivityIndicator size="small" color={colors.error} /> : <Ionicons name="log-out-outline" size={21} color={colors.error} />}</View><Text style={s.logoutText}>{loggingOut ? "Nagla-log out…" : "Log out"}</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}
function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={s.infoRow}><Ionicons name={icon} size={18} color="#64748B" style={{ marginTop: 2 }} /><View style={{ flex: 1, minWidth: 0 }}><Text style={s.fieldLabel}>{label}</Text><Text selectable style={s.fieldValue}>{value}</Text></View></View>;
}
function SettingsRow({ icon, label, onPress, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; last?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={onPress ? label : `${label}, malapit na`} accessibilityState={{ disabled: !onPress }} disabled={!onPress} onPress={onPress} android_ripple={{ color: "rgba(2,31,148,0.04)" }} style={[s.settingsRow, !last && s.settingsDivider]}>
    <View style={s.settingsIcon}><Ionicons name={icon} size={20} color={onPress ? colors.primary : "#64748B"} /></View><Text style={[s.settingsLabel, onPress && { color: "#172033" }]}>{label}</Text>{onPress ? <Ionicons name="chevron-forward" size={17} color="#64748B" /> : <Text style={s.comingSoon}>Malapit na</Text>}
  </Pressable>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" }, header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, pageTitle: { fontSize: 28, lineHeight: 36, fontWeight: "700", color: "#14244B", letterSpacing: -0.6 }, content: { flex: 1, backgroundColor: colors.residentBackground }, body: { padding: 20, paddingBottom: 110 },
  identityCard: { ...homeStyles.card, padding: 20, marginBottom: 26 }, identity: { flexDirection: "row", alignItems: "center", gap: 14 }, avatar: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" }, initials: { fontSize: 21, lineHeight: 28, fontWeight: "600", color: colors.primary }, name: { fontSize: 21, lineHeight: 29, fontWeight: "600", color: "#172033", letterSpacing: -0.3 }, resident: { fontSize: 12, lineHeight: 19, color: "#64748B", marginTop: 4 },
  details: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E3E8F0", marginTop: 20, paddingTop: 18 }, infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, fieldLabel: { fontSize: 11, lineHeight: 18, color: "#64748B", marginBottom: 3 }, fieldValue: { fontSize: 14, lineHeight: 22, color: "#172033", fontWeight: "500" }, detailDivider: { height: 16 },
  sectionTitle: { ...homeStyles.sectionTitle, marginBottom: 12 }, verificationCard: { ...homeStyles.card, padding: 18, marginBottom: 26 }, verificationHeading: { flexDirection: "row", alignItems: "center", gap: 10 }, statusIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, statusLabel: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: "600" }, description: { fontSize: 13, lineHeight: 21, color: "#64748B", marginTop: 12 }, verifyAction: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48, paddingHorizontal: 14, marginTop: 16, borderRadius: 13, backgroundColor: colors.residentTint, overflow: "hidden" }, verifyText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: "600", color: colors.primary },
  settingsCard: { ...homeStyles.card, paddingHorizontal: 16, marginBottom: 20 }, settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }, settingsDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E3E8F0" }, settingsIcon: { ...homeStyles.itemIcon, backgroundColor: "#F1F3F7" }, settingsLabel: { flex: 1, fontSize: 14, lineHeight: 22, color: "#64748B" }, comingSoon: { fontSize: 10, lineHeight: 16, fontWeight: "500", color: "#64748B", backgroundColor: "#F1F3F7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  logout: { ...homeStyles.card, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, overflow: "hidden" }, logoutIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.errorContainer, alignItems: "center", justifyContent: "center" }, logoutText: { fontSize: 14, lineHeight: 22, fontWeight: "600", color: colors.error },
});
