import { Text } from "@/components/AppText";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";

/** Shared visual treatment for report instructions; content stays with its screen. */
export function GuideCard({ title = "Gabay", icon = "bulb-outline", neutral = false, children }: {
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  neutral?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ backgroundColor: neutral ? "#FFFFFF" : "#F0F3FC",
      borderColor: "#DDE3EE", borderWidth: 1, borderRadius: 20, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: neutral ? colors.residentTint : "#FFFFFFB3", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
          <Ionicons name={icon} size={17} color={colors.primary} />
        </View>
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, fontWeight: "700", color: colors.primary, letterSpacing: 0.7 }}>{title}</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#DFE5F2", marginHorizontal: 18 }} />
      <View style={{ padding: 18, paddingTop: 16 }}>{children}</View>
    </View>
  );
}
