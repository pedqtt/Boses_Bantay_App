import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
import { REPORT_QUESTIONS, TOTAL_STEPS, getChapterProgress, type ReportFieldKey } from "@/lib/reportQuestions";
import { IntroScreen } from "@/components/report/IntroScreen";
import { StepScreen } from "@/components/report/StepScreen";
import { ReviewScreen } from "@/components/report/ReviewScreen";
import { SubmittedScreen } from "@/components/report/SubmittedScreen";
import { EMPTY_ANSWER, type AnswersMap } from "@/components/report/types";

type Stage = "select" | "intro" | "step" | "review" | "submitted";

function makeEmptyAnswers(): AnswersMap {
  return REPORT_QUESTIONS.reduce(
    (acc, q) => ({ ...acc, [q.key]: { ...EMPTY_ANSWER } }),
    {} as AnswersMap
  );
}

const MIN_RECORDING_MS = 1000;

function SelectTypeScreen({
  onSelectBlotter,
  onSelectServiceComplaint,
  onBack,
}: {
  onSelectBlotter: () => void;
  onSelectServiceComplaint: () => void;
  onBack: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-3 pb-4 flex-row items-center border-b border-gray-100">
        <Pressable
          onPress={onBack}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:opacity-70 mr-3"
        >
          <Ionicons name="close" size={20} color="#1F2937" />
        </Pressable>
        <Text className="text-[20px] font-semibold text-gray-900 tracking-tight">
          File a Report
        </Text>
      </View>

      <View className="flex-1 px-5 pt-6 justify-center">
        <Text className="text-[22px] font-bold text-gray-900 mb-1">
          What type of report is this?
        </Text>
        <Text className="text-[14px] text-gray-500 mb-8">
          Select the option that best matches your situation.
        </Text>

        {/* Option 1: Voice Incident Blotter */}
        <Pressable
          onPress={onSelectBlotter}
          className="p-5 bg-blue-50/60 rounded-2xl border border-blue-100 mb-4 active:opacity-80"
        >
          <View className="flex-row items-center mb-2">
            <View className="w-10 h-10 rounded-xl bg-blue-600 items-center justify-center mr-3">
              <Ionicons name="mic-outline" size={20} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-[16px] font-bold text-gray-900">
                Voice Incident Blotter
              </Text>
              <Text className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                Formal Dispute / Person-to-Person
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
          </View>
          <Text className="text-[13px] text-gray-600 leading-5 mt-1">
            For personal disputes, theft, property damage, or incidents involving specific individuals (4-stage voice pipeline).
          </Text>
        </Pressable>

        {/* Option 2: Service & Community Complaint */}
        <Pressable
          onPress={onSelectServiceComplaint}
          className="p-5 bg-amber-50/60 rounded-2xl border border-amber-100 active:opacity-80"
        >
          <View className="flex-row items-center mb-2">
            <View className="w-10 h-10 rounded-xl bg-amber-500 items-center justify-center mr-3">
              <Ionicons name="construct-outline" size={20} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-[16px] font-bold text-gray-900">
                Service & Community Hazard
              </Text>
              <Text className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                Public Works / Non-Dispute
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
          </View>
          <Text className="text-[13px] text-gray-600 leading-5 mt-1">
            For public issues with no specific respondent: flooding, garbage, clogged drainage, road damage, or broken streetlights.
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function ReportScreen() {
  const [stage, setStage] = useState<Stage>("select");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>(makeEmptyAnswers);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(audioRecorder, 150);

  const flowId = useRef(0);

  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
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

  function goNext() {
    if (isLastStep) {
      setStage("review");
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function goBack() {
    if (stepIndex === 0) {
      setStage("intro");
    } else {
      setStepIndex((i) => i - 1);
    }
  }

  function startFlow() {
    flowId.current += 1;
    setAnswers(makeEmptyAnswers());
    setStepIndex(0);
    setStage("step");
  }

  function resetFlow() {
    flowId.current += 1;
    setAnswers(makeEmptyAnswers());
    setStepIndex(0);
    setReferenceNo("");
    setStage("select");
  }

  const missingRequired = REPORT_QUESTIONS.filter((q) => q.required && !answers[q.key].text.trim());
  const stillTranscribing = REPORT_QUESTIONS.some((q) => answers[q.key].status === "transcribing");

  async function handleSubmit() {
    if (missingRequired.length > 0) {
      Alert.alert("Kulang pa ang detalye", `Kailangan pa pong sagutin: ${missingRequired.map((q) => q.label).join(", ")}.`);
      return;
    }
    setSubmitting(true);

    try {
      const draft = REPORT_QUESTIONS.reduce(
        (acc, q) => ({ ...acc, [q.key]: answers[q.key].text.trim() }),
        {} as Record<string, string>
      );

      const refNo = `BGY-${Math.floor(100000 + Math.random() * 900000)}`;
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to submit a report.");
      }

      // Fetch resident profile details for backend alignment
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const complainantName =
        profile?.full_name || user.user_metadata?.full_name || user.email || "Resident";
      const complainantPhone =
        profile?.phone_number || profile?.phone || user.user_metadata?.phone || "N/A";
      const complainantAddress =
        profile?.address || profile?.purok || draft.where_happened || draft.where || "N/A";

      const formattedDate = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const whatValue = draft.what_happened || draft.what || "Voice Incident Report";
      const whoValue = draft.who_involved || draft.who || "N/A";
      const whereValue = draft.where_happened || draft.where || "N/A";
      const whenValue = draft.when_happened || draft.when || formattedDate;
      const whyValue = draft.why_happened || draft.why || "N/A";
      const howValue = draft.how_happened || draft.how || "N/A";

      const { error } = await supabase
        .from("reports")
        .insert({
          reference_no: refNo,
          user_id: user.id,
          status: "Sinuri",
          category: draft.category || "Incident Blotter",
          summary: whatValue,
          description: whatValue,
          location: whereValue,
          full_details: {
            what: whatValue,
            who: whoValue,
            where: whereValue,
            when: whenValue,
            why: whyValue,
            how: howValue,
            complainant_name: complainantName,
            complainant_phone: complainantPhone,
            complainant_address: complainantAddress,
            ...draft,
          },
        });

      if (error) throw error;

      setReferenceNo(refNo);
      setStage("submitted");
    } catch (err: any) {
      Alert.alert("Hindi naipasa ang report", err?.message ?? "Subukan po muli.");
    } finally {
      setSubmitting(false);
    }
  }

  function exitToHome() {
    router.push("/(resident)/home");
  }

  if (stage === "select") {
    return (
      <SelectTypeScreen
        onSelectBlotter={() => setStage("intro")}
        onSelectServiceComplaint={() => router.push("/(resident)/service-complaint")}
        onBack={exitToHome}
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

  return <IntroScreen onStart={startFlow} onBack={() => setStage("select")} />;
}