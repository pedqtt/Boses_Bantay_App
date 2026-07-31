import { useCallback, useRef } from "react";
import { findNodeHandle, ScrollView, UIManager, type LayoutChangeEvent } from "react-native";

// Deliberately structural rather than importing RN's
// NativeSyntheticEvent<TextInputFocusEventData>: the installed RN/React 19
// type defs disagree about TextInput's onFocus signature, and this hook only
// ever reads `target`. Accepting the minimal shape it actually uses keeps it
// assignable to onFocus on both TextInput and any other focusable component,
// without casting at every call site.
type FocusLike = {
  target: unknown;
};

// Scroll-into-view: centers the focused input within the space actually
// left above the keyboard, instead of just nudging it barely clear of the
// keyboard's top edge. Same measureLayout technique the keyboard-aware
// scroll-view libraries use internally, inlined here instead of adding a
// third-party dependency — this project has already hit enough Expo SDK /
// native-module version mismatches that a new package touching native
// measurement APIs is a real risk, not a convenience.
//
// containerHeight is captured once, on first layout, before the keyboard
// ever opens — that's the full available screen height. Positioning the
// field at ~35% down from the top of that height approximates "centered
// in the visible focal zone" across device sizes without needing exact,
// platform-inconsistent keyboard-height arithmetic (iOS pads the
// container, Android resizes it — reconciling both reliably needs more
// moving parts than this app's short forms actually require).
//
// Usage:
//   const { scrollRef, handleFocus, handleContainerLayout } = useKeyboardFocusScroll();
//   <ScrollView ref={scrollRef} onLayout={handleContainerLayout}>
//     <TextInput onFocus={handleFocus} />
export function useKeyboardFocusScroll(focalZoneRatio = 0.35) {
  const scrollRef = useRef<ScrollView>(null);
  const containerHeight = useRef(0);
  const hasMeasured = useRef(false);

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    if (hasMeasured.current) return; // capture the pre-keyboard height once
    containerHeight.current = e.nativeEvent.layout.height;
    hasMeasured.current = true;
  }, []);

  const handleFocus = useCallback(
    (e: FocusLike) => {
      // Calling `.measureLayout()` directly on the focused component's ref
      // (e.target) is the old-architecture pattern, and it's unreliable
      // under Fabric/New Architecture — the ref you get back there is a
      // public-instance wrapper that doesn't always expose measureLayout,
      // producing "ref.measureLayout must be called with a ref to a native
      // component" even though the component IS native. Going through
      // UIManager.measureLayout with plain node handles (via
      // findNodeHandle) works the same way on both architectures, because
      // it doesn't depend on what shape the ref object happens to be.
      const targetNode = findNodeHandle(e.target as any);
      const scrollNode = findNodeHandle(scrollRef.current);
      if (!targetNode || !scrollNode) return;

      // Give the keyboard a beat to start animating in before scrolling,
      // so the pan reads as one smooth motion rather than two competing
      // ones (keyboard sliding up + scroll jump happening separately).
      setTimeout(() => {
        UIManager.measureLayout(
          targetNode,
          scrollNode,
          () => {}, // onFail — silently skip the scroll rather than throw
          (_x: number, y: number) => {
            const focalY = containerHeight.current * focalZoneRatio;
            scrollRef.current?.scrollTo({ y: Math.max(y - focalY, 0), animated: true });
          }
        );
      }, 60);
    },
    [focalZoneRatio]
  );

  return { scrollRef, handleFocus, handleContainerLayout };
}
