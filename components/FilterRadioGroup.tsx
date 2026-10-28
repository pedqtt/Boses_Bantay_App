import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { colors } from "@/lib/theme";

export function FilterRadioGroup<T extends string>({ title, value, options, onChange, separated = false }: {
  title: string; value: T; options: readonly { id: T; label: string }[];
  onChange: (value: T) => void; separated?: boolean;
}) {
  return <View style={[styles.section, separated && styles.separated]}>
    <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={title}>
      {options.map(option => {
        const selected = value === option.id;
        return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: selected }} onPress={() => onChange(option.id)} android_ripple={{ color: "rgba(2,31,148,0.04)" }} style={[styles.row, selected && styles.selected]}>
          <View pointerEvents="none" accessible={false} style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.dot} />}</View>
          <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 8 },
  separated: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E1E7EF" },
  heading: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: "#52617A", paddingHorizontal: 10 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, marginBottom: 2, overflow: "hidden" },
  selected: { backgroundColor: "#F0F4FC" },
  label: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21, fontWeight: "400", color: "#26344A" },
  labelSelected: { fontWeight: "600", color: colors.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#768399", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  radioSelected: { borderColor: colors.primary, borderWidth: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
