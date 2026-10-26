import { Text } from "@/components/AppText";
import { ReportPrimaryLabel } from "./ReportPrimaryLabel";
import { reportStyles } from "./reportStyles";
import { View, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@/components/AppIcon";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import { CHUNKS, type Chunk } from "@/lib/reportQuestions";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { RecordControls } from "./RecordControls";
import { GuideCard } from "./GuideCard";
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
  onAppendRecording: () => void;
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
  onAppendRecording,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onTogglePlayback,
  onRetryTranscription,
  onNext,
}: ChunkRecordScreenProps) {
  const isLast = index === CHUNKS.length - 1;


  return (
    <>
      {/* The transcript box sits at the bottom of a long scroll (question,
          Gabay checklist, record controls, then the box itself) -
          KeyboardAwareScrollView (react-native-keyboard-controller) scrolls
          it clear of the keyboard on focus, frame-synced to the real
          keyboard animation rather than the old useKeyboardFocusScroll
          hook's JS-bridge-event approximation. bottomOffset smaller than
          the auth screens' default - AnswerEditor here carries at most one
          short "Ginagawa pa..." status line below it, so the box's own
          bottom edge should land close to the keyboard, not float far
          above it. */}
      <KeyboardAwareScrollView
        bottomOffset={20}
        className="flex-1 px-8"
        contentContainerStyle={{ flexGrow: 1, paddingTop: 24, paddingBottom: 56 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <View style={{ flexGrow: 1 }}>
            {/* Same 28px semibold heading as ConfirmYouScreen's, instead of
                REPORT_TYPE.question's 24px - this is the question a
                resident reads first on this screen, exactly the same job
                "Kayo po ba ito?" does on Bahagi 1, so it gets the same
                weight. */}
            <Text className="text-[27px] leading-9 font-semibold text-ink tracking-tight mb-4">
              {chunk.question}
            </Text>
            {(chunk.hint || chunk.hintItems) && (
              // Still a distinct card (brand-tinted fill + border) - that
              // boundary is what separates "instruction" from "the page"
              // at a glance. Minimalism applied inside the card instead:
              // plain numerals rather than filled circle chips, tighter
              // spacing, no extra visual machinery beyond what identifies
              // and orders the checklist.
              <View className="mb-5">
              <GuideCard>
                {chunk.hint && (
                  <Text className="text-[14px] leading-5 text-brand-dark mb-2">{chunk.hint}</Text>
                )}

                {chunk.hintItems && (
                  <View style={{ gap: 12 }}>
                    {chunk.hintItems.map((item, i) => (
                      <View key={i} className="flex-row items-start">
                        <Text
                          className="text-[13px] text-brand font-bold text-center"
                          style={{ width: 26, height: 26, lineHeight: 26, borderRadius: 8, backgroundColor: "#FFFFFFB3", marginRight: 10 }}
                        >
                          {i + 1}
                        </Text>
                        <Text className="text-[16px] leading-6 text-ink flex-1">{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {chunk.example && (
                  <View className="mt-4 pt-3 border-t border-brand-100">
                    <Text className="text-[13px] leading-5 text-ink-soft">{chunk.example}</Text>
                  </View>
                )}
              </GuideCard>
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
                answerStatus={state.status}
                hasRecording={Boolean(state.uri)}
                isPlaying={isPlaying}
                onStart={onStartRecording}
                onAppend={onAppendRecording}
                onStop={onStopRecording}
                onPause={onPauseRecording}
                onResume={onResumeRecording}
                onTogglePlayback={onTogglePlayback}
              />
            </View>

            {/* Always editable - the fastest fix for a small transcription
                error is typing over it, not re-recording the whole story. */}
            <View>
              <Text className={`${REPORT_TYPE.fieldLabel} mb-3`}>Inyong salaysay</Text>
              <AnswerEditor
                value={state.transcript}
                onChangeText={onChangeTranscript}
                placeholder="I-record o i-type po ang inyong salaysay"
                isTranscribing={state.status === "transcribing"}
                transcribingLabel="Ginagawa pa ang teksto..."
                tall={Boolean(chunk.verbatimField)}
                errorMessage={state.status === "error" ? state.error : undefined}
                onRetry={state.uri ? onRetryTranscription : undefined}
              />
            </View>
          </View>
      </KeyboardAwareScrollView>

      {/* Same bottom action treatment as ConfirmYouScreen - px-8,
          AuthActionGroup, no border-t divider (the divider was a
          report-flow-only convention; Bahagi 1 has none, so this
          shouldn't either), 18px button label. */}
      <View style={reportStyles.actionBar}>
        <AuthActionGroup>
          <Pressable
            onPress={onNext}
            disabled={isRecording || !canAdvance}
            style={reportStyles.primaryAction}
            className={`rounded-2xl py-4 items-center overflow-hidden active:opacity-85 ${
              isRecording || !canAdvance ? "bg-gray-300" : "bg-brand"
            }`}
          >
            <ReportPrimaryLabel>{isLast ? "Magpatuloy" : "Susunod"}</ReportPrimaryLabel>
          </Pressable>
        </AuthActionGroup>
      </View>
    </>
  );
}
