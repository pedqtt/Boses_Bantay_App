import { useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";
import {
  REVIEW_SECTIONS,
  IDENTITY_CONFIRM_COPY,
  getQuestion,
  type ReportFieldKey,
} from "@/lib/reportQuestions";
import { isFieldApplicable } from "@/lib/reportFlow";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { FormField } from "@/components/FormField";
import { FormChoiceField } from "@/components/FormChoiceField";
import { PhoneInput } from "@/components/PhoneInput";
import {
  toLocalPhoneDigits,
  normalizeAgeDigits,
  getAgeError,
  AGE_MAX_DIGITS,
  AGE_REQUIREMENTS_HINT,
} from "@/lib/validation";
import type { AnswersMap } from "./types";

type ConfirmYouScreenProps = {
  answers: AnswersMap;
  onSelectChoice: (key: ReportFieldKey, value: string, label: string) => void;
  onChangeAnswerText: (key: ReportFieldKey, text: string) => void;
  onNext: () => void;
};

// Bahagi 1 lives in REVIEW_SECTIONS too (as the first, collapsed-by-default
// group on the final review screen) - pulled from there rather than
// hardcoded here, so the field list can never drift between "the screen
// that introduces you" and "the review section that summarizes you" at
// the end.
const SECTION = REVIEW_SECTIONS.find((s) => s.key === "nagrereklamo")!;

/**
 * The actual first step of the live flow - not just a section on the final
 * review screen. Its fields read as "a form like the one you signed up
 * with" (FormField, FormChoiceField, PhoneInput, the same underlined-field
 * language as register.tsx and login.tsx). This is Bahagi 1; the chunk
 * screens are 2 through TOTAL_BAHAGI - see TOTAL_BAHAGI's doc comment in
 * reportQuestions.ts.
 *
 * Every value is prefilled from the account (applyProfile in report.tsx),
 * so this is a confirm-and-correct screen, not a re-ask - fields start
 * populated and stay fully editable, same as register.tsx's fields do
 * before submission.
 *
 * Header/chrome is owned by report.tsx now, not this screen - see
 * IntroScreen's doc comment for why.
 */
export function ConfirmYouScreen({
  answers,
  onSelectChoice,
  onChangeAnswerText,
  onNext,
}: ConfirmYouScreenProps) {
  const fields = SECTION.fields.filter((key) => isFieldApplicable(key, answers));

  const missing = fields.filter((key) => {
    const q = getQuestion(key);
    const isRequired =
      q.required || (key === "guardianName" && answers.filedByGuardian?.value === "guardian");
    return isRequired && !answers[key]?.text.trim();
  });

  // Age is the one field on this screen that isn't just "filled or not" -
  // a value can be present and still be wrong (a stray digit, "0", "999").
  // Checked separately from `missing` since an out-of-range age is a
  // different problem than an empty one and needs its own message (see
  // getAgeError), but it still has to block advancing the same way an
  // empty required field does - a resident shouldn't be able to carry a
  // typo'd age all the way to a submitted legal document.
  const ageValue = answers.complainantAge?.text ?? "";
  const ageError = ageValue.trim() ? getAgeError(ageValue) : null;

  const canAdvance = missing.length === 0 && !ageError;

  const { scrollRef, handleFocus, handleContainerLayout, handleScroll, keyboardSpacer } =
    useKeyboardFocusScroll();

  // "Next" on the keyboard walks straight down the voice fields in the
  // order they're rendered, same convention as register.tsx.
  const refs = useRef<Partial<Record<ReportFieldKey, TextInput | null>>>({});
  const voiceFields = fields.filter((k) => getQuestion(k).inputType === "voice");

  return (
    <>
      <ScrollView
        ref={scrollRef}
        onLayout={handleContainerLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        className="px-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 56 + keyboardSpacer }}
      >
        <View className="mb-10">
          <Text className="text-[28px] font-semibold text-ink tracking-tight mb-2">
            {IDENTITY_CONFIRM_COPY.heading}
          </Text>
          <Text className="text-[15px] text-ink-soft leading-7">
            {IDENTITY_CONFIRM_COPY.body}
          </Text>
        </View>

        {fields.map((key, i) => {
          const q = getQuestion(key);
          const a = answers[key];
          const isMissing = missing.includes(key);
          const errorText =
            key === "complainantAge"
              ? isMissing
                ? "Kailangan pong sagutin ito."
                : ageError
              : isMissing
                ? "Kailangan pong sagutin ito."
                : null;

          if (q.inputType !== "voice") {
            return (
              <FormChoiceField
                key={key}
                label={q.label}
                options={q.options ?? []}
                value={a?.value}
                onSelect={(value, label) => onSelectChoice(key, value, label)}
                error={errorText}
              />
            );
          }

          const voiceIndex = voiceFields.indexOf(key);
          const nextVoiceKey = voiceFields[voiceIndex + 1];

          // Same PhoneInput used by register.tsx and login.tsx - fixed
          // "+63" label, digit-only entry, auto-grouped "0917 123 4567"
          // display - instead of a plain text field with a phone
          // keypad. A resident who just filled this exact field in at
          // signup shouldn't see it work differently here.
          if (key === "complainantContact") {
            return (
              <View key={key} className="mb-7">
                <PhoneInput
                  ref={(el) => {
                    refs.current[key] = el;
                  }}
                  label={q.label}
                  digits={toLocalPhoneDigits(a?.text)}
                  onChangeDigits={(digits) => onChangeAnswerText(key, digits)}
                  onFocus={handleFocus}
                  autoFocus={i === 0}
                  error={errorText}
                  returnKeyType={nextVoiceKey ? "next" : "done"}
                  onSubmitEditing={
                    nextVoiceKey ? () => refs.current[nextVoiceKey]?.focus() : undefined
                  }
                />
              </View>
            );
          }

          return (
            <FormField
              key={key}
              ref={(el) => {
                refs.current[key] = el;
              }}
              label={q.label}
              value={a?.text ?? ""}
              onChangeText={(text) =>
                onChangeAnswerText(
                  key,
                  key === "complainantAge" ? normalizeAgeDigits(text) : text
                )
              }
              onFocus={handleFocus}
              placeholder={q.placeholder ?? ""}
              keyboardType={key === "complainantAge" ? "number-pad" : "default"}
              maxLength={key === "complainantAge" ? AGE_MAX_DIGITS : undefined}
              hint={key === "complainantAge" ? AGE_REQUIREMENTS_HINT : undefined}
              autoFocus={i === 0}
              error={errorText}
              returnKeyType={nextVoiceKey ? "next" : "done"}
              onSubmitEditing={
                nextVoiceKey ? () => refs.current[nextVoiceKey]?.focus() : undefined
              }
            />
          );
        })}
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
            <Text className="text-white font-semibold text-[18px]">
              {IDENTITY_CONFIRM_COPY.confirm}
            </Text>
          </Pressable>
        </AuthActionGroup>
      </View>
    </>
  );
}
