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
    onPress={onPress} disabled={disabled} hitSlop={4}
    onPressIn={() => setPressed(true)}
    onPressOut={() => setPressed(false)}
    accessibilityRole="button" accessibilityLabel="Bumalik"
    accessibilityState={{ disabled }}
    android_ripple={{ color: "transparent" }}
    // Use concrete styles so the surface survives NativeWind's Pressable interop.
    style={[styles.button, showLabel ? styles.labelled : styles.iconOnly, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
  >
    <Ionicons name="chevron-back" size={showLabel ? 20 : 22} color={colors.primary} />
    {showLabel && <Text variant="label" style={styles.label}>Bumalik</Text>}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#FFFFFF",
    minHeight: 46, minWidth: 46, borderRadius: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    alignSelf: "flex-start", gap: 5, shadowColor: "#14244B", shadowOpacity: 0.045, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  labelled: { paddingLeft: 11, paddingRight: 16, paddingVertical: 10 },
  iconOnly: { width: 46, height: 46 },
  pressed: { backgroundColor: "#FFFFFF", transform: [{ scale: 0.97 }], shadowOpacity: 0, elevation: 0 },
  disabled: { opacity: 0.45 },
  label: { color: colors.primary, fontWeight: "600" },
});
