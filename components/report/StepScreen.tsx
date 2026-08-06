import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import type { ReportQuestion, ChapterProgress } from "@/lib/reportQuestions";
import { ChapterProgressHeader } from "./ChapterProgressHeader";
import { QuestionPrompt } from "./QuestionPrompt";
import { RecordControls } from "./RecordControls";
import { AnswerEditor } from "./AnswerEditor";
import { ChoiceStep } from "./ChoiceStep";
import type { AnswerState } from "./types";

type StepScreenProps = {
  question: ReportQuestion;
  progress: ChapterProgress;
  answer: AnswerState;
  isLastStep: boolean;
  canAdvance: boolean;
  isRecording: boolean;
  isPaused: boolean;
  durationMillis: number;
  metering: number | undefined;
  isPlaying: boolean;
  onChangeText: (text: string) => void;
  onSelectChoice: (value: string, label: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onTogglePlayback: () => void;
  onRetryTranscription: () => void;
  onBack: () => void;
  onNext: () => void;
};

/**
 * One question, full screen. Composition only — every visual concern
 * (progress framing, the question itself, the record/play controls, the
 * editable answer) is its own component; this file is just the layout that
 * arranges them and wires callbacks through, so the actual UI logic isn't
 * duplicated between this screen and the review screen that reuses several
 * of the same pieces.
 */
export function StepScreen({
  question,
  progress,
  answer,
  isLastStep,
  canAdvance,
  isRecording,
  isPaused,
  durationMillis,
  metering,
  isPlaying,
  onChangeText,
  onSelectChoice,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onTogglePlayback,
  onRetryTranscription,
  onBack,
  onNext,
}: StepScreenProps) {
  const nextLabel = isLastStep
    ? "Suriin ang report"
    : !question.required && !answer.text.trim()
      ? "Laktawan"
      : "Susunod";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ChapterProgressHeader progress={progress} isOptional={!question.required} onBack={onBack} />

        {/* flexGrow on the content container fixes "everything crammed at
            the top." Within it: the question stays pinned to the top
            (that's the reading start), but the record/play buttons live in
            a flex-1 region that fills whatever space is left above the
            answer field and centers its contents both ways (items-center
            for horizontal, justify-center for vertical) — so the controls
            sit in the true middle of the available area instead of hugging
            up against the question text. The answer field stays pinned to
            the bottom of the group. Once content is tall enough to need
            scrolling (long transcript, hint box, keyboard open), this
            degrades to a normal top-to-bottom ScrollView. */}
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ flexGrow: 1, paddingTop: 20, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexGrow: 1 }}>
            <QuestionPrompt question={question} />

            {question.inputType === "voice" ? (
              <>
                <View className="flex-1 items-center justify-center" style={{ minHeight: 180 }}>
                  <RecordControls
                    isRecording={isRecording}
                    isPaused={isPaused}
                    durationMillis={durationMillis}
                    metering={metering}
                    answerStatus={answer.status}
                    hasRecording={Boolean(answer.uri)}
                    isPlaying={isPlaying}
                    onStart={onStartRecording}
                    onStop={onStopRecording}
                    onPause={onPauseRecording}
                    onResume={onResumeRecording}
                    onTogglePlayback={onTogglePlayback}
                  />
                </View>

                {/* Always editable — the fastest fix for a small
                    transcription error is typing over it, not re-recording
                    the whole answer. */}
                <View>
                  <Text className={`${REPORT_TYPE.fieldLabel} mb-2`}>Inyong sagot</Text>
                  <AnswerEditor
                    value={answer.text}
                    onChangeText={onChangeText}
                    placeholder={`${question.placeholder} — o i-type na lang`}
                    isTranscribing={answer.status === "transcribing"}
                    transcribingLabel="Ginagawa pa ang sagot..."
                    tall={question.key === "description"}
                    errorMessage={answer.status === "error" ? answer.error : undefined}
                    onRetry={answer.uri ? onRetryTranscription : undefined}
                  />
                </View>
              </>
            ) : (
              <View className="flex-1 justify-center" style={{ minHeight: 180 }}>
                <ChoiceStep question={question} value={answer.value} onSelect={onSelectChoice} />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Sticky nav — thumb-reachable, consistent position across all 7
            steps so it becomes muscle memory instead of a fresh hunt. */}
        <View className="px-5 pt-3 pb-5 border-t border-gray-200 flex-row items-center">
          <Pressable
            onPress={onBack}
            disabled={isRecording}
            className="border border-gray-200 rounded-2xl px-5 py-4 items-center justify-center active:opacity-70 mr-3"
          >
            <Text className={REPORT_TYPE.buttonSecondary}>Bumalik</Text>
          </Pressable>

          <View className="flex-1">
            <Pressable
              onPress={onNext}
              disabled={isRecording || !canAdvance}
              className={`rounded-2xl py-4 items-center overflow-hidden active:opacity-85 ${
                isRecording || !canAdvance ? "bg-gray-300" : "bg-brand"
              }`}
            >
              <Text className={REPORT_TYPE.buttonPrimary}>{nextLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
