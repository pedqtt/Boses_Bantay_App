import { useState } from "react";
import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { Text } from "@/components/AppText";
import { colors } from "@/lib/theme";

type AuthLinkProps = { label: string; onPress: PressableProps["onPress"]; subtle?: boolean };

/** Secondary auth navigation with a generous touch target and consistent feedback. */
export function AuthLink({ label, onPress, subtle = false }: AuthLinkProps) {
  const [pressed, setPressed] = useState(false);
  return <Pressable
    onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    accessibilityRole="link" accessibilityLabel={label}
    android_ripple={{ color: "transparent" }}
    style={[styles.link, subtle && styles.subtle, pressed && styles.pressed]}
  >
    <Text variant="label" style={styles.label}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#EDF3FF", borderWidth: 1, borderColor: "#B9CBEB", alignSelf: "center", maxWidth: "100%" },
  subtle: { backgroundColor: "#F6F8FC", borderColor: "#E1E7F2" },
  pressed: { backgroundColor: "#DCE7FA", borderColor: "#9BB1DA" },
  label: { color: colors.primary, fontWeight: "600", flexShrink: 1 },
});
