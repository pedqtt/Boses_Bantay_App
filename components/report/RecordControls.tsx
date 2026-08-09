import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import { LiveWaveform } from "./LiveWaveform";
import { CircleControl, CIRCLE_CONTROL_FRAME_SIZE } from "./CircleControl";
import type { AnswerStatus } from "./types";

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type RecordControlsProps = {
  isRecording: boolean;
  isPaused: boolean;
  durationMillis: number;
  metering: number | undefined;
  answerStatus: AnswerStatus;
  hasRecording: boolean;
  isPlaying: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onTogglePlayback: () => void;
};

/**
 * The recording control cluster — the single largest interactive area on the
 * step screen (Fitts's Law: the action you'll take most/first should be the
 * easiest to hit).
 *
 * Centered is the default for every state here, not a per-state choice —
 * the outer wrapper is always `items-center`, and the button row is always
 * `justify-center`, whether there's one control showing or two.
 *
 * Two distinct states, same layout shape on purpose (Consistency &
 * Reusable Patterns): a primary CircleControl on the left, a secondary one
 * on the right, separated by the same centered divider —
 *  - Recording: Stop (primary/danger, does the one thing you need most —
 *    keep this take and move on) next to Pause/Resume (secondary — "give me
 *    a second," a real pause via expo-audio's recorder, not a decorative
 *    button).
 *  - Idle: Record (primary) next to Play/Pause-playback (secondary), once a
 *    take exists.
 * Same two-column shape both times means a resident who's learned "primary
 * control left, secondary control right" once doesn't have to re-learn the
 * layout when the screen switches from recording to idle.
 *
 * There used to be a third control here (Kanselahin, discard-and-restart).
 * It's gone: Stop already covers "I'm done" and now Pause covers "wait,"
 * so a plain-text/icon-only escape hatch that only ever demoted itself
 * (smaller, fainter, extra spacing) was solving a problem the two real
 * controls already solve better.
 */
export function RecordControls({
  isRecording,
  isPaused,
  durationMillis,
  metering,
  answerStatus,
  hasRecording,
  isPlaying,
  onStart,
  onStop,
  onPause,
  onResume,
  onTogglePlayback,
}: RecordControlsProps) {
  // Drives the "Nakikinig" dot's blink - a slow opacity pulse rather than a
  // hard on/off flash, so it reads as "actively listening" without being
  // distracting next to the timer. Stops and snaps back to fully opaque the
  // moment recording pauses or ends, so a static dot never looks like it's
  // mid-animation.
  const dotPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRecording || isPaused) {
      dotPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 0.35,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, isPaused, dotPulse]);

  if (isRecording) {
    return (
      <View className="items-center py-2">
        {/* STATUS group — no card at all now: no fill, no border, no
            rounded panel. Plain, sitting directly on the screen's own
            white background so recording doesn't visually change the
            page into "a different surface" — just the timer, dot/label,
            and waveform, floating on the same white as everything else.
            Gestalt proximity still groups the timer with its dot/label
            (tight, mb-3) and separates it from the waveform (a real gap,
            mt-6) purely through whitespace, no boundary needed to prove
            it. Bars are also fully pill-capped (radius = half their
            width) for a softer, smoother waveform silhouette than the
            previous slightly-squared ends. */}
        <View className="items-center px-6 py-7 mb-6 w-full">
          <View className="flex-row items-center mb-3">
            <Animated.View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginRight: 8,
                backgroundColor: isPaused ? "#9CA3AF" : colors.error,
                opacity: dotPulse,
                // Subtle glow, not a spotlight - low opacity, small radius,
                // so it reads as "this dot is alive" without competing with
                // the timer directly above it. Off entirely while paused.
                shadowColor: colors.error,
                shadowOpacity: isPaused ? 0 : 0.55,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
            <Text className={`text-[13px] font-medium ${isPaused ? "text-ink-faint" : "text-ink-soft"}`}>
              {isPaused ? "Naka-pause" : "Nakikinig"}
            </Text>
          </View>

          <Text
            className={`text-[38px] font-bold tracking-tight ${isPaused ? "text-ink-faint" : "text-ink"}`}
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatDuration(durationMillis)}
          </Text>

          <View className="mt-6 w-full">
            <LiveWaveform metering={metering} isActive={isRecording && !isPaused} />
          </View>
        </View>

        {/* ACTION group — same two-column shape as the idle state's
            Record/Play row: primary control left, secondary right, same
            centered divider between them. */}
        <View className="flex-row items-start justify-center">
          <CircleControl icon="stop" label="I-tap para tumigil" variant="danger" onPress={onStop} />

          <View
            style={{ height: CIRCLE_CONTROL_FRAME_SIZE, width: 40 }}
            className="items-center justify-center"
          >
            <View className="w-px h-16 bg-gray-200" />
          </View>

          <CircleControl
            icon={isPaused ? "play" : "pause"}
            label={isPaused ? "Ipagpatuloy" : "I-pause"}
            variant="secondary"
            diameter={64}
            iconSize={22}
            onPress={isPaused ? onResume : onPause}
          />
        </View>
      </View>
    );
  }

  const recordLabel = answerStatus === "done" || answerStatus === "error" ? "I-record muli" : "I-record";
  const recordIcon = answerStatus === "done" || answerStatus === "error" ? "refresh" : "mic";

  return (
    <View className="items-center py-2">
      <View className="flex-row items-start justify-center">
        <CircleControl
          icon={recordIcon}
          label={recordLabel}
          variant="primary"
          onPress={onStart}
          iconSize={38}
        />

        {/* Divider sits in its own centered column, sized to the same
            button-frame height as the controls, so it visually spans
            "between the buttons" rather than being an arbitrary rule. */}
        {hasRecording && (
          <View
            style={{ height: CIRCLE_CONTROL_FRAME_SIZE, width: 40 }}
            className="items-center justify-center"
          >
            <View className="w-px h-16 bg-gray-200" />
          </View>
        )}

        {/* Playback — hear yourself back before trusting the transcript.
            Same CircleControl as the record button above, just the
            secondary variant and a smaller diameter. */}
        {hasRecording && (
          <CircleControl
            icon={isPlaying ? "pause" : "play"}
            label={isPlaying ? "I-pause" : "Pakinggan"}
            variant="secondary"
            diameter={64}
            iconSize={22}
            onPress={onTogglePlayback}
          />
        )}
      </View>
    </View>
  );
}
