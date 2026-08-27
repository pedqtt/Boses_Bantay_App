import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import type { ReportQuestion } from "@/lib/reportQuestions";

/**
 * The question block for each step: the Tagalog question, Tagalog-only
 * (no English translation), and an optional hint (a genuinely separate
 * thought — an example, not a translation — so it gets its own callout).
 *
 * This used to open with a standalone topic icon in its own circle, floating
 * above the question with nothing else around it. That icon moved into
 * ChapterProgressHeader instead, next to the chapter title it actually
 * belongs to — one representative icon per chapter, shown once, rather than
 * a new orphaned badge appearing at the top of every single step.
 */
export function QuestionPrompt({ question }: { question: ReportQuestion }) {
  return (
    <View>
      <View className="mb-4">
        <Text className={REPORT_TYPE.question}>{question.question}</Text>
      </View>

      {question.hint && (
        <View className="flex-row items-start bg-brand-50 rounded-xl px-3.5 py-3 mb-4">
          <Ionicons name="bulb-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
          <Text className={`${REPORT_TYPE.hint} ml-2 flex-1`}>{question.hint}</Text>
        </View>
      )}
    </View>
  );
}
