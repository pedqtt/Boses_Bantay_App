import { Text } from "@/components/AppText";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";

type StatusFilter = "all" | "active" | "closed";
export function ReportsOverview({ total, active, closed, unavailable, partial, selected, onSelect }: {
  total: number; active: number; closed: number; unavailable: boolean; partial: boolean;
  selected: StatusFilter; onSelect: (filter: StatusFilter) => void;
}) {
  const metrics: { id: StatusFilter; label: string; count: number; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "all", label: "Kabuuan", count: total, icon: "documents-outline" },
    { id: "active", label: "Aktibo", count: active, icon: "time-outline" },
    { id: "closed", label: "Tapos na", count: closed, icon: "checkmark-circle-outline" },
  ];
  return <View style={styles.card} accessibilityLabel={partial ? "Buod ng mga report na na-load" : "Buod ng inyong mga report"}>
    <View style={styles.row}>
      {metrics.map((metric, index) => <View key={metric.id} style={[styles.column, index > 0 && styles.separator]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${metric.label}, ${unavailable ? "kinukuha ang datos" : metric.count + " reports"}`}
          accessibilityState={{ selected: selected === metric.id }} onPress={() => onSelect(metric.id)}
          className="active:opacity-70" style={[styles.metric, selected === metric.id && styles.selected]}>
          <Ionicons name={metric.icon} size={18} color={selected === metric.id ? colors.primary : colors.onSurfaceVariant} />
          <Text style={styles.count}>{unavailable ? "—" : metric.count}</Text>
          <Text style={[styles.label, selected === metric.id && styles.selectedLabel]}>{metric.label}</Text>
        </Pressable>
      </View>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderColor: "#E2E6EF", borderWidth: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 6, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "stretch" },
  column: { flex: 1, paddingHorizontal: 4 },
  separator: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#E5E9F1" },
  metric: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", minHeight: 112 },
  selected: { backgroundColor: colors.residentTint },
  count: { color: colors.onSurface, fontSize: 28, lineHeight: 36, fontWeight: "600", fontVariant: ["tabular-nums"], marginTop: 8 },
  label: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, marginTop: 3, fontWeight: "500", textAlign: "center" },
  selectedLabel: { color: colors.primary, fontWeight: "600" },
});
