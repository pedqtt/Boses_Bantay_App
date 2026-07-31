import { useEffect, useRef } from "react";
import { View, Animated, Easing } from "react-native";

const WAVEFORM_BARS = 21;
const WAVEFORM_MIN_H = 5;
const WAVEFORM_MAX_H = 40;

/** dB metering (~-60 silence to 0 loud) normalized to a plain 0..1 level. */
function normalizeLevel(metering: number | undefined) {
  return Math.max(0, Math.min(1, ((metering ?? -60) + 55) / 55));
}

/**
 * Live waveform / equalizer-style bar chart, the same visual language as a
 * phone's native voice recorder — a row of bars that visibly react to actual
 * voice level in real time, not a decorative loop animation. Each bar is
 * driven by `metering` (dB level, sampled ~150ms by the caller via
 * useAudioRecorderState) with a per-bar phase offset so the bars don't all
 * move in lockstep — that variation across bars is what reads as "tracking
 * pitch/energy" rather than one meter repeated 21 times. Height changes are
 * short, eased Animated.timing calls so it's visibly alive rather than
 * snapping between fixed states.
 */
export function LiveWaveform({ metering, isActive }: { metering: number | undefined; isActive: boolean }) {
  const bars = useRef(
    Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(WAVEFORM_MIN_H))
  ).current;
  const tick = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    const level = normalizeLevel(metering);
    tick.current += 1;
    const t = tick.current;

    bars.forEach((val, i) => {
      // Each bar gets its own phase (i * 0.85) so at a steady volume the
      // bars still ripple relative to each other, like real frequency bands
      // — not a single number rendered 21 times.
      const wobble = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.5 + i * 0.85));
      const target = WAVEFORM_MIN_H + level * (WAVEFORM_MAX_H - WAVEFORM_MIN_H) * wobble;
      Animated.timing(val, {
        toValue: Math.max(WAVEFORM_MIN_H, target),
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false, // animating height, not transform/opacity
      }).start();
    });
  }, [metering, isActive, bars]);

  return (
    <View className="flex-row items-center justify-center gap-[3px]" style={{ height: WAVEFORM_MAX_H }}>
      {bars.map((val, i) => (
        <Animated.View
          key={i}
          // Fully pill-capped (radius = half the bar's width) instead of a
          // slightly-squared 2px radius — softer, smoother silhouette for
          // the whole waveform without changing how it behaves.
          style={{ width: 3.5, borderRadius: 1.75, backgroundColor: "#1D4ED8", height: val }}
        />
      ))}
    </View>
  );
}
