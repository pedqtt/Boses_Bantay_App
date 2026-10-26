import { StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

/** Report-only finishes, independent of shared app forms. */
export const reportStyles = StyleSheet.create({
  actionBar: {
    paddingHorizontal: 32, paddingTop: 16, paddingBottom: 28,
    backgroundColor: "#FFFFFF", borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  primaryAction: {
    minHeight: 56, borderRadius: 18, justifyContent: "center",
    borderWidth: 1, borderColor: "#FFFFFF30",
  },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1,
    borderColor: "#DDE3EE", borderRadius: 20,
    shadowColor: "#182858", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025, shadowRadius: 8 },
});
