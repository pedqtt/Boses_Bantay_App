import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

type FormCheckboxFieldProps = {
  label: string;
  checkboxLabel: string;
  checked: boolean;
  onToggle: () => void;
  /** Same "Mungkahi" badge FormChoiceField shows when the current value
   *  came from extraction rather than a resident's own tap. */
  suggested?: boolean;
  wrapperClassName?: string;
};

/**
 * The checkbox companion to FormChoiceField - one yes/no decision instead
 * of a pick among several options, but built from the exact same pieces:
 * uppercase label row (with the same optional "Mungkahi" badge), a single
 * bottom-hairline-bordered row below it, brand-tinted fill when checked, a
 * filled circle icon instead of a plain radio dot.
 *
 * FIXED: the CCTV question used to be its own thing - a plain
 * Pressable + square checkbox + sibling label, no label row, no hairline,
 * no selected-state tint - so a resident scanning straight down this
 * screen's fields hit one different-looking control right at the end.
 * Same field language throughout now; the only difference from
 * FormChoiceField is that there's exactly one row to tap instead of a
 * list, since "gusto ninyong i-review ang CCTV" only has one thing to
 * turn on - there's no meaningful un-checked *option* to show alongside
 * it the way "Record Only" needs "Summons" next to it to make sense.
 */
export function FormCheckboxField({
  label,
  checkboxLabel,
  checked,
  onToggle,
  suggested,
  wrapperClassName,
}: FormCheckboxFieldProps) {
  return (
    <View className={wrapperClassName ?? "mb-7"}>
      <View className="flex-row items-center mb-2">
        <Text className="text-[12px] font-semibold text-ink-faint uppercase tracking-wider flex-1">
          {label}
        </Text>
        {suggested && (
          <View className="bg-brand-50 rounded-full px-2.5 py-1">
            <Text className="text-[11px] font-semibold text-brand-dark">Mungkahi</Text>
          </View>
        )}
      </View>
      <View className="border-b border-gray-200">
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          className={`flex-row items-center justify-between px-2 py-3.5 active:opacity-70 ${
            checked ? "bg-brand-50" : ""
          }`}
        >
          <Text
            className={`flex-1 mr-3 text-[17px] ${
              checked ? "text-brand-dark font-semibold" : "text-ink"
            }`}
          >
            {checkboxLabel}
          </Text>
          <Ionicons
            name={checked ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={checked ? colors.primary : colors.outline}
          />
        </Pressable>
      </View>
    </View>
  );
}
