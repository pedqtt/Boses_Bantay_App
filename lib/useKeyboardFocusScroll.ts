import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  findNodeHandle,
  Keyboard,
  Platform,
  ScrollView,
  UIManager,
  type LayoutChangeEvent,
} from "react-native";

// Deliberately structural rather than importing RN's
// NativeSyntheticEvent<TextInputFocusEventData>: the installed RN/React 19
// type defs disagree about TextInput's onFocus signature, and this hook only
// ever reads `target`. Accepting the minimal shape it actually uses keeps it
// assignable to onFocus on both TextInput and any other focusable component,
// without casting at every call site.
type FocusLike = {
  target: unknown;
};

/**
 * Slides the focused input up to rest just above the keyboard, the way a
 * messaging app's composer does, without moving the rest of the layout.
 *
 * WHY THE EARLIER VERSIONS DID NOTHING
 * ------------------------------------
 * The auth screens lay out as `contentContainerStyle={{ flexGrow: 1 }}`
 * wrapping `flex-1` zones - meaning the content is sized to exactly fill
 * the ScrollView, never more. A ScrollView's scrollable range is
 * (contentHeight - containerHeight), so that arrangement gives a range of
 * exactly ZERO: `scrollTo()` was being called with correct numbers and
 * silently doing nothing, because there was nowhere to scroll to. On
 * Android this is compounded by `windowSoftInputMode="adjustResize"` (set
 * in AndroidManifest.xml): the window shrinks when the keyboard opens, but
 * because the content is flex-based it shrinks right along with it, so the
 * range stays zero.
 *
 * The fix is `keyboardSpacer`: while the keyboard is open, screens add it
 * as extra bottom padding on the scroll content. That's what creates the
 * scroll range in the first place - without it there is no amount of
 * scroll math that can move anything. Only then can scrollTo actually
 * bring the field up.
 *
 * Two triggers, because focus and keyboard-shown don't arrive in a fixed
 * order: tapping a field when the keyboard is already open fires focus
 * with a known height (position immediately), while tapping one from a
 * closed keyboard fires focus first and the height only arrives later
 * (position again once the show event lands, using the remembered field).
 *
 * NOTE: these screens deliberately do NOT use KeyboardAvoidingView. That
 * component resizes/pads the container, which squeezed the flexible middle
 * zone and dragged the bottom action cluster up the screen every time a
 * field was focused. This hook scrolls instead of resizing, so the layout
 * stays put and only the scroll offset changes.
 *
 * Usage:
 *   const { scrollRef, handleFocus, handleContainerLayout, handleScroll, keyboardSpacer }
 *     = useKeyboardFocusScroll();
 *   <ScrollView
 *     ref={scrollRef}
 *     onLayout={handleContainerLayout}
 *     onScroll={handleScroll}
 *     scrollEventThrottle={16}
 *     contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardSpacer }}
 *   >
 *     <TextInput onFocus={handleFocus} />
 */

/** Breathing room between the bottom of the field and the top of the
 *  keyboard. This has to cover more than just the input box itself.
 *  register.tsx's Field (and reset-password.tsx) render the hint AND the
 *  error line at the same time once a field has one - "hint always
 *  visible, error appended below it, not swapped in for it" - so what's
 *  actually below a field can be two stacked lines, not one: e.g.
 *  PASSWORD_REQUIREMENTS_HINT followed by a validation error, each
 *  ~20-24px with its own margin. 56 only budgeted for a single line and
 *  was still clipping the second one. 96 covers hint + error + a wrapped
 *  second line on either, with room left over. */
const GAP_ABOVE_KEYBOARD = 96;

