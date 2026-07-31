import { View, Text, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { CHAPTERS, REPORT_QUESTIONS, type ReportFieldKey } from "@/lib/reportQuestions";
import { AnswerEditor } from "./AnswerEditor";
import type { AnswersMap } from "./types";

type ReviewScreenProps = {
  answers: AnswersMap;
  submitting: boolean;
  stillTranscribing: boolean;
  onChangeAnswerText: (key: ReportFieldKey, text: string) => void;
  onSubmit: () => void;
  onBackToQuestions: () => void;
};

/**
 * The full report, grouped by the same 3 chapters used during the interview
 * — a resident proofreading their answers should see the same structure
 * they just walked through, not a flat re-numbered list. Reuses
 * AnswerEditor for every field, same as the step screen, so a fix to how
 * errors/missing-fields render only ever needs to happen in one place.
 */
export function ReviewScreen({
  answers,
  submitting,
  stillTranscribing,
  onChangeAnswerText,
  onSubmit,
  onBackToQuestions,
}: ReviewScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text className={`${REPORT_TYPE.heroTitle} mb-2`}>Suriin ang report</Text>
          <Text className={`${REPORT_TYPE.subtitle} mb-8`}>Itama po ang anumang mali bago ipasa.</Text>

          {CHAPTERS.map((chapter) => {
            const chapterQuestions = REPORT_QUESTIONS.filter((q) => q.chapter === chapter.key);
            return (
              <View key={chapter.key} className="mb-7">
                <Text className={`${REPORT_TYPE.eyebrowBrand} mb-3`}>{chapter.label}</Text>
                {chapterQuestions.map((q) => {
                  const globalIndex = REPORT_QUESTIONS.findIndex((x) => x.key === q.key);
                  const a = answers[q.key];
                  const isMissing = q.required && !a.text.trim();
                  return (
                    <View key={q.key} className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Ionicons name={q.icon as any} size={15} color="#4B5563" />
                        <Text className={`${REPORT_TYPE.fieldLabel} ml-1.5`}>
                          {globalIndex + 1}. {q.label}
                        </Text>
                        {!q.required && <Text className={`${REPORT_TYPE.caption} ml-2`}>(opsyonal)</Text>}
                      </View>

                      <AnswerEditor
                        value={a.text}
                        onChangeText={(text) => onChangeAnswerText(q.key, text)}
                        placeholder={q.placeholder}
                        isTranscribing={a.status === "transcribing"}
                        tall={q.key === "description"}
                        errorMessage={a.status === "error" ? a.error : undefined}
                        missingMessage={isMissing ? "Kailangan pong sagutin ito." : undefined}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}

          {stillTranscribing && (
            <Text className={`${REPORT_TYPE.caption} text-center mb-3`}>
              May mga sagot pa pong ginagawa. Maaari po kayong maghintay o i-type na lang.
            </Text>
          )}

          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            className="bg-brand rounded-2xl py-4 items-center active:opacity-85 mb-3"
          >
            {submitting ? <ActivityIndicator color="white" /> : <Text className={REPORT_TYPE.buttonPrimary}>Ipasa ang report</Text>}
          </Pressable>
          <Pressable onPress={onBackToQuestions} disabled={submitting} className="py-3 items-center active:opacity-70 mb-8">
            <Text className={REPORT_TYPE.buttonSecondary}>Bumalik sa mga tanong</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
