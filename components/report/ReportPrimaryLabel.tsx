import { Text } from "@/components/AppText";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Ionicons } from "@/components/AppIcon";

/** Consistent label and directional cue for report actions. */
export function ReportPrimaryLabel({ children, icon = "arrow-forward" }: {
  children: ReactNode; icon?: keyof typeof Ionicons.glyphMap;
}) {
  return <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}>
    <Text style={{ color: "white", fontSize: 17, lineHeight: 24, fontWeight: "600", flexShrink: 1, textAlign: "center" }}>{children}</Text>
    <Ionicons name={icon} size={18} color="white" style={{ marginLeft: 10 }} />
  </View>;
}
