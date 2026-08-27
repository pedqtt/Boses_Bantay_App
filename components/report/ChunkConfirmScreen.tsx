import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import {
  CONFIRM_COPY,
  getQuestion,
  type Chunk,
  type ReportFieldKey,
} from "@/lib/reportQuestions";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { AnswerEditor } from "./AnswerEditor";
import type { AnswersMap } from "./types";

type ChunkConfirmScreenProps = {
  chunk: Chunk;
  index: number;
  answers: AnswersMap;
  /** Which field is currently expanded for inline editing, if any. */
  editingKey: ReportFieldKey | null;
  onStartEditing: (key: ReportFieldKey) => void;
  onChangeAnswerText: (key: ReportFieldKey, text: string) => void;
  onConfirm: () => void;
  onReRecord: () => void;
};

/**
 * Chunks 2 and 3, when chunk 1's extraction already answered them.
 *
 * This screen is the entire payoff of the redesign. The resident told their
 * story once; the fields it contained are shown back to them as cards they
 * can accept with a single tap. A complete story means this replaces two
 * more recordings with two taps.
 *
 * It is deliberately NOT a silent auto-fill. Every value here was produced
 * by a model, and it lands on a legal document, so the resident sees each one
 * and either accepts or corrects it before it counts. That's the third
 * safety rule from the redesign plan: nothing submits unconfirmed.
 *
 * Header/chrome is owned by report.tsx now, not this screen - see
 * IntroScreen's doc comment for why.
 */
export function ChunkConfirmScreen({
  chunk,
  index,
  answers,
  editingKey,
  onStartEditing,
  onChangeAnswerText,
  onConfirm,
  onReRecord,
}: ChunkConfirmScreenProps) {
  // Only show cards for fields this chunk is responsible for AND that
  // extraction actually found. A field the model missed isn't rendered as an
  // empty card here - it's picked up on the review screen, or the resident
  // re-records. Showing blank cards would just be noise.
  const found = chunk.extracts.filter((key) => answers[key]?.text.trim());
  const missingRequired = chunk.extracts.filter(
    (key) => getQuestion(key).required && !answers[key]?.text.trim()
  );

  return (
    <>
      {/* Same keyboard-covers-the-field problem as ChunkRecordScreen:
          tapping "Baguhin" opens an AnswerEditor that can sit low enough in
          the list to land right behind the keyboard. KeyboardAwareScrollView
          scrolls it clear on focus; bottomOffset smaller than the auth
          screens' default since this AnswerEditor has no hint/error line
          under it, so its own bottom edge can sit right above the
          keyboard. */}
      <KeyboardAwareScrollView
        bottomOffset={16}
        className="flex-1 px-8"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 56 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Same 28px semibold heading + 15px soft body as
            ConfirmYouScreen's, instead of REPORT_TYPE's 24px question /
            15px subtitle pairing - same two-line job ("Ito po ba ang
            tama?" here, "Kayo po ba ito?" there), same weight. */}
        <Text className="text-[28px] font-semibold text-ink tracking-tight mb-2">
          {CONFIRM_COPY.heading}
        </Text>
        <Text className="text-[15px] text-ink-soft leading-7 mb-8">{CONFIRM_COPY.body}</Text>

        {found.map((key) => {
          const q = getQuestion(key);
          const a = answers[key];
          const isEditing = editingKey === key;

          return (
            <View key={key} className="mb-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name={q.icon as any} size={15} color={colors.onSurfaceVariant} />
                <Text className={`${REPORT_TYPE.fieldLabel} ml-1.5`}>{q.label}</Text>
              </View>

              {isEditing ? (
                <AnswerEditor
                  value={a.text}
                  onChangeText={(text) => onChangeAnswerText(key, text)}
                  placeholder={q.placeholder ?? ""}
                  isTranscribing={false}
                />
              ) : (
                <Pressable
                  onPress={() => onStartEditing(key)}
                  className="flex-row items-start justify-between rounded-2xl px-4 py-3.5 bg-white border border-gray-200 active:opacity-70"
                >
                  <Text className={`${REPORT_TYPE.body} flex-1`}>{a.text}</Text>
                  <Text className={`${REPORT_TYPE.linkBrand} ml-3`}>{CONFIRM_COPY.edit}</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {missingRequired.length > 0 && (
          <View className="flex-row items-start bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-2">
            <Ionicons name="information-circle-outline" size={18} color={colors.onSurfaceVariant} />
            <Text className={`${REPORT_TYPE.caption} ml-2 flex-1`}>
              Hindi po namin narinig ang{" "}
              {missingRequired.map((k) => getQuestion(k).label.toLowerCase()).join(" at ")}.
              Maaari po kayong mag-record ulit, o sagutin ito sa dulo.
            </Text>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* Same bottom action treatment as ConfirmYouScreen - px-8,
          AuthActionGroup, 18px button label. The re-record link now sits
          in AuthActionGroup's `secondary` slot (hairline rule + centered
          link), the same divider convention login/register use for
          "Meron nang account?", rather than a second full-width button
          stacked under the first. Still not hidden - a resident whose
          story got mis-heard needs this to be an obvious one-tap escape,
          just styled as the secondary action it actually is. */}
      <View className="px-8" style={{ paddingBottom: 32 }}>
        <AuthActionGroup
          secondary={
            <Pressable onPress={onReRecord} className="py-1 items-center active:opacity-70">
              <Text className="text-[15px] font-medium text-ink-soft">{CONFIRM_COPY.reRecord}</Text>
            </Pressable>
          }
        >
          <Pressable
            onPress={onConfirm}
            className="bg-brand rounded-2xl py-4 items-center overflow-hidden active:opacity-85"
          >
            <Text className="text-white font-semibold text-[18px]">{CONFIRM_COPY.confirm}</Text>
          </Pressable>
        </AuthActionGroup>
      </View>
    </>
  );
}
