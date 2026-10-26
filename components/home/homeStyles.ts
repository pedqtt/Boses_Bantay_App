import { StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

// Shared visual rules for the Home content and its notification preview.
export const homeStyles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 20 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  sectionTitle: { fontSize: 18, lineHeight: 26, fontWeight: "600", color: "#172033" },
  itemTitle: { fontSize: 15, lineHeight: 22, fontWeight: "600", color: "#172033" },
  itemIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" },
  headerButton: { width: 48, height: 48, flexShrink: 0, borderRadius: 16, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E3E8F0" },
  link: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.residentTint, overflow: "hidden" },
  linkText: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: colors.primary },
  metadata: { fontSize: 11, lineHeight: 18, color: "#64748B" },
});
