import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";

type CircleControlVariant = "primary" | "danger" | "secondary";

const VARIANT_STYLES: Record<CircleControlVariant, { bg: string; iconColor: string }> = {
  primary: { bg: "bg-brand", iconColor: "white" },
  danger: { bg: "bg-alert", iconColor: "white" },
  secondary: { bg: "bg-gray-50 border border-gray-300", iconColor: "#374151" },
};

/** Every circular icon button's "frame" is this size, even when the circle
 *  itself is smaller (the secondary/play button is 64px inside this same
 *  112px frame) — that's what keeps every control's vertical center on the
 *  same line regardless of its own size. */
const FRAME_SIZE = 112;

type CircleControlProps = {
  icon: string;
  label: string;
  onPress: () => void;
  variant: CircleControlVariant;
  /** Actual circle diameter — defaults to filling the frame (primary/danger
   *  controls); pass smaller for a control meant to read as secondary. */
  diameter?: number;
  iconSize?: number;
  columnWidth?: number;
};

/**
 * The one "circular icon button + label directly underneath" component used
 * for every recording control (record, stop, play/pause) — previously each
 * of these was written out by hand with its own Pressable, its own frame
 * sizing, and its own label styling, which is exactly how they'd quietly
 * drifted (different min-heights, inconsistent alignment) in earlier passes.
 * One component now owns: the fixed-size frame (so mixed circle sizes still
 * align), the label directly under the button so it's never ambiguous which
 * label belongs to which control, and single-line truncation so a long
 * label can't wrap and break the alignment. Used for every real recording
 * control (record, stop, pause/resume, play/pause) so all of them are
 * unmistakably the same kind of thing at a glance.
 */
export function CircleControl({
  icon,
  label,
  onPress,
  variant,
  diameter = FRAME_SIZE,
  iconSize,
  columnWidth = 116,
}: CircleControlProps) {
  const { bg, iconColor } = VARIANT_STYLES[variant];
  return (
    <View className="items-center" style={{ width: columnWidth }}>
      <View style={{ width: FRAME_SIZE, height: FRAME_SIZE }} className="items-center justify-center">
        <Pressable
          onPress={onPress}
          className={`rounded-full items-center justify-center active:opacity-85 ${bg}`}
          style={{ width: diameter, height: diameter }}
        >
          <Ionicons name={icon as any} size={iconSize ?? Math.round(diameter * 0.3)} color={iconColor} />
        </Pressable>
      </View>
      <Text numberOfLines={1} className={`${REPORT_TYPE.controlLabel} mt-2`}>
        {label}
      </Text>
    </View>
  );
}

export { FRAME_SIZE as CIRCLE_CONTROL_FRAME_SIZE };
