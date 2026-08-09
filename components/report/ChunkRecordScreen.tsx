import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";
import { CHUNKS, type Chunk } from "@/lib/reportQuestions";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { RecordControls } from "./RecordControls";
import { AnswerEditor } from "./AnswerEditor";
import type { ChunkState } from "./types";

type ChunkRecordScreenProps = {
  chunk: Chunk;
  index: number;
  state: ChunkState;
  isRecording: boolean;
  isPaused: boolean;
  durationMillis: number;
  metering: number | undefined;
  isPlaying: boolean;
  canAdvance: boolean;
  onChangeTranscript: (text: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onTogglePlayback: () => void;
  onRetryTranscription: () => void;
  onNext: () => void;
};

/**
 * One chunk recording, full screen. Replaces the old per-question StepScreen
 * as the primary path: three of these instead of ~9, because a resident
 * telling a story shouldn't have it chopped into one recording per field.
 *
 * Composition only - the record controls and the editable transcript are the
 * same components the repair path uses, so a fix to either can't drift
 * between the two flows.
 *
 * Header/chrome is owned by report.tsx now, not this screen - see
 * IntroScreen's doc comment for why. report.tsx computes the same
 * "Bahagi N ng TOTAL_BAHAGI" props this screen used to build itself,
 * numbered from 2 since ConfirmYouScreen is Bahagi 1, and disables the
 * header's back button while `isRecording` - stepping away mid-recording
 * would strand it.
 */
export function ChunkRecordScreen({
  chunk,
  index,
  state,
  isRecording,
  isPaused,
  durationMillis,
  metering,
  isPlaying,
  canAdvance,
  onChangeTranscript,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onTogglePlayback,
  onRetryTranscription,
  onNext,
}: ChunkRecordScreenProps) {
  const isLast = index === CHUNKS.length - 1;
  const hasTranscript = Boolean(state.transcript.trim());

  // The transcript box sits at the bottom of a long scroll (question, Gabay
  // checklist, record controls, then the box itself) - without this, the
  // keyboard opens right on top of it and typing happens blind behind it.
  // Same fix as ConfirmYouScreen/register.tsx: scroll the focused field
  // clear of the keyboard rather than resizing the layout (see
  // useKeyboardFocusScroll's doc comment for why not KeyboardAvoidingView).
  // Smaller gap than the auth screens' default (96px, sized for a
  // hint+error pair under a single-line field) - AnswerEditor here carries
  // at most one short "Ginagawa pa..." status line below it, so the box's
  // own bottom edge should land close to the keyboard, not float ~96px
  // above it.
  const { scrollRef, handleFocus, handleContainerLayout, handleScroll, keyboardSpacer } =
    useKeyboardFocusScroll(20);

  return (
    <>
      <ScrollView
        ref={scrollRef}
        onLayout={handleContainerLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        className="flex-1 px-8"
        contentContainerStyle={{ flexGrow: 1, paddingTop: 24, paddingBottom: 56 + keyboardSpacer }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <View style={{ flexGrow: 1 }}>
            {/* Same 28px semibold heading as ConfirmYouScreen's, instead of
                REPORT_TYPE.question's 24px - this is the question a
                resident reads first on this screen, exactly the same job
                "Kayo po ba ito?" does on Bahagi 1, so it gets the same
                weight. */}
            <Text className="text-[28px] font-semibold text-ink tracking-tight mb-4">
              {chunk.question}
            </Text>
            {(chunk.hint || chunk.hintItems) && (
              // Still a distinct card (brand-tinted fill + border) - that
              // boundary is what separates "instruction" from "the page"
              // at a glance. Minimalism applied inside the card instead:
              // plain numerals rather than filled circle chips, tighter
              // spacing, no extra visual machinery beyond what identifies
              // and orders the checklist.
              <View className="bg-brand-50 border border-brand-100 rounded-2xl px-4 py-3.5 mb-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="bulb-outline" size={15} color={colors.primary} style={{ marginRight: 5 }} />
                  <Text className="text-[12px] font-bold uppercase tracking-wide text-brand-dark">
                    Gabay
                  </Text>
                </View>

                {chunk.hint && (
                  <Text className="text-[14px] leading-5 text-brand-dark mb-2">{chunk.hint}</Text>
                )}

                {chunk.hintItems && (
                  <View style={{ gap: 6 }}>
                    {chunk.hintItems.map((item, i) => (
                      <View key={i} className="flex-row items-start">
                        <Text
                          className="text-[16px] leading-6 text-brand font-semibold"
                          style={{ width: 20 }}
                        >
                          {i + 1}.
                        </Text>
                        <Text className="text-[16px] leading-6 text-ink flex-1">{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {chunk.example && (
                  <Text className="text-[13px] leading-5 text-ink-faint mt-2">{chunk.example}</Text>
                )}
              </View>
            )}

            {/* mb-8 (was flush against "Inyong salaysay" below it) - the mic
                controls and the transcript box are two distinct actions
                (record vs. review/edit what got recorded), so they need a
                clearer gap than two related fields in the same group would,
                not just the label's own mb-2. */}
            <View className="flex-1 items-center justify-center mb-8" style={{ minHeight: 180 }}>
              <RecordControls
                isRecording={isRecording}
                isPaused={isPaused}
                durationMillis={durationMillis}
                metering={metering}
                answerStatus={state.status === "extracting" ? "done" : state.status}
                hasRecording={Boolean(state.uri)}
                isPlaying={isPlaying}
                onStart={onStartRecording}
                onStop={onStopRecording}
                onPause={onPauseRecording}
                onResume={onResumeRecording}
                onTogglePlayback={onTogglePlayback}
              />
            </View>

            {/* Always editable - the fastest fix for a small transcription
                error is typing over it, not re-recording the whole story. */}
            <View>
              <Text className={`${REPORT_TYPE.fieldLabel} mb-2`}>Inyong salaysay</Text>
              <AnswerEditor
                value={state.transcript}
                onChangeText={onChangeTranscript}
                onFocus={handleFocus}
                placeholder="I-record o i-type po ang inyong salaysay"
                isTranscribing={state.status === "transcribing"}
                transcribingLabel="Ginagawa pa ang teksto..."
                tall={Boolean(chunk.verbatimField)}
                errorMessage={state.status === "error" ? state.error : undefined}
                onRetry={state.uri ? onRetryTranscription : undefined}
              />
              {state.status === "extracting" && hasTranscript && (
                <View className="flex-row items-center mt-2">
                  <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                  <Text className={`${REPORT_TYPE.caption} ml-1.5`}>
                    Hinahanap ang mga detalye sa inyong salaysay...
                  </Text>
                </View>
              )}
            </View>
          </View>
      </ScrollView>

      {/* Same bottom action treatment as ConfirmYouScreen - px-8,
          AuthActionGroup, no border-t divider (the divider was a
          report-flow-only convention; Bahagi 1 has none, so this
          shouldn't either), 18px button label. */}
      <View className="px-8" style={{ paddingBottom: 32 }}>
        <AuthActionGroup>
          <Pressable
            onPress={onNext}
            disabled={isRecording || !canAdvance}
            className={`rounded-2xl py-4 items-center overflow-hidden active:opacity-85 ${
              isRecording || !canAdvance ? "bg-gray-300" : "bg-brand"
            }`}
          >
            <Text className="text-white font-semibold text-[18px]">
              {isLast ? "Magpatuloy" : "Susunod"}
            </Text>
          </Pressable>
        </AuthActionGroup>
      </View>
    </>
  );
}
