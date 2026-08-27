import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/lib/theme";

const WAVEFORM_BARS = 27;
const WAVEFORM_MIN_H = 5;
const WAVEFORM_MAX_H = 40;
const CENTER = (WAVEFORM_BARS - 1) / 2;
const MIN_SCALE = WAVEFORM_MIN_H / WAVEFORM_MAX_H;
// One full ripple cycle across the row. A single continuously-looping value
// drives every bar's motion (see PHASE below) instead of each bar running
// its own repeating timer - lighter (one animation instead of
// WAVEFORM_BARS of them) and reads as a genuine traveling ripple rather
// than bars independently flickering.
const PHASE_DURATION_MS = 1400;

/** dB metering (~-60 silence to 0 loud) normalized to a plain 0..1 level. */
function normalizeLevel(metering: number | undefined) {
  return Math.max(0, Math.min(1, ((metering ?? -60) + 55) / 55));
}

// Center-weighted envelope - bars near the middle of the row swing taller
// than bars near the edges, the same silhouette a real equalizer/Siri-style
// voice wave has, so the row reads as one wave shape rather than
// independently random bars.
const BAR_WEIGHT = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
  const distance = Math.abs(i - CENTER) / CENTER; // 0 at center, 1 at the edges
  return 1 - 0.55 * distance;
});
// Same envelope drives a faint opacity taper - center bars read slightly
// brighter than the edges, reinforcing the wave shape even in a single
// still frame.
const BAR_OPACITY = BAR_WEIGHT.map((w) => 0.6 + 0.4 * w);
// Each bar's position along the ripple, in radians - what makes adjacent
// bars peak a beat apart instead of every bar moving in lockstep.
const BAR_PHASE_OFFSET = Array.from({ length: WAVEFORM_BARS }, (_, i) => i * 0.7);

type Phase = SharedValue<number>;
type Level = SharedValue<number>;

/**
 * One bar. Deliberately has no shared value, no effect, and no timer of its
 * own - its entire motion is `useAnimatedStyle` reading the two values the
 * parent owns (`phase`, `level`) and running a plain trig expression as a
 * worklet on the UI thread. WAVEFORM_BARS of these costs one extra style
 * recalculation per frame each, not WAVEFORM_BARS separate animations - the
 * whole waveform runs on exactly two `withTiming`/`withRepeat` calls no
 * matter how many bars it has.
 *
 * The glow is driven by the same `level` value as the bar's height, not a
 * separate animation - it only appears once there's actually voice above
 * the quiet baseline, brightening and dimming with it rather than glowing
 * constantly. Kept deliberately faint (low shadowOpacity, tight radius) so
 * it reads as "this bar is live" rather than a decorative halo.
 */
function Bar({ index, phase, level }: { index: number; phase: Phase; level: Level }) {
  const animatedStyle = useAnimatedStyle(() => {
    const wobble = 0.5 + 0.5 * Math.abs(Math.sin(phase.value * Math.PI * 2 + BAR_PHASE_OFFSET[index]));
    const scale = Math.max(MIN_SCALE, level.value * wobble * BAR_WEIGHT[index]);

    // 0 right at the quiet baseline, ramping up to a still-subtle max as
    // the live level climbs - so silence stays flat and only real voice
    // brings the glow in.
    const glow = interpolate(level.value, [MIN_SCALE, 0.85], [0, 1], Extrapolation.CLAMP) * BAR_WEIGHT[index];

    return {
      transform: [{ scaleY: scale }],
      // Cross-platform half of the glow: bars brighten toward full opacity
      // as voice comes in, instead of sitting at their static resting
      // opacity - visible on Android too, where a colored shadow isn't.
      opacity: BAR_OPACITY[index] + (1 - BAR_OPACITY[index]) * glow,
      // iOS half of the glow: an actual soft blue halo around the bar.
      shadowColor: colors.primary,
      shadowOpacity: glow * 0.5,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: 3.5,
          height: WAVEFORM_MAX_H,
          borderRadius: 1.75,
          backgroundColor: colors.primary,
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * Live waveform / equalizer-style bar chart, the same visual language as a
 * phone's native voice recorder. `level` (from `metering`, sampled ~150ms
 * by the caller) sets the wave's amplitude; a continuously-looping `phase`
 * value - not tied to the metering tick rate at all - drives the actual
 * ripple motion, so the wave keeps flowing smoothly between metering
 * updates instead of visibly stepping every ~150ms.
 *
 * Spans the full width of its container (`justify-content: space-between`
 * rather than a fixed gap) so it fills the space available to it instead of
 * sitting as a narrow island in the middle of the recording card.
 */
export function LiveWaveform({ metering, isActive }: { metering: number | undefined; isActive: boolean }) {
  const level = useSharedValue(MIN_SCALE);
  const phase = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      phase.value = withRepeat(withTiming(1, { duration: PHASE_DURATION_MS, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(phase);
    }
    return () => cancelAnimation(phase);
  }, [isActive, phase]);

  useEffect(() => {
    const target = isActive ? Math.max(MIN_SCALE, normalizeLevel(metering)) : MIN_SCALE;
    level.value = withTiming(target, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [metering, isActive, level]);

  return (
    <View
      className="flex-row items-center w-full"
      style={{ height: WAVEFORM_MAX_H, justifyContent: "space-between" }}
    >
      {Array.from({ length: WAVEFORM_BARS }, (_, i) => (
        <Bar key={i} index={i} phase={phase} level={level} />
      ))}
    </View>
  );
}
