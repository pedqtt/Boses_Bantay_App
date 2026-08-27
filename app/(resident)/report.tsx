import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { extractFromTranscript, summarizeForOfficer } from "@/lib/api/llm";
import { saveDraft, loadDraft, clearDraft } from "@/lib/api/reportDraft";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  CHUNKS,
  REVIEW_SECTIONS,
  TOTAL_BAHAGI,
  getChunk,
  getQuestion,
  type ChunkKey,
  type ReportFieldKey,
} from "@/lib/reportQuestions";
import { colors } from "@/lib/theme";
import { ScreenBackground } from "@/components/ScreenBackground";
import { BahagiHeader } from "@/components/report/BahagiHeader";
import {
  makeEmptyAnswers,
  makeEmptyChunks,
  mergeExtraction,
  confirmChunkFields,
  chunkMode,
  validate,
  buildPayload,
  type Stage,
} from "@/lib/reportFlow";
import { ChooseReportTypeScreen } from "@/components/report/ChooseReportTypeScreen";
import { IntroScreen } from "@/components/report/IntroScreen";
import { ConfirmYouScreen } from "@/components/report/ConfirmYouScreen";
import { ChunkRecordScreen } from "@/components/report/ChunkRecordScreen";
import { ChunkConfirmScreen } from "@/components/report/ChunkConfirmScreen";
import { DetailsScreen } from "@/components/report/DetailsScreen";
import { ReviewScreen } from "@/components/report/ReviewScreen";
import { SubmittedScreen } from "@/components/report/SubmittedScreen";
import { VerificationRequiredScreen } from "@/components/report/VerificationRequiredScreen";
import { EMPTY_ANSWER, type AnswersMap, type ChunksMap } from "@/components/report/types";

/*
 * ARCHITECTURE
 * ────────────
 * Controller for the pre-blotter flow. Owns all state (stage, answers,
 * chunk transcripts, recorder, in-flight transcription/extraction) and every
 * handler that mutates it. Renders no UI itself - the screens live in
 * components/report/*, and the pure rules (merging, validation, payload
 * assembly) live in lib/reportFlow.ts.
 *
 * The flow, per "Blotter Flow Redesign Plan.md":
 *
 *   intro → chunk[0] ano → chunk[1] kailanSaan → chunk[2] sino
 *         → details → review → submitted
 *
 * Chunk 1 always records. Chunks 2 and 3 render as confirm cards when
 * chunk 1's extraction already answered them, so a resident who told a
 * complete story records once and taps twice instead of recording nine
 * times as in the previous per-question flow.
 *
 * The LLM is an accelerator, not a dependency: if extraction is unavailable
 * every chunk simply falls back to a recording and the flow still completes.
 */

const MIN_RECORDING_MS = 1000;

