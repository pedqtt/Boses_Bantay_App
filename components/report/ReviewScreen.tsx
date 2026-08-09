import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";
import {
  toLocalPhoneDigits,
  normalizeAgeDigits,
  getAgeError,
  AGE_MAX_DIGITS,
  AGE_REQUIREMENTS_HINT,
} from "@/lib/validation";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { Card } from "@/components/Card";
import { FormField } from "@/components/FormField";
import { FormChoiceField } from "@/components/FormChoiceField";
import { FormCheckboxField } from "@/components/FormCheckboxField";
import { PhoneInput } from "@/components/PhoneInput";
import {
  CHUNKS,
  POST_BLOTTER_COPY,
  POST_BLOTTER_STEPS,
  getQuestion,
  type ChunkKey,
  type ReportFieldKey,
} from "@/lib/reportQuestions";
import { isFieldApplicable } from "@/lib/reportFlow";
import { AnswerEditor } from "./AnswerEditor";
import type { AnswersMap, ChunksMap } from "./types";

type ReviewScreenProps = {
  answers: AnswersMap;
  chunks: ChunksMap;
  submitting: boolean;
  busy: boolean;
  /** False when a required field is still empty (or still being
   *  transcribed/extracted) - drives the submit button's disabled state.
   *  No more popup naming which fields are missing when tapped; if this is
   *  false the button simply can't be tapped, the same disabled-until-ready
   *  language every other "next" button in this flow already uses. */
  canSubmit: boolean;
  /** Types over a chunk's raw transcript directly - the paragraph itself,
   *  not any field extracted from it (see this file's top comment). */
  onChangeChunkTranscript: (key: ChunkKey, text: string) => void;
  /** Edits a voice/text field in place - same handler ConfirmYouScreen and
   *  the chunk screens use, reused here so "Baguhin" edits the header
   *  in-line instead of navigating anywhere. */
  onChangeAnswerText: (key: ReportFieldKey, text: string) => void;
  /** Picks a choice/checkbox field in place - same handler ConfirmYouScreen
   *  and DetailsScreen use. */
  onSelectChoice: (key: ReportFieldKey, value: string, label: string) => void;
  /** Where a paragraph's "I-record muli" goes - straight to that specific
   *  chunk's record screen, by index into CHUNKS. Recording itself needs
   *  the mic UI, so this is the one edit action that still has to leave
   *  this screen. */
  onJumpToChunk: (index: number) => void;
  onSubmit: () => void;
  onBackToQuestions: () => void;
};

/** Shared header row for each of the three cards below: an eyebrow label
 *  on the left, an edit toggle on the right. Pencil while reading,
 *  checkmark while editing - the icon signals which mode the section is
 *  in, not just the word next to it. */
function SectionHeader({
  label,
  editing,
  onToggle,
}: {
  label: string;
  editing: boolean;
  onToggle: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between mb-1">
      <Text className={REPORT_TYPE.eyebrowBrand}>{label}</Text>
      <Pressable onPress={onToggle} className="flex-row items-center py-2 active:opacity-70" hitSlop={8}>
        <Ionicons
          name={editing ? "checkmark-circle" : "pencil-outline"}
          size={15}
          color={colors.primary}
          style={{ marginRight: 4 }}
        />
        <Text className={REPORT_TYPE.linkBrand}>{editing ? "Tapos" : "Baguhin"}</Text>
      </Pressable>
    </View>
  );
}

/** One field in read mode: icon + label on top, value below so a long
 *  address or full name always has the full card width to wrap into
 *  instead of being squeezed against a right-aligned column. Divided from
 *  its neighbors by a hairline, the same list language Card uses on the
 *  Profile screen - a resident scanning this card sees a series of clearly
 *  separated lines, not one dense paragraph of label/value pairs. */
function FieldRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: string;
  label: string;
  value?: string;
  isLast?: boolean;
}) {
  return (
    <View className={`py-4 ${isLast ? "" : "border-b border-gray-100"}`}>
      <View className="flex-row items-center mb-1.5">
        <Ionicons name={icon as any} size={14} color={colors.onSurfaceVariant} style={{ marginRight: 6 }} />
        <Text className={REPORT_TYPE.fieldLabel}>{label}</Text>
      </View>
      <Text className={value ? REPORT_TYPE.body : `${REPORT_TYPE.body} text-ink-faint`}>
        {value || "Hindi pa nasagot"}
      </Text>
    </View>
  );
}

