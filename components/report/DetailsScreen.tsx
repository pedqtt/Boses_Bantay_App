import { View, Text, Pressable, ScrollView } from "react-native";
import { DETAILS_FIELD_ORDER, getQuestion, type ReportFieldKey } from "@/lib/reportQuestions";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { FormChoiceField } from "@/components/FormChoiceField";
import { FormCheckboxField } from "@/components/FormCheckboxField";
import type { AnswersMap } from "./types";

type DetailsScreenProps = {
  answers: AnswersMap;
  onSelectChoice: (key: ReportFieldKey, value: string, label: string) => void;
  onNext: () => void;
};

/**
 * Every categorical decision on one screen, no recording anywhere - now
 * built from the same pieces as ConfirmYouScreen (Bahagi 1) instead of its
 * own separate visual language, on request: same header chrome (chevron
 * back, "Bahagi N ng TOTAL_BAHAGI" eyebrow, short label, DraftBadge,
 * segmented progress bar - this is the last of the numbered Bahagi
 * screens), same 28px heading + soft subtitle, same FormChoiceField
 * underlined-row picker instead of ChoiceStep's filled chip cards, same
 * AuthActionGroup bottom button. A resident moving through Bahagi 1 → the
 * three chunks → here sees one continuous design, not a different app for
 * the last step.
 *
 * FIXED while doing this pass: `filedByGuardian`/`guardianName` used to
 * also render here, duplicating the exact same question already asked on
 * Bahagi 1 (see DETAILS_FIELD_ORDER's doc comment in reportQuestions.ts).
 * They're gone from this screen now - Details is purely the decisions
 * nobody narrates (blotter type, incident category, CCTV request).
 *
 * The category chips still carry an LLM suggestion when extraction
 * produced one - marked as a suggestion (FormChoiceField's `suggested`
 * badge), pre-selected, and freely changeable. A head start, never a
 * decision made on the resident's behalf.
 *
 * Header/chrome is owned by report.tsx now, not this screen - see
 * IntroScreen's doc comment for why.
 */
export function DetailsScreen({
  answers,
  onSelectChoice,
  onNext,
}: DetailsScreenProps) {
  const requiredMissing = DETAILS_FIELD_ORDER.some(
    (key) => getQuestion(key).required && !answers[key]?.text.trim()
  );
  const canAdvance = !requiredMissing;

  const requestCctvQ = getQuestion("requestCctv");
  const requestCctvAnswer = answers.requestCctv;
  const requestCctvChecked = requestCctvAnswer?.value === "true";
  const requestCctvSuggested =
    requestCctvAnswer?.source === "extracted" && !requestCctvAnswer?.confirmed;

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        className="px-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 56 }}
      >
        <View className="mb-10">
          <Text className="text-[28px] font-semibold text-ink tracking-tight mb-2">
            Kaunti na lang po.
          </Text>
          <Text className="text-[15px] text-ink-soft leading-7">
            Tukuyin na lang ang klase ng report - hindi na kailangang mag-record.
          </Text>
        </View>

        {DETAILS_FIELD_ORDER.filter((key) => key !== "requestCctv").map((key) => {
          const q = getQuestion(key);
          const a = answers[key];
          const isSuggested = a?.source === "extracted" && !a?.confirmed;

          return (
            <FormChoiceField
              key={key}
              label={q.label}
              options={q.options ?? []}
              value={a?.value}
              onSelect={(value, label) => onSelectChoice(key, value, label)}
              hint={q.hint}
              suggested={isSuggested}
            />
          );
        })}

        {/* Same FormChoiceField-style field as the pickers above it - see
            FormCheckboxField's doc comment for why this used to look
            different. */}
        <FormCheckboxField
          label={requestCctvQ.label}
          checkboxLabel={requestCctvQ.checkboxLabel ?? "Oo"}
          checked={requestCctvChecked}
          onToggle={() =>
            onSelectChoice(
              "requestCctv",
              requestCctvChecked ? "false" : "true",
              requestCctvChecked ? "" : requestCctvQ.checkboxLabel ?? "Oo"
            )
          }
          suggested={requestCctvSuggested}
        />
      </ScrollView>

      <View className="px-8" style={{ paddingBottom: 32 }}>
        <AuthActionGroup>
          <Pressable
            onPress={onNext}
            disabled={!canAdvance}
            className={`rounded-2xl py-4 items-center overflow-hidden ${
              canAdvance ? "bg-brand active:opacity-85" : "bg-gray-300"
            }`}
          >
            <Text className="text-white font-semibold text-[18px]">Suriin ang report</Text>
          </Pressable>
        </AuthActionGroup>
      </View>
    </>
  );
}
