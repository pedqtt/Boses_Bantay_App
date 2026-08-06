import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useNavigation, useFocusEffect } from "expo-router";
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import { transcribeVoiceReport } from "@/lib/api/transcribe";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { REPORT_QUESTIONS, TOTAL_STEPS, getChapterProgress, type ReportFieldKey } from "@/lib/reportQuestions";
import { IntroScreen } from "@/components/report/IntroScreen";
import { StepScreen } from "@/components/report/StepScreen";
import { ReviewScreen } from "@/components/report/ReviewScreen";
import { SubmittedScreen } from "@/components/report/SubmittedScreen";
import { VerificationRequiredScreen } from "@/components/report/VerificationRequiredScreen";
import { EMPTY_ANSWER, type AnswersMap } from "@/components/report/types";

/*
 * ARCHITECTURE
 * ────────────
 * This file is the controller for the guided report flow: it owns every
 * piece of state (which stage, which answer, the audio recorder/player,
 * in-flight transcriptions) and every handler that changes that state. It
 * renders none of the actual UI — that all lives in components/report/*,
 * as four screen components (Intro/Step/Review/Submitted) built from small,
 * single-purpose presentational pieces (QuestionPrompt, RecordControls,
 * AnswerEditor, ChapterProgressHeader, LiveWaveform).
 *
 * Why split it this way: the four stages share state (the answers map, the
 * recorder) but have almost no shared layout, and two small pieces of UI
 * (the answer text box, the record/play buttons) are used in more than one
 * place. Keeping all state here and passing plain props down means every
 * screen component is easy to read in isolation — no hook wiring to trace,
 * just "given these props, render this" — and the answer-editing pattern
 * can't quietly drift apart between screens the way it did before this
 * refactor (review and step had different min-heights, review was missing
 * the retry button). One component, one place it can break.
 */

type Stage = "intro" | "step" | "review" | "submitted";

function makeEmptyAnswers(): AnswersMap {
  return REPORT_QUESTIONS.reduce(
    (acc, q) => ({ ...acc, [q.key]: { ...EMPTY_ANSWER } }),
    {} as AnswersMap
  );
}

/** Anything shorter than this almost certainly caught no speech — catching
 *  it here saves a pointless upload and a confusing empty result. */
const MIN_RECORDING_MS = 1000;