/**
 * The review screen laid out like the paper blotter it's a draft of: three
 * parts - who's filing, what happened, and the barangay's categorical
 * decisions - each its own Card (the same shared bg-white/border/rounded-2xl
 * surface Profile's Account section uses, imported rather than hand-rolled,
 * so this screen's cards match the app's cards elsewhere) with real space
 * around it, sitting on the same dot-textured surface (ScreenBackground)
 * every Bahagi screen uses - see report.tsx's "Chrome" comment for why
 * that surface and the header (chevron back, eyebrow/label pair, segmented
 * progress bar - all TOTAL_BAHAGI segments filled, "Huling Hakbang" instead
 * of a "Bahagi N ng Y" it isn't) are no longer rendered by this screen
 * directly.
 *
 * Read-mode fields are laid out the way Profile's Account card lists its
 * rows - one per line, icon and label on top, hairline dividers between
 * them - rather than the tighter label-left/value-right line this used
 * before. That earlier layout crammed a right-aligned value against its
 * label on one line, which reads fine for a short value ("Lalaki") but
 * forces a long one (a full address, a full name) to either wrap awkwardly
 * against the right edge or shrink the label column. Value-under-label,
 * full card width, fixes that for every field the same way instead of
 * needing special-casing for the long ones.
 *
 * The incident card shows the story as told - three paragraphs, one per
 * chunk recording, each with a brand-tinted rule down its left edge the way
 * a quoted statement gets set apart from surrounding text. This used to
 * show the incident as nine separately extracted fields (respondent,
 * witnesses, evidence, description, date/time, location...), each its own
 * boxed card. That's the *structured* layer of the three-layer record (see
 * ReportPayload in reportFlow.ts) - useful for search/GIS/DILG rollups, but
 * it's a breakdown of the story, not the story. The structured fields still
 * exist and still get submitted (populated by extraction during the chunk
 * screens, same as before) - they're just not re-decomposed and re-shown
 * here. What's shown and directly editable here is the *raw* layer instead:
 * each chunk's transcript, as spoken or typed, unprocessed.
 *
 * "Baguhin" edits in place instead of navigating away. It used to jump to
 * ConfirmYouScreen or DetailsScreen - fixing a typo in an address meant
 * landing on a whole different screen, then navigating all the way back to
 * see the result. Now the identity and details cards each carry their own
 * expand-to-edit state: tapping "Baguhin" swaps that card's read-only rows
 * for the same input components ConfirmYouScreen and DetailsScreen use
 * (FormField, FormChoiceField, PhoneInput), in place, and "Tapos" swaps it
 * back - same onChangeAnswerText/onSelectChoice handlers those screens
 * call, just from a toggled view on this one.
 *
 * No "kailangan pong sagutin" red text here - every required field is
 * already gated at the point it's collected (ConfirmYouScreen and
 * DetailsScreen both disable "Susunod" until their required fields are
 * filled; chunk 1 disables advancing without a transcript). The one case
 * that isn't caught upstream - an extracted field like "Petsa at oras" or
 * "Lugar" that the model simply missed - used to surface here as a popup
 * naming the gaps only after the resident tapped submit. It doesn't
 * anymore: `canSubmit` just disables the button itself, so there's nothing
 * to dismiss or re-read - filled means tappable, tap means it submits.
 */
