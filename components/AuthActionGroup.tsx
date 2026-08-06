import { View } from "react-native";
import type { ReactNode } from "react";
import { colors } from "@/lib/theme";

/**
 * The bottom action cluster shared by every auth screen: one primary
 * button, a hairline rule, then an optional secondary link.
 *
 * This exists as a component rather than as four copies of the same JSX
 * because those copies had already drifted - different gaps above and
 * below the rule, some screens with a separator and some without, links
 * sitting at different distances from their buttons. Consistency here is
 * a trust signal, not a cosmetic preference: the auth flow is the first
 * thing a resident sees, and a layout that shifts between steps reads as
 * unfinished. Centralizing it means a spacing change happens once and
 * applies to login, register, OTP, forgot-password and reset-password at
 * the same time.
 *
 * Spacing follows the 8px grid: 20px above and below the rule. The rule
 * is gray-200 (#E5E7EB), matching the input underlines used elsewhere in
 * these screens - at gray-100 it was technically present but reading as
 * nothing at all on a lit phone screen, which defeated the point of
 * having a separator. At 1px and this value it still reads as a seam
 * rather than a border: visible enough to do its job of splitting "do
 * the thing" from "I can't do the thing", quiet enough not to compete
 * with the primary button directly above it.
 *
 * `secondary` is optional - reset-password and register have no
 * alternative action, so they render just the button with no trailing
 * rule, rather than a divider with empty space under it.
 */
export function AuthActionGroup({
  children,
  secondary,
}: {
  /** The primary action - normally the screen's filled brand button. */
  children: ReactNode;
  /** Optional secondary link ("Magrehistro", "Bumalik sa Login", etc). */
  secondary?: ReactNode;
}) {
  return (
    <View>
      {children}

      {secondary ? (
        <>
          <View
            style={{
              height: 1,
              backgroundColor: colors.outlineVariant,
              marginTop: 20,
              marginBottom: 20,
            }}
          />
          <View className="items-center">{secondary}</View>
        </>
      ) : null}
    </View>
  );
}
