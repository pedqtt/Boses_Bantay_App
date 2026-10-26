import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { saveRecordedClip } from "@/lib/api/recordingFile";
import { transcribeVoiceReport } from "@/lib/api/transcribe";
import { RecordControls } from "./RecordControls";
import { AnswerEditor } from "./AnswerEditor";

export type VoiceDescriptionDraft = {
  clips: string[];
  pending?: { uri: string; base: string };
  error?: string;
};

/** Transcript-only voice input. The parent retains clips and retry state between steps. */
export function VoiceDescriptionInput({ value, onChangeText, draft, onDraftChange, onBusyChange }: {
  value: string; onChangeText: (value: string) => void;
  draft: VoiceDescriptionDraft; onDraftChange: (draft: VoiceDescriptionDraft) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 150);
  const player = useAudioPlayer(null);
  const playback = useAudioPlayerStatus(player);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [working, setWorking] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const take = useRef<{ base: string; clips: string[] } | null>(null);
  const queue = useRef<string[]>([]);
  const playbackStarted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queue.current = [];
      try { player.pause(); } catch { /* Native hooks release their objects on unmount. */ }
      try { void recorder.stop().catch(() => {}); } catch { /* May already be released. */ }
    };
  }, [player, recorder]);
  useEffect(() => {
    if (!playback.didJustFinish) return;
    const next = queue.current.shift();
    if (next) { player.replace(next); player.play(); }
    else playbackStarted.current = false;
  }, [playback.didJustFinish, player]);

  function setBusy(busy: boolean) {
    locked.current = busy;
    if (mounted.current) { setWorking(busy); onBusyChange(busy); }
  }
  function stopPlayback() {
    queue.current = []; playbackStarted.current = false; player.pause();
  }
  async function transcribe(pending: { uri: string; base: string }, clips: string[]) {
    setBusy(true);
    onDraftChange({ clips, pending });
    try {
      const { text } = await transcribeVoiceReport(pending.uri, "description");
      if (!mounted.current) return;
      onChangeText([pending.base.trim(), text.trim()].filter(Boolean).join("\n\n"));
      onDraftChange({ clips });
    } catch (error) {
      if (mounted.current) onDraftChange({ clips, pending,
        error: error instanceof Error ? error.message : "Hindi na-transcribe. Pakisubukan muli." });
    } finally { if (mounted.current) setBusy(false); }
  }
  async function start(append: boolean) {
    if (locked.current) return;
    setBusy(true);
    try {
      stopPlayback();
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!mounted.current) return;
      if (!granted) { Alert.alert("Kailangan ang mikropono", "Payagan ang microphone sa Settings, o i-type na lang ang paglalarawan."); setBusy(false); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!mounted.current) { await recorder.stop(); return; }
      take.current = { base: append ? value : "", clips: append ? [...draft.clips] : [] };
      recorder.record(); setRecording(true); setPaused(false); setWorking(false);
    } catch (error) {
      if (mounted.current) { setBusy(false); Alert.alert("Hindi makapag-record", error instanceof Error ? error.message : "Subukan po muli."); }
    }
  }
  async function stop() {
    const current = take.current;
    if (!current) return;
    take.current = null;
    const duration = Math.max(recorderState.durationMillis ?? 0, recorder.currentTime * 1000);
    setWorking(true);
    try {
      await recorder.stop();
      if (!mounted.current) return;
      setRecording(false); setPaused(false);
      if (!recorder.uri || duration < 1000) {
        Alert.alert("Masyadong maikli", "Mag-record po nang hindi bababa sa isang segundo."); setBusy(false); return;
      }
      const uri = await saveRecordedClip(recorder.uri);
      if (!mounted.current) return;
      await transcribe({ uri, base: current.base }, [...current.clips, uri]);
    } catch (error) {
      if (mounted.current) { setRecording(false); setPaused(false); setBusy(false); Alert.alert("Hindi na-save ang recording", error instanceof Error ? error.message : "Subukan po muli."); }
    }
  }
  function togglePlayback() {
    if (locked.current || !draft.clips.length) return;
    if (playback.playing) { player.pause(); return; }
    if (playbackStarted.current) { player.play(); return; }
    queue.current = draft.clips.slice(1); playbackStarted.current = true;
    player.replace(draft.clips[0]); player.play();
  }
  function pauseResume(resume: boolean) {
    try { if (resume) recorder.record(); else recorder.pause(); setPaused(!resume); }
    catch { Alert.alert("Hindi maipagpatuloy", "Subukan po muli ang recording control."); }
  }
  return <View>
    <View className="mb-6">
      <RecordControls isRecording={recording} isPaused={paused}
        durationMillis={recorderState.durationMillis ?? 0} metering={recorderState.metering}
        answerStatus={working ? "transcribing" : draft.error ? "error" : draft.clips.length ? "done" : "empty"}
        hasRecording={Boolean(draft.clips.length)} isPlaying={playback.playing}
        onStart={() => { void start(false); }} onAppend={() => { void start(true); }}
        onStop={() => { void stop(); }} onPause={() => pauseResume(false)} onResume={() => pauseResume(true)}
        onTogglePlayback={togglePlayback} />
    </View>
    <AnswerEditor editable={!recording} value={value} onChangeText={text => {
      if (locked.current) return;
      onChangeText(text);
      // A manual edit becomes the new base if the failed appended clip is retried.
      if (draft.pending) onDraftChange({ ...draft, pending: { ...draft.pending, base: text } });
    }} placeholder="I-record o i-type ang paglalarawan ng problema..."
      isTranscribing={working} transcribingLabel="Ginagawa ang transcript..." tall
      errorMessage={draft.error}
      onRetry={draft.pending ? () => {
        if (!locked.current && draft.pending) { stopPlayback(); void transcribe(draft.pending, draft.clips); }
      } : undefined} />
  </View>;
}