export function ReviewScreen({
  answers,
  chunks,
  submitting,
  busy,
  canSubmit,
  onChangeChunkTranscript,
  onChangeAnswerText,
  onSelectChoice,
  onJumpToChunk,
  onSubmit,
  onBackToQuestions,
}: ReviewScreenProps) {
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);

  // The longest scroll in the whole flow - every chunk paragraph, plus
  // either card's inputs when expanded for editing, can be focused here.
  // Without this, editing one opens a keyboard that covers the field being
  // typed into.
  const { scrollRef, handleFocus, handleContainerLayout, handleScroll, keyboardSpacer } =
    useKeyboardFocusScroll(28);

  const HEADER_FIELDS: ReportFieldKey[] = (
    [
      "complainantName",
      "complainantAddress",
      "complainantAge",
      "complainantContact",
      "complainantGender",
      "filedByGuardian",
      "guardianName",
    ] as ReportFieldKey[]
  ).filter((key) => isFieldApplicable(key, answers));

  /** One field's editable input, matching ConfirmYouScreen's own per-field
   *  switch: PhoneInput for contact, FormChoiceField for a choice question,
   *  FormField for everything else. */
  function renderHeaderInput(key: ReportFieldKey) {
    const q = getQuestion(key);
    const a = answers[key];

    if (key === "complainantContact") {
      return (
        <PhoneInput
          key={key}
          label={q.label}
          digits={toLocalPhoneDigits(a?.text)}
          onChangeDigits={(digits) => onChangeAnswerText(key, digits)}
          onFocus={handleFocus}
        />
      );
    }

    if (q.inputType !== "voice") {
      return (
        <FormChoiceField
          key={key}
          label={q.label}
          options={q.options ?? []}
          value={a?.value}
          onSelect={(value, label) => onSelectChoice(key, value, label)}
        />
      );
    }

    // Same age guard ConfirmYouScreen uses (digit-only, 3-digit cap, live
    // range error) - editing "Baguhin" here reuses this exact field, so a
    // typo introduced by an edit on Review needs the same catch as one
    // introduced back on Bahagi 1, not a looser one just because it's a
    // different screen.
    const ageErrorText =
      key === "complainantAge" && a?.text.trim() ? getAgeError(a.text) : null;

    return (
      <FormField
        key={key}
        label={q.label}
        value={a?.text ?? ""}
        onChangeText={(text) =>
          onChangeAnswerText(key, key === "complainantAge" ? normalizeAgeDigits(text) : text)
        }
        onFocus={handleFocus}
        placeholder={q.placeholder ?? ""}
        keyboardType={key === "complainantAge" ? "number-pad" : "default"}
        maxLength={key === "complainantAge" ? AGE_MAX_DIGITS : undefined}
        hint={key === "complainantAge" ? AGE_REQUIREMENTS_HINT : undefined}
        error={ageErrorText}
      />
    );
  }

  const blotterQ = getQuestion("blotterType");
  const categoryQ = getQuestion("incidentCategory");
  const cctvQ = getQuestion("requestCctv");
  const cctvChecked = answers.requestCctv?.value === "true";

  return (
    <ScrollView
            ref={scrollRef}
            onLayout={handleContainerLayout}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            className="flex-1 px-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 56 + keyboardSpacer }}
          >
            {/* Distinct from the header row's "Suriin ang Report" label on
                purpose - that's the structural name of this screen, this is
                the conversational prompt, same split ConfirmYouScreen
                ("Kayo po ba ito?") and DetailsScreen ("Kaunti na lang po.")
                both use between their own header label and body heading. */}
            <Text className="text-[28px] font-semibold text-ink tracking-tight mb-2">
              Halos tapos na po.
            </Text>
            <Text className="text-[15px] text-ink-soft leading-7 mb-8">
              Itama po ang anumang mali bago ipasa.
            </Text>

            {/* Part 1 - identity, its own card. */}
            <Card className="px-5 pt-5 pb-1 mb-8">
              <SectionHeader
                label="Sino ang Nagrereklamo"
                editing={editingHeader}
                onToggle={() => setEditingHeader((v) => !v)}
              />
              {editingHeader ? (
                <View className="pt-2 pb-4">{HEADER_FIELDS.map((key) => renderHeaderInput(key))}</View>
              ) : (
                HEADER_FIELDS.map((key, i) => (
                  <FieldRow
                    key={key}
                    icon={getQuestion(key).icon}
                    label={getQuestion(key).label}
                    value={answers[key]?.text.trim()}
                    isLast={i === HEADER_FIELDS.length - 1}
                  />
                ))
              )}
            </Card>

            {/* Part 2 - the incident, as told, its own card. Not
                editable-in-place like the other two (there's nothing to
                toggle - each paragraph is always a direct text box, the
                same as it was on the chunk screens), so no SectionHeader
                edit affordance here, just the label. */}
            <Card className="px-5 py-5 mb-8">
              <Text className={`${REPORT_TYPE.eyebrowBrand} mb-5`}>Ang Insidente</Text>

              <View style={{ gap: 28 }}>
                {CHUNKS.map((chunk, index) => {
                  const transcript = chunks[chunk.key]?.transcript ?? "";

                  return (
                    <View key={chunk.key} className="flex-row">
                      {/* Quote rule - sets the resident's own words apart
                          from the form fields around them, the way a
                          statement is set apart in the printed blotter. */}
                      <View
                        style={{ width: 3, borderRadius: 2, backgroundColor: colors.primaryContainer }}
                      />
                      <View className="flex-1 ml-4">
                        <View className="flex-row items-center mb-2.5">
                          <Ionicons
                            name={chunk.icon as any}
                            size={14}
                            color={colors.onSurfaceVariant}
                          />
                          <Text className={`${REPORT_TYPE.fieldLabel} ml-1.5 flex-1`}>
                            {chunk.label}
                          </Text>
                        </View>

                        <AnswerEditor
                          value={transcript}
                          onChangeText={(text) => onChangeChunkTranscript(chunk.key, text)}
                          onFocus={handleFocus}
                          placeholder="Wala pang naitala"
                          isTranscribing={false}
                          tall
                        />

                        <Pressable
                          onPress={() => onJumpToChunk(index)}
                          className="flex-row items-center self-start mt-3 border border-gray-200 rounded-full pl-2.5 pr-3 py-1.5 active:opacity-70"
                        >
                          <Ionicons name="mic-outline" size={13} color={colors.onSurfaceVariant} />
                          <Text className="text-[13px] font-medium text-ink-soft ml-1.5">
                            I-record muli
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Part 3 - categorical decisions, not narrative, not
                identity, so its own card rather than folded into either
                of the other two. */}
            <Card className="px-5 pt-5 pb-1 mb-8">
              <SectionHeader
                label="Detalye ng Blotter"
                editing={editingDetails}
                onToggle={() => setEditingDetails((v) => !v)}
              />

              {editingDetails ? (
                <View className="pt-2 pb-4">
                  <FormChoiceField
                    label={blotterQ.label}
                    options={blotterQ.options ?? []}
                    value={answers.blotterType?.value}
                    onSelect={(value, label) => onSelectChoice("blotterType", value, label)}
                    hint={blotterQ.hint}
                  />
                  <FormChoiceField
                    label={categoryQ.label}
                    options={categoryQ.options ?? []}
                    value={answers.incidentCategory?.value}
                    onSelect={(value, label) => onSelectChoice("incidentCategory", value, label)}
                  />
                  <FormCheckboxField
                    label={cctvQ.label}
                    checkboxLabel={cctvQ.checkboxLabel ?? "Oo"}
                    checked={cctvChecked}
                    onToggle={() =>
                      onSelectChoice(
                        "requestCctv",
                        cctvChecked ? "false" : "true",
                        cctvChecked ? "" : cctvQ.checkboxLabel ?? "Oo"
                      )
                    }
                    wrapperClassName="mb-1"
                  />
                </View>
              ) : (
                <>
                  <FieldRow icon={blotterQ.icon} label={blotterQ.label} value={answers.blotterType?.text.trim()} />
                  <FieldRow
                    icon={categoryQ.icon}
                    label={categoryQ.label}
                    value={answers.incidentCategory?.text.trim()}
                  />
                  <FieldRow
                    icon={cctvQ.icon}
                    label={cctvQ.label}
                    value={cctvChecked ? "Oo" : "Hindi"}
                    isLast
                  />
                </>
              )}
            </Card>

            {/* Part 4 - what happens at the barangay hall. Informational
                only (see POST_BLOTTER_STEPS' doc comment), lives outside
                the report cards since it isn't part of the report itself.
                Always visible now, not collapsible - a chevron toggle
                implies "optional, expand if curious," but whether this is
                a legal document yet is not optional information, so it's
                just a plain static label with nothing to tap. Its steps
                sit inside one Card with internal dividers, matching the
                same rows-not-boxes language as the cards above it. */}
            <View className="mb-8">
              <Text className={`${REPORT_TYPE.eyebrowBrand} mb-3`}>{POST_BLOTTER_COPY.title}</Text>

              <Text className={`${REPORT_TYPE.caption} mb-4`}>{POST_BLOTTER_COPY.intro}</Text>

              <Card className="px-5 overflow-hidden">
                {POST_BLOTTER_STEPS.map((step, i) => (
                  <View
                    key={step.key}
                    className={`flex-row items-start py-4 ${
                      i < POST_BLOTTER_STEPS.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                  >
                    <Ionicons
                      name={step.icon as any}
                      size={16}
                      color={colors.onSurfaceVariant}
                      style={{ marginTop: 1 }}
                    />
                    <View className="ml-2.5 flex-1">
                      <Text className={REPORT_TYPE.fieldLabel}>{step.label}</Text>
                      <Text className={`${REPORT_TYPE.caption} mt-0.5`}>{step.body}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>

            {busy && (
              <Text className={`${REPORT_TYPE.caption} text-center mb-3`}>
                May mga sagot pa pong ginagawa. Maaari po kayong maghintay o i-type na lang.
              </Text>
            )}

            {/* Quiet inline text, not a popup after the fact - the only
                other reason the button below can't be tapped yet (an
                extracted field like "Petsa at oras" the model missed, still
                blank above). Points back at the content instead of naming
                fields in a dialog the resident then has to dismiss and go
                hunting from memory. */}
            {!busy && !canSubmit && (
              <Text className={`${REPORT_TYPE.caption} text-center mb-3`}>
                May kulang pa pong sagot sa itaas bago maipasa.
              </Text>
            )}

            <AuthActionGroup
              secondary={
                <Pressable
                  onPress={onBackToQuestions}
                  disabled={submitting}
                  className="py-1 items-center active:opacity-70"
                >
                  <Text className="text-[15px] font-medium text-ink-soft">Bumalik sa mga tanong</Text>
                </Pressable>
              }
            >
              <Pressable
                onPress={onSubmit}
                disabled={submitting || !canSubmit}
                className={`rounded-2xl py-4 items-center overflow-hidden active:opacity-85 ${
                  submitting || !canSubmit ? "bg-gray-300" : "bg-brand"
                }`}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-[18px]">Ipasa ang report</Text>
                )}
              </Pressable>
            </AuthActionGroup>
    </ScrollView>
  );
}
