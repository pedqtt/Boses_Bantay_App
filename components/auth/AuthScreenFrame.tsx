import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";

export function AuthScreenFrame({ children }: { children: ReactNode }) {
  return <View style={authStyles.screen}>
    <View style={authStyles.brandHeader}><View style={authStyles.brandIcon}><Ionicons name="megaphone-outline" size={27} color={colors.primary} /></View><View style={{ flex: 1 }}><Text variant="heading" style={authStyles.brandName}>Boses Bantay</Text><Text variant="secondary" style={authStyles.brandCaption}>Para sa mga residente</Text></View></View>
    <View style={{ flex: 1 }}>{children}</View>
  </View>;
}
export function AuthFormCard({ children }: { children: ReactNode }) { return <View style={authStyles.formCard}>{children}</View>; }
export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Bumalik" android_ripple={{ color: "rgba(2,31,148,0.04)" }} style={authStyles.back}><Ionicons name="chevron-back" size={19} color={colors.primary} /><Text variant="label" style={{ color: colors.primary, fontWeight: "500" }}>Bumalik</Text></Pressable>;
}
export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.residentBackground }, brandHeader: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 20, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, brandIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" }, brandName: { color: "#14244B", fontWeight: "600", letterSpacing: -0.3 }, brandCaption: { color: "#64748B", marginTop: 4 }, formCard: { width: "100%", maxWidth: 520, alignSelf: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 22, padding: 20 }, back: { flexDirection: "row", alignItems: "center", justifyContent: "center", alignSelf: "flex-start", gap: 4, minHeight: 44, paddingHorizontal: 10, borderRadius: 13, backgroundColor: "#F3F5FA", overflow: "hidden" }, inputBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, backgroundColor: "#FAFBFD" }, passwordEye: { width: 40, minHeight: 48, alignItems: "center", justifyContent: "center" }, pendingCard: { padding: 24, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 22 }, pendingIcon: { width: 64, height: 64, borderRadius: 21, backgroundColor: "#FFF4DF", alignItems: "center", justifyContent: "center", marginBottom: 20 },
});