export default function ReportScreen() {
  const { profile } = useAuth();
  const [stage, setStage] = useState<Stage>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>(makeEmptyAnswers);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(audioRecorder, 150);

  // Guards against a background transcription resolving after the resident
  // has already reset the flow, which would otherwise repopulate a cleared
  // answer.
  const flowId = useRef(0);

  // Hide the bottom tab bar for the entire time this screen is focused.
  // Filing a report is the one flow where an accidental tap on another tab
  // is actually costly — it can drop mid-recording or mid-typing progress —
  // so removing the tab bar here isn't just visual cleanup, it removes the
  // misclick target entirely. Standard React Navigation recipe: set
  // tabBarStyle to display:none on focus, undefined on blur so it falls
  // back to the navigator's normal style the moment the resident leaves.
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      // report.tsx is itself a Tabs.Screen, so setOptions here (not
      // getParent()) is what controls this screen's own tab bar visibility
      // — the documented React Navigation recipe for per-screen tab bar
      // hiding.
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  useEffect(() => {
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
  }, []);

  const question = REPORT_QUESTIONS[stepIndex];
  const answer = answers[question?.key] ?? EMPTY_ANSWER;
  const isLastStep = stepIndex === TOTAL_STEPS - 1;

  // Replay control for the resident's own recording — lets them confirm
  // "yes, that's what I said" by ear. Recreated whenever the answer's audio
  // URI changes (new recording, or switching question).
  const player = useAudioPlayer(answer.uri ?? null);
  const playerStatus = useAudioPlayerStatus(player);

  function togglePlayback() {
    if (!answer.uri) return;
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    const atEnd = playerStatus.duration > 0 && playerStatus.currentTime >= playerStatus.duration - 0.15;
    if (atEnd) player.seekTo(0);
    player.play();
  }

  const setAnswer = useCallback((key: ReportFieldKey, patch: Partial<AnswersMap[ReportFieldKey]>) => {
    setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  /** Choice/checkbox questions don't record — selecting an option is the
   *  whole answer. `label` becomes `.text` (so review/validation logic that
   *  already checks `.text.trim()` doesn't need a second code path), and
   *  `value` is the stable machine value the DB actually stores. */
  const selectChoice = useCallback(
    (key: ReportFieldKey, value: string, label: string) => {
      setAnswer(key, { text: label, value, status: "done" });
    },
    [setAnswer]
  );

  /** Fire-and-forget transcription. Deliberately not awaited by the caller
   *  so the resident can advance to the next question while this runs — by
   *  the time they finish the interview most answers are already back,
   *  which is what keeps a 7-step flow from feeling like 7 waits. */
  const transcribeInBackground = useCallback(
    (key: ReportFieldKey, uri: string) => {
      const myFlow = flowId.current;
      setAnswer(key, { status: "transcribing", text: "", error: undefined, uri });

      transcribeVoiceReport(uri, key)
        .then(({ text }) => {
          if (flowId.current !== myFlow) return;
          setAnswer(key, { status: "done", text, error: undefined });
        })
        .catch((err: any) => {
          if (flowId.current !== myFlow) return;
          setAnswer(key, { status: "error", error: err?.message ?? "Hindi na-transcribe." });
        });
    },
    [setAnswer]
  );

  async function startRecording() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Kailangan ang mikropono",
        'Kailangan po ng Boses Bantay ng access sa mikropono para ma-record ang inyong sagot. Maaari po itong i-enable sa Settings, o gamitin ang "I-type na lang".'
      );
      return;
    }
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setIsPaused(false);
    } catch (err: any) {
      Alert.alert("Hindi makapag-record", err?.message ?? "Subukan po muli.");
    }
  }

  async function stopRecording() {
    const durationMs = recorderState.durationMillis ?? 0;
    try {
      await audioRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
      const uri = audioRecorder.uri;

      if (!uri || durationMs < MIN_RECORDING_MS) {
        Alert.alert("Masyadong maikli", "Hindi po namin naabutan ang sagot ninyo. Subukan po muling mag-record.");
        return;
      }
      transcribeInBackground(question.key, uri);
    } catch (err: any) {
      setIsRecording(false);
      setIsPaused(false);
      Alert.alert("Hindi makapag-record", err?.message ?? "Subukan po muli.");
    }
  }

  /** Pause/resume replace the old "cancel and lose the take" escape hatch —
   *  the stop button (which keeps and transcribes what's captured so far)
   *  already covers "I'm done," so the second control only needs to cover
   *  "give me a second," not "throw this away." expo-audio's recorder
   *  supports pausing natively (audioRecorder.pause()) and resuming by
   *  calling .record() again on the same session, so this isn't a fake
   *  pause — it's a real gap in the captured audio. */
  function pauseRecording() {
    try {
      audioRecorder.pause();
      setIsPaused(true);
    } catch (err: any) {
      Alert.alert("Hindi ma-pause", err?.message ?? "Subukan po muli.");
    }
  }

  function resumeRecording() {
    try {
      audioRecorder.record();
      setIsPaused(false);
    } catch (err: any) {
      Alert.alert("Hindi maipagpatuloy", err?.message ?? "Subukan po muli.");
    }
  }

  function retryTranscription() {
    if (answer.uri) transcribeInBackground(question.key, answer.uri);
  }

  // guardianName only makes sense when filing on a minor's behalf — for
  // every other resident it's dead weight in the middle of the flow, so it
  // gets skipped automatically in both directions instead of relying on
  // "Laktawan," which exists for genuinely optional fields, not ones that
  // don't apply at all.
  function isStepApplicable(index: number): boolean {
    const key = REPORT_QUESTIONS[index]?.key;
    if (key !== "guardianName") return true;
    return answers.filedByGuardian?.value === "guardian";
  }

  function goNext() {
    if (isLastStep) {
      setStage("review");
      return;
    }
    let next = stepIndex + 1;
    while (next < TOTAL_STEPS && !isStepApplicable(next)) next += 1;
    if (next >= TOTAL_STEPS) {
      setStage("review");
    } else {
      setStepIndex(next);
    }
  }

  function goBack() {
    if (stepIndex === 0) {
      setStage("intro");
      return;
    }
    let prev = stepIndex - 1;
    while (prev > 0 && !isStepApplicable(prev)) prev -= 1;
    if (prev === 0 && !isStepApplicable(0)) {
      setStage("intro");
    } else {
      setStepIndex(prev);
    }
  }

  function startFlow() {
    flowId.current += 1;
    const initial = makeEmptyAnswers();
    // The app already knows these from signup — re-asking is real friction
    // for no reason (the "keep the flow short" accessibility guidance this
    // question set is built from). Both stay fully editable; this is a
    // starting point, not a lock.
    if (profile?.fullName) {
      initial.complainantName = { ...EMPTY_ANSWER, text: profile.fullName, status: "done" };
    }
    if (profile?.phone) {
      initial.complainantContact = { ...EMPTY_ANSWER, text: profile.phone, status: "done" };
    }
    setAnswers(initial);
    setStepIndex(0);
    setStage("step");
  }

  function resetFlow() {
    flowId.current += 1;
    setAnswers(makeEmptyAnswers());
    setStepIndex(0);
    setReferenceNo("");
    setStage("intro");
  }

  /** Required questions must have real text before submission. Optional
   *  ones can be blank — "walang saksi" is a legitimate outcome, and a
   *  validator that rejects it just teaches residents to type filler. */
  const missingRequired = REPORT_QUESTIONS.filter((q) => q.required && !answers[q.key].text.trim());
  const stillTranscribing = REPORT_QUESTIONS.some((q) => answers[q.key].status === "transcribing");

  async function handleSubmit() {
    if (missingRequired.length > 0) {
      Alert.alert("Kulang pa ang detalye", `Kailangan pa pong sagutin: ${missingRequired.map((q) => q.label).join(", ")}.`);
      return;
    }
    // guardianName isn't in the static `required` set (its requiredness is
    // conditional, which that flag can't express — see reportQuestions.ts)
    // so it needs its own check here instead.
    if (answers.filedByGuardian?.value === "guardian" && !answers.guardianName?.text.trim()) {
      Alert.alert("Kulang pa ang detalye", "Kailangan pa pong sagutin: Pangalan ng magulang/tagapag-alaga.");
      return;
    }
    setSubmitting(true);

    try {
      // 1. Gather every answer as the full narrative record.
      const draft = REPORT_QUESTIONS.reduce(
        (acc, q) => ({ ...acc, [q.key]: answers[q.key].text.trim() }),
        {} as Record<string, string>
      );

      // 2. Generate a random Reference Number (e.g., BGY-123456)
      const refNo = `BGY-${Math.floor(100000 + Math.random() * 900000)}`;

      // 3. Get the current logged-in user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to submit a report.");
      }

      // 4. Insert into Supabase. Fields the barangay interview flagged as
      // needing to be independently searchable/filterable (respondent name,
      // incident category, etc.) are promoted to real columns, not just
      // buried in full_details — full_details still keeps the complete
      // question/answer map as the narrative record of what was asked.
      const { error } = await supabase
        .from("reports")
        .insert({
          reference_no: refNo,
          user_id: user.id,
          status: "Under Review",
          category: draft.incidentCategory || "General",
          summary: draft.description || "Details provided in full report",
          full_details: draft,
          complainant_age: draft.complainantAge ? Number(draft.complainantAge) || null : null,
          complainant_contact: draft.complainantContact || null,
          complainant_gender: answers.complainantGender?.value ?? null,
          filed_by_guardian: answers.filedByGuardian?.value === "guardian",
          guardian_name: draft.guardianName || null,
          respondent_name: draft.respondentName || null,
          blotter_type: answers.blotterType?.value ?? null,
          incident_category: answers.incidentCategory?.value ?? null,
          request_cctv_review: answers.requestCctv?.value === "true",
        });

      if (error) throw error;

      // 5. Success! Move to the next screen
      setReferenceNo(refNo);
      setStage("submitted");

    } catch (err: any) {
      Alert.alert("Hindi naipasa ang report", err?.message ?? "Subukan po muli.");
    } finally {
      setSubmitting(false);
    }
  }

  // Report is a tab, not a pushed screen, so there's no natural "previous
  // screen" for router.back() to return to from the intro — Home is the
  // one predictable destination regardless of how the resident arrived
  // here (tab bar FAB, or a "File a report" card from another screen).
  function exitToHome() {
    router.push("/(resident)/home");
  }

  // Gate the entire flow behind full Barangay ID authorization, not just
  // "logged in" — an unverified account has already gotten past OTP/login,
  // so without this check anyone could file blotter reports before staff
  // ever confirmed their ID is real. "pb_authorized" (not
  // "secretary_verified") is deliberately the bar here: pending.tsx uses
  // that same threshold to unlock Home in the first place, so a resident
  // reaching this screen has already been let into the app under that
  // rule — this just re-checks it at the point that actually matters
  // (submitting a report), in case status was reset or a session got
  // reused after a rejection.
  const isFullyVerified = profile?.barangayIdStatus === "pb_authorized";
  if (!isFullyVerified) {
    return (
      <VerificationRequiredScreen
        status={profile?.barangayIdStatus ?? "unverified"}
        onGoVerify={() => router.push("/(resident)/verify-id")}
        onGoBack={exitToHome}
      />
    );
  }

  if (stage === "submitted") {
    return (
      <SubmittedScreen
        referenceNo={referenceNo}
        onViewReports={() => {
          resetFlow();
          router.push("/(resident)/reports");
        }}
        onFileAnother={resetFlow}
      />
    );
  }

  if (stage === "review") {
    return (
      <ReviewScreen
        answers={answers}
        submitting={submitting}
        stillTranscribing={stillTranscribing}
        onChangeAnswerText={(key, text) => setAnswer(key, { text, status: "done" })}
        onJumpToStep={(key) => {
          const index = REPORT_QUESTIONS.findIndex((q) => q.key === key);
          if (index >= 0) setStepIndex(index);
          setStage("step");
        }}
        onSubmit={handleSubmit}
        onBackToQuestions={() => {
          setStepIndex(0);
          setStage("step");
        }}
      />
    );
  }

  if (stage === "step") {
    const canAdvance = question.required
      ? answer.status === "transcribing" || Boolean(answer.text.trim())
      : true;

    return (
      <StepScreen
        question={question}
        progress={getChapterProgress(stepIndex)}
        answer={answer}
        isLastStep={isLastStep}
        canAdvance={canAdvance}
        isRecording={isRecording}
        isPaused={isPaused}
        durationMillis={recorderState.durationMillis ?? 0}
        metering={recorderState.metering}
        isPlaying={playerStatus.playing}
        onChangeText={(text) => setAnswer(question.key, { text, status: "done" })}
        onSelectChoice={(value, label) => selectChoice(question.key, value, label)}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onTogglePlayback={togglePlayback}
        onRetryTranscription={retryTranscription}
        onBack={goBack}
        onNext={goNext}
      />
    );
  }

  return <IntroScreen onStart={startFlow} onBack={exitToHome} />;
}