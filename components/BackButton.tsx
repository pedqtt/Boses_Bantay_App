import { useState } from "react";
import { Text } from "@/components/AppText";
import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";

type BackButtonProps = {
  onPress: PressableProps["onPress"];
  disabled?: boolean;
  showLabel?: boolean;
};

export function BackButton({ onPress, disabled = false, showLabel = true }: BackButtonProps) {
  const [pressed, setPressed] = useState(false);
  return <Pressable
    onPress={onPress} disabled={disabled}
    onPressIn={() => setPressed(true)}
    onPressOut={() => setPressed(false)}
    accessibilityRole="button" accessibilityLabel="Bumalik"
    accessibilityState={{ disabled }}
    android_ripple={{ color: "transparent" }}
    // Use concrete styles so the surface survives NativeWind's Pressable interop.
    style={[styles.button, showLabel ? styles.labelled : styles.iconOnly, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
  >
    <Ionicons name="chevron-back" size={22} color={colors.primary} />
    {showLabel && <Text variant="label" style={styles.label}>Bumalik</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#DEE7F8", borderColor: "#8EA8D8", borderWidth: 1,
    minHeight: 44, minWidth: 44, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    alignSelf: "flex-start", gap: 4,
  },
  labelled: { paddingHorizontal: 10, paddingVertical: 8 },
  iconOnly: { width: 44, height: 44 },
  pressed: { backgroundColor: "#CCDAF2" },
  disabled: { opacity: 0.45 },
  label: { color: colors.primary, fontWeight: "600" },
});
