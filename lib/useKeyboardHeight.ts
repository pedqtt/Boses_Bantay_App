import { useSharedValue } from "react-native-reanimated";
import { useKeyboardHandler } from "react-native-keyboard-controller";

/**
 * The keyboard's real height, tracked frame-by-frame off the native
 * animation itself (`useKeyboardHandler`'s `onMove`) rather than a JS-bridge
 * "shown"/"hidden" event read after the fact.
 *
 * Currently only used by register.tsx, to size a trailing spacer at the
 * end of its ScrollView. Every other app/(auth)/*.tsx screen (login, otp,
 * reset-password, forgot-password, upload-id) was moved off ScrollView
 * entirely to a fully static View - even the passive, non-auto-focus
 * scrolling this hook enabled still read as the layout being unstable on
 * those screens. register.tsx (five fields) is the one auth screen still
 * long enough to need to scroll at all; login.tsx's comment (git history)
 * has the fuller writeup of why KeyboardAwareScrollView's auto-scroll was
 * replaced with this plain-scroll approach in the first place. bot.tsx
 * uses the same pattern for its composer but keeps its own private copy of
 * this logic rather than importing this hook.
 *
 * Requires `<KeyboardProvider>` at the app root (already added in
 * app/_layout.tsx) and a native rebuild to run - it's a native module, so
 * it won't work in a stock Expo Go session.
 */
export function useKeyboardHeight() {
  const height = useSharedValue(0);

  useKeyboardHandler(
    {
      onMove: (event) => {
        "worklet";
        height.value = Math.max(event.height, 0);
      },
    },
    []
  );

  return height;
}
