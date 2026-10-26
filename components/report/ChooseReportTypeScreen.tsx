import { Text } from "@/components/AppText";
import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";

type ReportTypeOption = {
  key: "blotter" | "serviceComplaint";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  examples: string[];
  tint: string;
  accent: string;
};
const OPTIONS: ReportTypeOption[] = [
  { key: "blotter", icon: "people-outline", title: "Blotter report", body: "Para sa away, sigalot, o insidenteng may kinalaman sa ibang tao.", examples: ["Banta", "Pananakit", "Sigalot sa kapitbahay"], tint: colors.residentTint, accent: colors.primary },
  { key: "serviceComplaint", icon: "construct-outline", title: "Service complaint", body: "Para sa problema sa kalsada, ilaw, basura, o pasilidad sa inyong lugar.", examples: ["Sirang ilaw", "Bukas na kanal", "Hindi nakolektang basura"], tint: "#FFF5E4", accent: "#8A5C12" },
];

export function ChooseReportTypeScreen({ onSelect }: { onSelect: (type: ReportTypeOption["key"]) => void }) {
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
    <View style={s.introduction}><Text accessibilityRole="header" style={s.heading}>Ano ang inyong concern?</Text><Text style={s.subtitle}>Piliin ang uri ng report para makapagsimula.</Text></View>
    <View style={s.options}>
      {OPTIONS.map(option => <Pressable key={option.key} onPress={() => onSelect(option.key)} accessibilityRole="button" accessibilityLabel={`${option.title}. ${option.body}`} accessibilityHint="Buksan ang form para sa uri ng report na ito" android_ripple={{ color: "rgba(2,31,148,0.04)" }} style={s.card}>
        <View style={s.cardContent}>
          <View style={s.titleRow}><View style={[s.icon, { backgroundColor: option.tint }]}><Ionicons name={option.icon} size={24} color={option.accent} /></View><Text style={s.title}>{option.title}</Text><View style={s.arrow}><Ionicons name="arrow-forward" size={18} color={option.accent} /></View></View>
          <Text style={s.description}>{option.body}</Text>
        </View>
        <View style={s.examples}>
          <Text style={s.examplesLabel}>Halimbawa</Text>
          <View style={s.tags}>{option.examples.map(example => <View key={example} style={[s.tag, { backgroundColor: option.tint }]}><Text style={[s.tagText, { color: option.accent }]}>{example}</Text></View>)}</View>
        </View>
      </Pressable>)}
    </View>
  </ScrollView>;
}
const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 }, introduction: { marginBottom: 24 }, heading: { fontSize: 25, lineHeight: 33, fontWeight: "600", letterSpacing: -0.5, color: "#172033" }, subtitle: { fontSize: 14, lineHeight: 22, color: "#64748B", marginTop: 8 }, options: { gap: 16 },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 22, overflow: "hidden" }, cardContent: { padding: 20, paddingBottom: 18 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 12 }, icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" }, title: { flex: 1, minWidth: 0, fontSize: 18, lineHeight: 25, fontWeight: "600", color: "#172033", letterSpacing: -0.2 }, arrow: { width: 30, height: 36, borderRadius: 12, backgroundColor: "#F6F7FB", alignItems: "center", justifyContent: "center" }, description: { fontSize: 14, lineHeight: 23, color: "#52617A", marginTop: 15 },
  examples: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E7EBF2" }, examplesLabel: { fontSize: 11, lineHeight: 18, fontWeight: "500", color: "#64748B", marginBottom: 8 }, tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, tag: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }, tagText: { fontSize: 11, lineHeight: 17, fontWeight: "500" },
});
