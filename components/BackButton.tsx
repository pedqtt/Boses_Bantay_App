import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * The one back-navigation control used at the top-left of every header in
 * the app that isn't a tab root (report flow, bot chat) — same icon, same
 * color, same tap-target size everywhere, so "how do I go back" is answered
 * once and never has to be relearned screen to screen.
 *
 * Deliberately a plain icon, not a filled circle like the app's colored
 * action buttons (call, mic, etc.) — this is a navigational control, not a
 * primary action, and giving it the same visual weight as "call for help"
 * or "start recording" would blur that distinction. The 44x44 tap target
 * still meets the app's touch-target minimum for elderly/low-dexterity
 * users; it's just invisible until pressed, via hitSlop, rather than drawn
 * as a visible badge.
 */
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Bumalik"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 16 }}
      className="active:opacity-60"
      style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center", marginLeft: -4 }}
    >
      <Ionicons name="chevron-back" size={24} color="#374151" />
    </Pressable>
  );
}
