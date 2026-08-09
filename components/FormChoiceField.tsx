import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";
import type { QuestionOption } from "@/lib/reportQuestions";

type FormChoiceFieldProps = {
  label: string;
  options: QuestionOption[];
  value: string | undefined;
  onSelect: (value: string, label: string) => void;
  error?: string | null;
  wrapperClassName?: string;
  /** Decision-support text shown under the label, above the options - same
   *  role as FormField's `hint`, for a choice field that needs more than
   *  its label to pick correctly (e.g. explaining what "Record Only" vs
   *  "Summons" actually means). */
  hint?: string;
  /** Small "Mungkahi" badge next to the label when the current value came
   *  from extraction rather than a resident's tap - a head start, never a
   *  decision made on their behalf, so it has to stay visibly distinct
   *  from a value they actually chose. */
  suggested?: boolean;
};

/**
 * The choice-field companion to FormField, styled to match the same auth
 * form language rather than the report flow's filled chip picker
 * (ChoiceStep): a vertical list of rows under a small uppercase label,
 * separated by hairlines - the same flat language as register.tsx's
 * underlined text fields and its consent checkbox row.
 *
 * Same underline convention as FormField (a bottom hairline, no boxed
 * container) - just the one line under the whole group, no dividers
 * between individual options either, so this reads as "a form field,"
 * not "a card" or a list of separate rows. The selected option gets a
 * light brand-blue shade (`brand-50`, the same "suggested/selected" tint
 * used elsewhere in the report flow - e.g. the "Mungkahi" chip on
 * DetailsScreen) behind just that row, plus a filled checkmark instead of
 * a plain radio dot - unambiguous at a glance that the tap registered the
 * selection the resident meant, without adding any border or box.
 */
export function FormChoiceField({
  label,
  options,
  value,
  onSelect,
  error,
  wrapperClassName,
  hint,
  suggested,
}: FormChoiceFieldProps) {
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
      {hint && <Text className="text-[13px] text-ink-faint leading-5 mb-2.5">{hint}</Text>}
      <View className="border-b border-gray-200">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onSelect(opt.value, opt.label)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`flex-row justify-between px-2 py-3.5 active:opacity-70 ${
                selected ? "bg-brand-50" : ""
              }`}
              // items-center for a plain one-line option, items-start when
              // it carries its own description line - centering the
              // checkmark against two lines of text would float it
              // awkwardly between them instead of level with the label.
              style={{ alignItems: opt.description ? "flex-start" : "center" }}
            >
              <View className="flex-1 mr-3">
                <Text
                  className={`text-[17px] ${selected ? "text-brand-dark font-semibold" : "text-ink"}`}
                >
                  {opt.label}
                </Text>
                {/* Per-option decision support, read right next to the
                    label it explains - see QuestionOption's doc comment
                    for why this replaced a single hint paragraph above
                    the whole picker. */}
                {opt.description && (
                  <Text
                    className={`text-[13px] leading-5 mt-1 ${
                      selected ? "text-brand-dark" : "text-ink-faint"
                    }`}
                  >
                    {opt.description}
                  </Text>
                )}
              </View>
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={selected ? colors.primary : colors.outline}
                style={{ marginTop: opt.description ? 2 : 0 }}
              />
            </Pressable>
          );
        })}
      </View>
      {error && <Text className="text-[13px] text-alert mt-1.5">{error}</Text>}
    </View>
  );
}