export function useKeyboardFocusScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const containerHeight = useRef(0);
  const keyboardHeight = useRef(0);
  // State (not just the ref above) because this one has to trigger a
  // re-render: it's rendered as real padding on the scroll content, and
  // that padding is what gives the ScrollView something to scroll.
  const [keyboardSpacer, setKeyboardSpacer] = useState(0);
  // The field currently being edited, remembered so the show handler can
  // re-run positioning once the keyboard height is actually known.
  const focusedNode = useRef<number | null>(null);
  // measureLayout reports a field's position within the scroll CONTENT,
  // while scrollTo takes an absolute content offset - converting between
  // them needs the current offset.
  const scrollY = useRef(0);

  // Remeasured on every layout pass, not captured once: on Android
  // (adjustResize) this value genuinely changes when the keyboard opens,
  // and a stale pre-keyboard height would put the target in the wrong
  // place by exactly the keyboard's height.
  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    containerHeight.current = e.nativeEvent.layout.height;
  }, []);

  const handleScroll = useCallback((e: any) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  /**
   * Scrolls so the bottom edge of `node` (plus GAP_ABOVE_KEYBOARD, to also
   * clear whatever hint/error line sits under it) rests above the
   * keyboard.
   *
   * WHY NOT scrollResponderScrollNativeHandleToKeyboard
   * ----------------------------------------------------
   * That was the previous approach here, on the theory that RN's own
   * built-in helper would be more reliable than hand-rolled math. It
   * wasn't: that helper computes
   *   scrollOffsetY = contentRelativeTop - keyboardScreenY + fieldHeight
   * which mixes two different coordinate spaces - `contentRelativeTop`
   * comes from measureLayout against the scroll view's *content*, while
   * `keyboardScreenY` is a *screen* coordinate. Those only line up if the
   * ScrollView happens to start flush at the top of the window with
   * nothing scrolled - not true here (there's a heading above the
   * fields, and on the screens with a back button, that too). The result
   * undershoots: it looks like it's trying to scroll, but stops short and
   * leaves the field (or its hint text) still behind the keyboard.
   *
   * This version measures both the scroll container and the target field
   * with UIManager.measure (not measureLayout), which reports each one's
   * `pageY` - its actual position on screen - so both sides of the
   * comparison are in the same coordinate space as the keyboard's own
   * screen position. There's no ambiguity left to get wrong.
   */
  const positionAboveKeyboard = useCallback((node: number) => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    UIManager.measure(node, (_x, _y, _w, fieldHeight, _fPageX, fieldPageY) => {
      if (fieldHeight === undefined) return; // measure failed - node not mounted/visible

      const windowHeight = Dimensions.get("window").height;
      const keyboardTopOnScreen = windowHeight - keyboardHeight.current;
      const fieldBottomOnScreen = fieldPageY + fieldHeight;

      // How far past the keyboard's top edge the field currently sits,
      // once GAP_ABOVE_KEYBOARD's breathing room (and hint-text
      // allowance) is included. 0 or negative means it's already clear -
      // don't scroll for a field that's already comfortably visible.
      const overlap = fieldBottomOnScreen + GAP_ABOVE_KEYBOARD - keyboardTopOnScreen;
      if (overlap <= 0) return;

      const targetY = Math.max(0, scrollY.current + overlap);
      scroll.scrollTo({ y: targetY, animated: true });
    });
  }, []);

  useEffect(() => {
    // "will" events on iOS fire BEFORE the keyboard animates in, so the
    // scroll starts at the same moment the keyboard does and the two read
    // as one continuous motion. Android only emits the "did" variants.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e) => {
      keyboardHeight.current = e.endCoordinates.height;
      setKeyboardSpacer(e.endCoordinates.height);

      // Wait a frame so the spacer above has actually been committed -
      // scrolling before the content is taller than the container would
      // be clamped straight back to 0, which is the exact failure this
      // whole hook exists to avoid.
      requestAnimationFrame(() => {
        if (focusedNode.current) positionAboveKeyboard(focusedNode.current);
      });
    });

    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.current = 0;
      setKeyboardSpacer(0);
      focusedNode.current = null;
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [positionAboveKeyboard]);

  const handleFocus = useCallback(
    (e: FocusLike) => {
      // Calling `.measureLayout()` directly on the focused component's ref
      // (e.target) is the old-architecture pattern, and it's unreliable
      // under Fabric/New Architecture - the ref you get back there is a
      // public-instance wrapper that doesn't always expose measureLayout,
      // producing "ref.measureLayout must be called with a ref to a native
      // component" even though the component IS native. Going through
      // UIManager.measureLayout with plain node handles (via
      // findNodeHandle) works the same way on both architectures, because
      // it doesn't depend on what shape the ref object happens to be.
      const targetNode = findNodeHandle(e.target as any);
      if (!targetNode) return;

      focusedNode.current = targetNode;

      // Always attempt from focus, not only when a keyboard height is
      // already known: the native helper resolves the keyboard frame
      // itself, so it works even on the first tap of a session when JS
      // hasn't seen a show event yet. The show listener below still
      // fires a second pass once the spacer has been committed, which
      // is what makes the field land in the right place rather than
      // just approximately clear of the keyboard. Two cheap passes is
      // the reliable ordering here; waiting for exactly one correct
      // moment is what kept failing.
      positionAboveKeyboard(targetNode);
      setTimeout(() => {
        if (focusedNode.current === targetNode) positionAboveKeyboard(targetNode);
      }, 250);
    },
    [positionAboveKeyboard]
  );

  return { scrollRef, handleFocus, handleContainerLayout, handleScroll, keyboardSpacer };
}
