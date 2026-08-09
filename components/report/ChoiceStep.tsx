import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import type { ReportQuestion } from "@/lib/reportQuestions";

type ChoiceStepProps = {
  question: ReportQuestion;
  value: string | undefined;
  onSelect: (value: string, label: string) => void;
};

/**
 * The picker used for "choice" and "checkbox" questions — the categorical
 * fields (gender, blotter type, incident category, guardian y/n, CCTV
 * request) that don't belong behind a mic. Narrating "record only" and
 * hoping transcription catches it correctly is worse than just tapping a
 * chip, so these questions skip RecordControls/AnswerEditor entirely and
 * render this instead. Same slot in StepScreen/ReviewScreen either way —
 * see the inputType branch in both.
 *
 * Tagalog-only, matching every other label in the report flow — no English
 * caption underneath.
 */
export function ChoiceStep({ question, value, onSelect }: ChoiceStepProps) {
  if (question.inputType === "checkbox") {
    const checked = value === "true";
    return (
      <Pressable
        onPress={() => onSelect(checked ? "false" : "true", checked ? "" : question.checkboxLabel ?? "Oo")}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 active:opacity-80"
      >
        <Ionicons
          name={checked ? "checkbox" : "square-outline"}
          size={24}
          color={checked ? colors.primary : colors.outline}
        />
        <View className="flex-1 ml-3">
          <Text className={REPORT_TYPE.body}>{question.checkboxLabel}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {question.options?.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value, opt.label)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`flex-row items-center justify-between rounded-2xl px-4 py-4 active:opacity-85 ${
              selected ? "bg-brand" : "bg-gray-50 border border-gray-200"
            }`}
          >
            <View>
              <Text className={selected ? "text-white font-semibold text-[17px]" : `${REPORT_TYPE.body} font-semibold`}>
                {opt.label}
              </Text>
            </View>
            {selected && <Ionicons name="checkmark-circle" size={22} color="white" />}
          </Pressable>
        );
      })}
    </View>
  );
}