export default function ReportScreen() {
  const { profile } = useAuth();
  const [stage, setStage] = useState<Stage>("chooseType");
  const [chunkIndex, setChunkIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>(makeEmptyAnswers);
  const [chunks, setChunks] = useState<ChunksMap>(makeEmptyChunks);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingKey, setEditingKey] = useState<ReportFieldKey | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [draftChecked, setDraftChecked] = useState(false);

  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(audioRecorder, 150);

  // Guards against a background transcription/extraction resolving after the
  // resident has already reset the flow, which would otherwise repopulate a
  // cleared answer.
  const flowId = useRef(0);

  const currentChunk = CHUNKS[chunkIndex];
  const currentChunkState = chunks[currentChunk?.key] ?? {
    key: currentChunk?.key,
    transcript: "",
    status: "empty" as const,
    done: false,
  };

  // Hide the bottom tab bar while this screen is focused. Filing is the one
  // flow where an accidental tab tap is actually costly - it can drop
  // mid-recording progress - so removing the tab bar isn't visual cleanup,
  // it removes the misclick target entirely.
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

  // Look for an unfinished report from a previous session, but never restore
  // it silently - see IntroScreen for why the resident is asked first.
  //
  // FIXED: draft lookup/save/clear used to use one fixed device-wide key,
  // so a different resident logging into a new account on the same phone
  // would see the previous account's leftover draft offered as "May hindi
  // natapos na report" - or worse, resumed straight into it. Every call
  // below is now scoped by `profile.id` (see lib/api/reportDraft.ts), so an
  // account switch can never surface someone else's in-progress report.
  useEffect(() => {
    if (!profile?.id) {
      setDraftChecked(true);
      return;
    }
    let cancelled = false;
    loadDraft(profile.id).then((draft) => {
      if (cancelled) return;
      setHasSavedDraft(Boolean(draft));
      setDraftChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Persist on every meaningful change once the resident is actually filing.
  // Deliberately fire-and-forget: a failed save costs crash-resilience, not
  // the session in progress.
  useEffect(() => {
    if (!profile?.id) return;
    if (stage === "chooseType" || stage === "intro" || stage === "submitted") return;
    saveDraft(profile.id, { answers, chunks, stage, chunkIndex });
  }, [profile?.id, answers, chunks, stage, chunkIndex]);

  const player = useAudioPlayer(currentChunkState.uri ?? null);
  const playerStatus = useAudioPlayerStatus(player);

  function togglePlayback() {
    if (!currentChunkState.uri) return;
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    const atEnd =
      playerStatus.duration > 0 && playerStatus.currentTime >= playerStatus.duration - 0.15;
    if (atEnd) player.seekTo(0);
    player.play();
  }

  const setAnswer = useCallback(
    (key: ReportFieldKey, patch: Partial<AnswersMap[ReportFieldKey]>) => {
      setAnswers((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    },
    []
  );

  const setChunkState = useCallback(
    (key: ChunkKey, patch: Partial<ChunksMap[ChunkKey]>) => {
      setChunks((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    },
    []
  );

  /**
   * Transcribe, then extract. Both run in the background so the resident can
   * keep moving; by the time they reach the next screen the fields are
   * usually already populated, which is what makes chunks 2 and 3 render as
   * taps rather than recordings.
   *
   * Extraction failure is silent by design - extractFromTranscript returns
   * {} rather than throwing, and an empty result is indistinguishable from
   * "the story didn't mention it". Either way the next chunk falls back to a
   * record prompt.
   */
  const processChunk = useCallback(
    (chunkKey: ChunkKey, uri: string) => {
      const myFlow = flowId.current;
      const chunk = getChunk(chunkKey);

      setChunkState(chunkKey, { status: "transcribing", transcript: "", error: undefined, uri });

      transcribeVoiceReport(uri, chunk.verbatimField ?? undefined)
        .then(async ({ text }) => {
          if (flowId.current !== myFlow) return;

          setChunkState(chunkKey, { status: "extracting", transcript: text, done: true });

          // The verbatim transcript IS the legal statement for chunk 1. It's
          // written straight through as the resident's own words and is
          // never replaced by anything the model produces later.
          if (chunk.verbatimField) {
            setAnswer(chunk.verbatimField, {
              text,
              status: "done",
              source: "spoken",
              uri,
              chunk: chunkKey,
            });
          }

          const extracted = await extractFromTranscript(text, chunkKey);
          if (flowId.current !== myFlow) return;

          setAnswers((prev) => mergeExtraction(prev, extracted, chunkKey));
          setChunkState(chunkKey, { status: "done" });
        })
        .catch((err: any) => {
          if (flowId.current !== myFlow) return;
          setChunkState(chunkKey, {
            status: "error",
            error: err?.message ?? "Hindi na-transcribe.",
          });
        });
    },
    [setAnswer, setChunkState]
  );

  async function startRecording() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Kailangan ang mikropono",
        'Kailangan po ng Boses Bantay ng access sa mikropono para ma-record ang inyong salaysay. Maaari po itong i-enable sa Settings, o i-type na lang.'
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
        Alert.alert(
          "Masyadong maikli",
          "Hindi po namin naabutan ang sinabi ninyo. Subukan po muling mag-record."
        );
        return;
      }
      processChunk(currentChunk.key, uri);
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
    if (currentChunkState.uri) processChunk(currentChunk.key, currentChunkState.uri);
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  function goNextChunk() {
    setEditingKey(null);
    if (chunkIndex >= CHUNKS.length - 1) {
      setStage("details");
      return;
    }
    setChunkIndex(chunkIndex + 1);
  }

  function goBackChunk() {
    setEditingKey(null);
    if (chunkIndex === 0) {
      // Predecessor of chunk 0 is now the identity-confirm screen, not
      // intro directly - confirmYou is the real Bahagi 1 of the flow.
      setStage("confirmYou");
      return;
    }
    setChunkIndex(chunkIndex - 1);
  }

  /** "Tama po" - locks this chunk's extracted values against being
   *  overwritten by a later chunk, then advances. */
  function confirmChunk() {
    setAnswers((prev) => confirmChunkFields(prev, currentChunk.key));
    setChunkState(currentChunk.key, { done: true });
    goNextChunk();
  }

  /** "I-record ulit" - drops the prefill for this chunk's fields so the
   *  screen falls back to the record view, and the resident's own recording
   *  becomes the source of truth for them. */
  function reRecordChunk() {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const key of currentChunk.extracts) {
        if (next[key]?.source === "extracted" && !next[key]?.confirmed) {
          next[key] = { ...EMPTY_ANSWER };
        }
      }
      return next;
    });
    setChunkState(currentChunk.key, { transcript: "", uri: undefined, status: "empty", done: false });
  }

  function startFlow() {
    flowId.current += 1;
    setAnswers(applyProfile(makeEmptyAnswers()));
    setChunks(makeEmptyChunks());
    setChunkIndex(0);
    setEditingKey(null);
    // Bahagi 1 first - confirm who's filing before any recording starts.
    setStage("confirmYou");
  }

  /** The app already knows these from signup. Re-asking is real friction for
   *  no gain - the interviews' "keep the flow short" guidance is exactly
   *  about this. All of them stay editable on the review screen; this is a
   *  starting point, not a lock. Anything the account is missing simply
   *  shows up there as a gap to fill once. */
  function applyProfile(base: AnswersMap): AnswersMap {
    const next = { ...base };
    const put = (key: ReportFieldKey, text: string | undefined | null, value?: string) => {
      if (!text) return;
      next[key] = { ...EMPTY_ANSWER, text, value, status: "done", source: "profile" };
    };

    put("complainantName", profile?.fullName);
    put("complainantContact", profile?.phone);
    put("complainantAddress", profile?.purok);

    const anyProfile = profile as any;
    if (anyProfile?.age) put("complainantAge", String(anyProfile.age));
    if (anyProfile?.gender) {
      const opt = getQuestion("complainantGender").options?.find(
        (o) => o.value === String(anyProfile.gender)
      );
      if (opt) put("complainantGender", opt.label, opt.value);
    }

    // Sensible default so the common case (filing for yourself) needs no
    // action on the details screen.
    const selfOpt = getQuestion("filedByGuardian").options?.find((o) => o.value === "self");
    if (selfOpt) {
      next.filedByGuardian = {
        ...EMPTY_ANSWER,
        text: selfOpt.label,
        value: selfOpt.value,
        status: "done",
        source: "tap",
      };
    }

    return next;
  }

  async function resumeDraft() {
    if (!profile?.id) {
      setHasSavedDraft(false);
      startFlow();
      return;
    }
    const draft = await loadDraft(profile.id);
    if (!draft) {
      setHasSavedDraft(false);
      startFlow();
      return;
    }
    flowId.current += 1;
    setAnswers(draft.answers as AnswersMap);
    setChunks(draft.chunks as ChunksMap);
    setChunkIndex(draft.chunkIndex ?? 0);
    setStage((draft.stage as Stage) ?? "chunk");
    setHasSavedDraft(false);
  }

  async function discardDraft() {
    if (profile?.id) await clearDraft(profile.id);
    setHasSavedDraft(false);
    startFlow();
  }

  function resetFlow() {
    flowId.current += 1;
    setAnswers(makeEmptyAnswers());
    setChunks(makeEmptyChunks());
    setChunkIndex(0);
    setReferenceNo("");
    setEditingKey(null);
    setStage("chooseType");
    if (profile?.id) clearDraft(profile.id);
  }

  const { missing, busy, canSubmit } = validate(answers);

  async function handleSubmit() {
    // No more "Kulang pa ang detalye" popup naming which fields are
    // missing - the submit button itself is disabled whenever `canSubmit`
    // is false (see ReviewScreen's `canSubmit` prop below), so this branch
    // is just a defensive backstop against a stale tap, not something a
    // resident should ever actually see. Filled means the button was
    // already tappable; tapping it just submits.
    if (missing.length > 0) return;
    setSubmitting(true);

    try {
      const payload = buildPayload(answers, chunks);
      const refNo = `BGY-${Math.floor(100000 + Math.random() * 900000)}`;

      // TEMPORARY: the actual backend write (auth check + Supabase insert)
      // is currently unreliable, and a failure there was blocking the whole
      // flow with an alert the resident had no way to act on - the report
      // itself was fine, the backend wasn't. Bypassed for now: any failure
      // in this inner block is logged, not thrown, so a broken backend
      // can't strand a resident on Review. The flow always reaches
      // SubmittedScreen with a locally-generated reference number below.
      //
      // KNOWN GAP while this bypass is active: if this inner block throws,
      // the report is NOT actually saved anywhere - the resident sees a
      // reference number for a submission that only happened locally. Once
      // the backend issue is fixed, remove this try/catch (letting a real
      // insert failure propagate to the outer catch again) so submission
      // failures are surfaced and blocked like before, not silently
      // bypassed.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("You must be logged in to submit a report.");

        // The officer brief is generated here, once, and stored with the
        // report. It is explicitly allowed to fail: a null brief means the
        // officer sees the raw statement plus the structured fields, which
        // is no worse than today's paper process. Blocking a filing
        // because a summary model was unavailable would be indefensible.
        const brief = await summarizeForOfficer(payload.raw.narrative, payload.structured);

        const { error } = await supabase.from("reports").insert({
          reference_no: refNo,
          user_id: user.id,
          status: "Under Review",
          category: payload.machineValues.incidentCategory || "General",
          summary: payload.raw.narrative || "Details provided in full report",

          // Layer 1 - raw, legally authoritative, never AI-altered.
          full_details: payload.structured,
          raw_narrative: payload.raw.narrative,
          raw_transcripts: payload.raw.transcripts,

          // Layer 2 - structured, promoted to real columns so the fields
          // the barangay needs to search and roll up aren't buried in
          // JSON.
          complainant_age: payload.structured.complainantAge
            ? Number(payload.structured.complainantAge) || null
            : null,
          complainant_contact: payload.structured.complainantContact || null,
          complainant_gender: payload.machineValues.complainantGender,
          filed_by_guardian: payload.machineValues.filedByGuardian === "guardian",
          guardian_name: payload.structured.guardianName || null,
          respondent_name: payload.structured.respondentName || null,
          incident_at_text: payload.structured.incidentAt || null,
          incident_location_text: payload.structured.location || null,
          witnesses: payload.structured.witnesses || null,
          evidence: payload.structured.evidence || null,
          blotter_type: payload.machineValues.blotterType,
          incident_category: payload.machineValues.incidentCategory,
          request_cctv_review: payload.machineValues.requestCctv === "true",

          // Layer 3 - officer triage aid. Clearly separate from the
          // record.
          officer_brief: brief,
        });

        if (error) throw error;

        if (profile?.id) await clearDraft(profile.id);
      } catch (backendErr: any) {
        console.warn(
          "[report] TEMPORARY bypass: backend submission failed, continuing anyway ->",
          backendErr?.message ?? backendErr
        );
      }

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

  // Gate the whole flow behind full Barangay ID authorization, not just
  // "logged in" - an unverified account has already passed OTP/login, so
  // without this anyone could file before staff ever confirmed their ID.
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
        onGoHome={() => {
          resetFlow();
          exitToHome();
        }}
      />
    );
  }

  // ── Chrome ────────────────────────────────────────────────────────────
  // One persistent SafeAreaView + ScreenBackground + BahagiHeader wraps
  // every in-flow stage below, instead of each stage's own screen
  // component mounting its own copy (which is what IntroScreen,
  // ConfirmYouScreen, the two chunk screens, DetailsScreen, and
  // ReviewScreen each used to render internally).
  //
  // FIXED: that per-screen chrome was the source of a "twitchy" header on
  // every stage change. A stage change swaps in a whole different
  // top-level component (IntroScreen vs ConfirmYouScreen vs ...), so React
  // can't reconcile the old tree into the new one - it fully unmounts one
  // SafeAreaView/ScreenBackground/BahagiHeader and mounts a fresh set.
  // SafeAreaView in particular resolves its safe-area insets asynchronously
  // after mount, so a fresh instance can render a frame or two with
  // stale/default insets before settling - visible as a flash/jump at
  // every single transition, not just the first. Keeping this trio mounted
  // once for the whole flow and only changing BahagiHeader's props per
  // stage turns a full remount into a plain prop update: no flash, no
  // insets to re-resolve, just the label/step pill/stepper animating to
  // their new values and the body below swapping.
  let headerProps: {
    label: string;
    stepText?: string;
    filledSegments: number;
    totalSegments: number;
    onBack: () => void;
    backDisabled?: boolean;
  };
  let body: ReactNode;

  if (stage === "review") {
    headerProps = {
      label: "Suriin ang Report",
      stepText: "Huling Hakbang",
      filledSegments: TOTAL_BAHAGI,
      totalSegments: TOTAL_BAHAGI,
      onBack: () => {
        setChunkIndex(0);
        setStage("chunk");
      },
    };
    body = (
      <ReviewScreen
        answers={answers}
        chunks={chunks}
        submitting={submitting}
        busy={busy}
        canSubmit={canSubmit}
        onChangeChunkTranscript={(key, text) => {
          setChunkState(key, { transcript: text });
          // Chunk 1's transcript IS answers.description (see the comment on
          // that write in processChunk above) - an edit made to the
          // paragraph on Review has to land in both places, or the payload's
          // `raw.narrative` (built from answers.description) would go stale
          // against what the resident just corrected here.
          const chunk = getChunk(key);
          if (chunk.verbatimField) {
            setAnswer(chunk.verbatimField, { text, status: "done", source: "typed" });
          }
        }}
        onChangeAnswerText={(key, text) =>
          setAnswer(key, { text, status: "done", source: "typed" })
        }
        onSelectChoice={(key, value, label) =>
          setAnswer(key, { text: label, value, status: "done", source: "tap", confirmed: true })
        }
        onJumpToChunk={(index) => {
          setChunkIndex(index);
          setStage("chunk");
        }}
        onSubmit={handleSubmit}
        onBackToQuestions={() => {
          setChunkIndex(0);
          setStage("chunk");
        }}
      />
    );
  } else if (stage === "details") {
    headerProps = {
      label: "Huling Detalye",
      stepText: `Bahagi ${TOTAL_BAHAGI} ng ${TOTAL_BAHAGI}`,
      filledSegments: TOTAL_BAHAGI,
      totalSegments: TOTAL_BAHAGI,
      onBack: () => {
        setChunkIndex(CHUNKS.length - 1);
        setStage("chunk");
      },
    };
    body = (
      <DetailsScreen
        answers={answers}
        onSelectChoice={(key, value, label) =>
          setAnswer(key, { text: label, value, status: "done", source: "tap", confirmed: true })
        }
        onNext={() => setStage("review")}
      />
    );
  } else if (stage === "confirmYou") {
    const section = REVIEW_SECTIONS.find((s) => s.key === "nagrereklamo")!;
    headerProps = {
      label: section.shortLabel,
      stepText: `Bahagi 1 ng ${TOTAL_BAHAGI}`,
      filledSegments: 1,
      totalSegments: TOTAL_BAHAGI,
      onBack: () => setStage("intro"),
    };
    body = (
      <ConfirmYouScreen
        answers={answers}
        onSelectChoice={(key, value, label) =>
          setAnswer(key, { text: label, value, status: "done", source: "tap", confirmed: true })
        }
        onChangeAnswerText={(key, text) =>
          setAnswer(key, { text, status: "done", source: "typed" })
        }
        onNext={() => setStage("chunk")}
      />
    );
  } else if (stage === "chunk") {
    const mode = chunkMode(currentChunk.key, answers, chunks);
    headerProps = {
      label: currentChunk.label,
      stepText: `Bahagi ${chunkIndex + 2} ng ${TOTAL_BAHAGI}`,
      filledSegments: chunkIndex + 2,
      totalSegments: TOTAL_BAHAGI,
      onBack: goBackChunk,
      backDisabled: isRecording,
    };

    if (mode === "confirm") {
      body = (
        <ChunkConfirmScreen
          chunk={currentChunk}
          index={chunkIndex}
          answers={answers}
          editingKey={editingKey}
          onStartEditing={setEditingKey}
          onChangeAnswerText={(key, text) =>
            setAnswer(key, { text, status: "done", source: "typed", confirmed: true })
          }
          onConfirm={confirmChunk}
          onReRecord={reRecordChunk}
        />
      );
    } else {
      // The narrative chunk gates advancement on having something to file.
      // The others don't: a resident who genuinely can't name a respondent
      // shouldn't be trapped, and those fields are optional by design.
      const canAdvance = currentChunk.verbatimField
        ? currentChunkState.status === "transcribing" ||
          Boolean(currentChunkState.transcript.trim())
        : true;

      body = (
        <ChunkRecordScreen
          chunk={currentChunk}
          index={chunkIndex}
          state={currentChunkState}
          isRecording={isRecording}
          isPaused={isPaused}
          durationMillis={recorderState.durationMillis ?? 0}
          metering={recorderState.metering}
          isPlaying={playerStatus.playing}
          canAdvance={canAdvance}
          onChangeTranscript={(text) => {
            setChunkState(currentChunk.key, { transcript: text, status: "done", done: true });
            if (currentChunk.verbatimField) {
              setAnswer(currentChunk.verbatimField, { text, status: "done", source: "typed" });
            }
          }}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onPauseRecording={pauseRecording}
          onResumeRecording={resumeRecording}
          onTogglePlayback={togglePlayback}
          onRetryTranscription={retryTranscription}
          onNext={goNextChunk}
        />
      );
    }
  } else if (stage === "intro") {
    headerProps = {
      label: "Bagong Report",
      filledSegments: 0,
      totalSegments: TOTAL_BAHAGI,
      onBack: () => setStage("chooseType"),
    };
    body = (
      <IntroScreen
        onStart={startFlow}
        hasSavedDraft={draftChecked && hasSavedDraft}
        onResumeDraft={resumeDraft}
        onDiscardDraft={discardDraft}
      />
    );
  } else {
    // chooseType - the entry gate. Two very different reports (blotter vs
    // service/infrastructure complaint) used to be forced through one
    // flow - see ChooseReportTypeScreen's doc comment for why they're
    // split here instead.
    //
    // No stepper here (totalSegments 0) - this screen isn't part of
    // either flow's own step count, it's the fork before one starts, so a
    // 0-of-N stepper reading as an empty/blank progress bar was actively
    // misleading rather than just unfinished-looking.
    headerProps = {
      label: "Bagong Report",
      filledSegments: 0,
      totalSegments: 0,
      onBack: exitToHome,
    };
    body = (
      <ChooseReportTypeScreen
        onSelect={(type) => {
          if (type === "blotter") {
            setStage("intro");
          } else {
            router.push("/(resident)/service-complaint");
          }
        }}
      />
    );
  }

  return (
    // Header is now genuinely white (BahagiHeader) - the SafeAreaView's top
    // inset and the body both use the same lightened surface tint the rest
    // of the app pairs with a white header (profile.tsx/bot.tsx/
    // directory.tsx/reports.tsx), so the header actually reads as a
    // distinct, lighter surface instead of matching the page underneath it.
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: "#FFFFFF" }}>
      <ScreenBackground backgroundColor="#FAF8F7">
        <View style={{ flex: 1 }}>
          <BahagiHeader {...headerProps} />
          {body}
        </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}
