import { Text } from "@/components/AppText";
import { View } from "react-native";
import { GuideCard } from "./GuideCard";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
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
        <View className="mb-4">
          <GuideCard><Text className={REPORT_TYPE.hint}>{question.hint}</Text></GuideCard>
        </View>
      )}
    </View>
  );
}
