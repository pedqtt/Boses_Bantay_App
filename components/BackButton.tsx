import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * The one back-navigation control used at the top-left of every header in
 * the app that isn't a tab root (report flow, bot chat, ID verification)  - 
 * same icon, same label, same color everywhere, so "how do I go back" is
 * answered once and never has to be relearned screen to screen.
 *
 * The word "Bumalik" sits right next to the chevron now - an icon alone
 * reads as "arrow," not "this takes me back," to a resident who isn't
 * confident reading UI conventions (the same reasoning behind pairing
 * every icon with text elsewhere in the app: "icons always paired with
 * text, never rely on icon alone"). Icon and label are one Pressable, not
 * two - there's exactly one tap target, not a icon-only hitbox next to a
 * separate, non-interactive label that looks tappable but isn't.
 *
 * Deliberately plain text + icon, not a filled circle like the app's
 * colored action buttons (call, mic, etc.) - this is a navigational
 * control, not a primary action, and giving it that same visual weight
 * would blur the distinction. hitSlop still pads the tap target well past
 * the visible text for the app's touch-target minimum.
 */
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Bumalik"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
      className="flex-row items-center active:opacity-60"
      style={{ marginLeft: -4, paddingVertical: 4 }}
    >
      <Ionicons name="chevron-back" size={24} color="#374151" />
      <Text className="text-[15px] font-medium text-ink-soft ml-0.5">Bumalik</Text>
    </Pressable>
  );
}
