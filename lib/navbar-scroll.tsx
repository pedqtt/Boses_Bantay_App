import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useFocusEffect } from "expo-router";
import { advanceNavbarScroll, type NavbarScrollState } from "@/lib/navbar-scroll-logic";

const NavbarScrollContext = createContext({ setHidden: (_hidden: boolean) => {}, bottomPadding: 128 });
export const NavbarScrollProvider = NavbarScrollContext.Provider;

export function useNavbarScrollController(route: string, height: number) {
  const progress = useRef(new Animated.Value(0)).current;
  const hidden = useRef(false);
  const screenReader = useRef(false);
  const reducedMotion = useRef(false);
  const setHidden = useCallback((next: boolean) => {
    if (screenReader.current) next = false;
    if (hidden.current === next) return;
    hidden.current = next;
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: next ? 1 : 0, duration: reducedMotion.current ? 0 : next ? 200 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [progress]);
  useEffect(() => { setHidden(false); }, [route, height, setHidden]);
  useEffect(() => {
    let active = true;
    const updateReader = (enabled: boolean) => { if (active) { screenReader.current = enabled; if (enabled) setHidden(false); } };
    const updateMotion = (enabled: boolean) => { if (active) reducedMotion.current = enabled; };
    void AccessibilityInfo.isScreenReaderEnabled().then(updateReader).catch(() => {});
    void AccessibilityInfo.isReduceMotionEnabled().then(updateMotion).catch(() => {});
    const reader = AccessibilityInfo.addEventListener("screenReaderChanged", updateReader);
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", updateMotion);
    return () => { active = false; reader.remove(); motion.remove(); progress.stopAnimation(); };
  }, [progress, setHidden]);
  const value = useMemo(() => ({ setHidden, bottomPadding: Math.max(110, height + 24) }), [setHidden, height]);
  return { value, translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height + 32] }) };
}

/** Attach only to the screen's primary list, not nested sheets or previews. */
export function useNavbarScroll() {
  const { setHidden, bottomPadding } = useContext(NavbarScrollContext);
  const focused = useRef(false);
  const state = useRef<NavbarScrollState>({ y: null, travel: 0 });
  useFocusEffect(useCallback(() => {
    focused.current = true;
    state.current = { y: null, travel: 0 };
    setHidden(false);
    return () => { focused.current = false; };
  }, [setHidden]));
  const onScrollBeginDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    state.current = { y: Math.max(0, event.nativeEvent.contentOffset.y), travel: 0 };
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!focused.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const next = advanceNavbarScroll(state.current, contentOffset.y, contentSize.height - layoutMeasurement.height);
    state.current = next.state;
    if (next.hidden !== undefined) setHidden(next.hidden);
  }, [setHidden]);
  return { onScroll, onScrollBeginDrag, scrollEventThrottle: 16, bottomPadding };
}
