import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeInUp,
  FadeIn,
} from "react-native-reanimated";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { sendBotMessage, type ChatMessage } from "@/lib/api/mockData";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors } from "@/lib/theme";

// UPDATED - this used to be its own page-local palette (Imperial Blue /
// White Convolvulus), scoped to bot.tsx only. That reference palette is
// now lib/theme.ts's app-wide primary/surface tokens (see that file's
// header comment), so this screen reads off the shared tokens directly
// instead of keeping a second hardcoded copy of the same three hex values -
// one place to change either color from now on, not two.
const BOT_COLORS = {
  accent: colors.primary,
  accentTint: colors.primaryContainer,
  // Lighter than the app-wide colors.surface (#F5F2F3) on purpose - now
  // that the header above is pure white with a hairline border, the
  // shared surface tone read as noticeably dull/gray by comparison, and
  // this screen is mostly empty page background around a plain message
  // list, so there's more of that flat tone visible at once here than on
  // denser card-based screens. ScreenBackground's `backgroundColor` prop
  // exists specifically for this - a per-screen override, not a change
  // to the shared token.
  surface: "#FAF8F7",
};

// Same topics the header/disclaimer already promise ("serbisyo,
// requirements, oras ng opisina") — example *questions* only, never example
// *answers*, so nothing here reads as a real requirement or office hour.
// Text only, no icons - the empty state is a plain list now (see
// ChatEmptyState), not icon+label rows.
const EXAMPLE_PROMPTS = [
  "Ano ang requirements sa Barangay Clearance?",
  "Anong oras bukas ang opisina?",
  "Paano mag-file ng blotter report?",
  "Saan po ang barangay hall?",
];

// 40px, not the old 24px - big enough to actually anchor the row as "a
// participant speaking," not a decorative dot that reads as an
// afterthought next to a full paragraph of reply text. No shadow on it -
// separation comes from the tint fill alone.
function BotAvatar() {
  return (
    <View
      className="w-10 h-10 rounded-full items-center justify-center mr-3"
      style={{ backgroundColor: BOT_COLORS.accentTint }}
    >
      {/* Sparkles instead of a chat bubble - a chat-bubble icon inside a
          chat screen is redundant (the screen already says what it is);
          sparkles is the more legible "this reply is AI-generated" mark,
          the same shorthand Claude/ChatGPT's own apps use. */}
      <Ionicons name="sparkles" size={18} color={BOT_COLORS.accent} />
    </View>
  );
}

/** One dot of the three-dot "typing" indicator, bouncing on its own repeat
 *  loop with a staggered start (`delay`) so the three read as one rolling
 *  wave instead of blinking in unison. Reanimated, same library
 *  SubmittedScreen's checkmark already uses — no new dependency. */
function TypingDot({ delay }: { delay: number }) {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 320, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 320, easing: Easing.in(Easing.ease) })
        ),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <Animated.View
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: BOT_COLORS.accent }, style]}
    />
  );
}

/** Send button as its own component so it can own a tiny press-scale
 *  spring (Reanimated) - a purely tactile touch, not just an opacity
 *  fade, so sending a message has a little physical "give" to it. */
function SendButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.88, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.back(1.5)) });
        }}
        disabled={disabled}
        className="w-11 h-11 rounded-full items-center justify-center"
        style={{ backgroundColor: disabled ? "#D1D5DB" : BOT_COLORS.accent }}
      >
        <Ionicons name="arrow-up" size={18} color="white" />
      </Pressable>
    </Animated.View>
  );
}

function TypingDots() {
  return (
    <View className="flex-row items-center gap-1.5 pt-2 pb-1">
      <TypingDot delay={0} />
      <TypingDot delay={120} />
      <TypingDot delay={240} />
    </View>
  );
}

/**
 * Empty-state hero, shown only before the resident's first message.
 * Second pass, pushed further toward "as little as possible": the earlier
 * version still had a filled avatar circle, a subtitle sentence repeating
 * what the header/disclaimer already say, and four boxed/bordered cards —
 * three separate visual treatments competing for attention on one screen.
 * Cut down to two elements: one greeting line, and the starter questions as
 * a plain hairline-divided list — text only, no icon, no fill, no border
 * box. Ma (negative space) is what separates "this is the screen" from
 * "here's how to start," not a frame drawn around either one.
 */
function ChatEmptyState({ onPickPrompt }: { onPickPrompt: (text: string) => void }) {
  return (
    <View className="flex-1 justify-center px-2 pb-12">
      <Animated.View
        entering={FadeIn.duration(400)}
        style={{ alignItems: "center", marginBottom: 14 }}
      >
        <Ionicons name="sparkles" size={22} color={BOT_COLORS.accent} />
      </Animated.View>
      <Animated.Text
        entering={FadeInUp.duration(340).easing(Easing.out(Easing.cubic))}
        className="text-[22px] font-semibold text-ink tracking-tight text-center mb-10"
      >
        Kumusta! Ano ang maitutulong ko?
      </Animated.Text>

      {/* Each row gets a soft rounded blue-tinted shade instead of a card
          border or a divider line - light enough to stay minimal, but
          enough of its own fill to read as a distinct tappable chip
          rather than plain text floating on the page. */}
      <View style={{ gap: 8 }}>
        {/* Staggered by 40ms per row - one continuous cascade settling
            into place rather than the whole list appearing at once. */}
        {EXAMPLE_PROMPTS.map((p, i) => (
          <Animated.View
            key={p}
            entering={FadeInUp.duration(320)
              .delay(120 + i * 40)
              .easing(Easing.out(Easing.cubic))}
          >
            <Pressable
              onPress={() => onPickPrompt(p)}
              className="flex-row items-center rounded-2xl active:opacity-70"
              style={{ backgroundColor: "rgba(2,31,148,0.06)", paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <Text className="flex-1 text-[14.5px] font-medium text-ink" numberOfLines={2}>
                {p}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={15}
                color={colors.primary}
                style={{ marginLeft: 10 }}
              />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/**
 * FIXED — was a static header that owned its own tab-root hero treatment
 * (24px title, avatar circle, full subtitle sentence) even though this
 * screen isn't a tab root at all; it's pushed on top of one, the same way
 * every screen in the report flow is pushed on top of Reports. Rebuilt on
 * that flow's own BahagiHeader convention instead of inventing a second
 * "in-flow" header shape: icon-only back chevron, thin vertical rule,
 * title (now 22px semibold, matching Reports' bigger scale rather than
 * the flow's own 17px bold). Bottom-only shadow, same values
 * BahagiHeader uses, back on the header for separation from the
 * transcript below - the composer further down still separates itself
 * with a flat border instead, no shadow there. Same design concept this
 * app already has for "I'm a step inside something," reused here instead
 * of redrawn.
 *
 * Bubbles: only the resident's own messages get one now. The bot's replies
 * are plain text next to a small avatar, no border or fill — the
 * Claude-app convention of "your words are contained, mine are just said,"
 * which also reads as calmer over a long answer than a gray box would.
 * Trust framing (AI tag, "can be wrong") moved out of the header into a
 * caption under the input bar, same placement Claude's own app uses for
 * "Claude can make mistakes" — read once, at the point of sending, not
 * repeated as header furniture every time the screen opens.
 *
 * Typing: two dynamic pieces, not one. While waiting on the network, three
 * dots bounce in a rolling wave (TypingDots) instead of a static spinner —
 * "something is happening" read at a glance. Once a reply lands, it isn't
 * dropped in all at once; `streamInMessage` reveals it a few characters at
 * a time with a blinking caret, the same token-by-token feel Claude's own
 * responses have, before the full message joins the permanent list. The
 * input itself is `multiline` and grows with what's typed (capped at
 * ~5 lines) instead of a fixed single-line pill.
 */
export default function BotScreen() {
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/(resident)/home");
    }
  }

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", from: "bot", text: "Kumusta! Ask me about barangay services, requirements, or office hours." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // REDESIGNED — every earlier version of this (three of them: a fixed
  // insets formula, then a measure-on-show correction, then a measure-and-
  // guard version) was hand-rolled on top of RN's plain `Keyboard` module,
  // which only reports "shown"/"hidden" after the fact, off the JS bridge,
  // with no reliable signal for exactly where the keyboard is *during* its
  // open/close animation. Every fix was patching a different symptom of
  // that same root gap: overshoot when measured too early, drift when
  // measured against a still-animating previous state, bounce when a
  // measurement retriggered itself. There was no version of "measure once,
  // after a guessed delay" that could be exactly right on every device.
  //
  // `react-native-keyboard-controller` closes that gap instead of working
  // around it: `useKeyboardHandler`'s `onMove` fires on the UI thread, in
  // sync with the keyboard's own native animation, once per frame, with
  // its real current height at that exact instant - not a JS-bridge event
  // fired after the fact. `keyboardHeight` below is driven directly by
  // that, so the spacer's height *is* the keyboard's height, continuously,
  // for the entire open/close motion - not a single guessed correction
  // applied after the show event. This is what Expo's own current keyboard
  // handling guide recommends for exactly this shape of screen (a message
  // list with a fixed input below it): a trailing animated spacer whose
  // height tracks the keyboard frame-by-frame.
  //
  // Needs `<KeyboardProvider>` at the app root (app/_layout.tsx) and, since
  // this is a native module, a rebuild to actually run - won't work in a
  // stock Expo Go session, same as expo-media-library/react-native-view-
  // shot from SubmittedScreen's gallery-save feature already required.
  const keyboardHeight = useSharedValue(0);

  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 16);
  }, []);

  useKeyboardHandler(
    {
      onMove: (event) => {
        "worklet";
        keyboardHeight.value = Math.max(event.height, 0);
      },
      onEnd: (event) => {
        "worklet";
        if (event.height > 0) runOnJS(scrollToEndSoon)();
      },
    },
    [scrollToEndSoon]
  );

  const keyboardSpacerStyle = useAnimatedStyle(() => ({ height: keyboardHeight.value }));

  const busy = sending || streamingId !== null;
  // Only the seeded welcome bubble exists and nothing's in flight - show
  // the hero instead of a one-line transcript.
  const isEmpty = messages.length === 1 && !busy;

  function handleNewChat() {
    setMessages([
      { id: "welcome", from: "bot", text: "Kumusta! Ask me about barangay services, requirements, or office hours." },
    ]);
    setInput("");
    setSending(false);
    setStreamingId(null);
    setStreamingText("");
  }

  // Reveals `message.text` a few characters at a time via recursive
  // setTimeout (easier to pace variably than setInterval), auto-scrolling
  // each tick, then commits the full message to `messages` once done.
  // `mountedRef` guards against setState after the screen unmounts mid-reveal.
  function streamInMessage(message: ChatMessage) {
    setStreamingId(message.id);
    setStreamingText("");
    const full = message.text;
    const chunk = Math.max(1, Math.round(full.length / 40));
    let shown = 0;

    const tick = () => {
      if (!mountedRef.current) return;
      shown = Math.min(full.length, shown + chunk);
      setStreamingText(full.slice(0, shown));
      scrollRef.current?.scrollToEnd({ animated: true });
      if (shown < full.length) {
        setTimeout(tick, 18);
      } else {
        setMessages((prev) => [...prev, message]);
        setStreamingId(null);
        setStreamingText("");
      }
    };
    tick();
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || busy) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, from: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const reply = await sendBotMessage(text);
      if (!mountedRef.current) return;
      setSending(false);
      streamInMessage(reply);
    } catch {
      if (mountedRef.current) setSending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: colors.surfaceContainerLow }}>
      <ScreenBackground backgroundColor={BOT_COLORS.surface}>
        {/* Back button now has a real circular tap target (44px, MD3's own
            touch-target minimum) instead of a bare icon floating in
            space - easier to hit accurately, and the filled circle makes
            it visibly a button before it's even pressed. The AI mark
            moved to sit right next to the title, as a small identity tag
            (it's not interactive, so it doesn't belong in the toolbar
            with real actions). "Bagong Chat" is the toolbar's only
            control now, and it's a real labeled button - icon plus text,
            not an icon alone - at the same 44px minimum height, so it's
            both easier to hit and unambiguous about what it does without
            requiring a resident to already know what a pencil icon means.
            White fill + a flat bottom border, not the same surface color
            as the body - the header used to be visually indistinguishable
            from the message list behind it (both colors.surface, with only
            a near-invisible 0.04-opacity shadow separating them). Now it
            reads as its own distinct surface sitting above the chat, the
            same white-panel-on-surface-background language cards use
            throughout the rest of the app. */}
        <View
          className="flex-row items-center justify-between px-5 py-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
          }}
        >
          {/* Identity zone - allowed to shrink (title truncates) so the
              toolbar on the right never gets pushed off-screen. */}
          <View className="flex-row items-center flex-1 mr-3" style={{ minWidth: 0 }}>
            {/* No fill behind it - back to a bare glyph, no tinted disc. */}
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Bumalik"
              hitSlop={16}
              className="active:opacity-50"
            >
              <Ionicons name="chevron-back" size={24} color={colors.onSurfaceVariant} />
            </Pressable>

            <View className="w-px h-7 mx-4" style={{ backgroundColor: colors.outlineVariant }} />

            <View className="flex-row items-center flex-1" style={{ minWidth: 0 }}>
              <Text
                numberOfLines={1}
                className="text-[22px] font-semibold text-ink tracking-tight mr-2"
                style={{ flexShrink: 1 }}
              >
                Barangay-Bot
              </Text>
              {/* No badge/disc behind it - back to a bare sparkle glyph. */}
              <Ionicons name="sparkles" size={14} color={colors.primary} />
            </View>
          </View>

          {/* New chat - upgraded from a near-invisible hairline (the old
              border color was the light tint itself, ~1:1 with white and
              basically undetectable) to a real tonal button: filled with
              the light brand tint, primary-colored icon and label, so it
              actually reads as an accented action instead of a ghost
              outline that happened to also have text in it. */}
          <Pressable
            onPress={handleNewChat}
            disabled={busy || isEmpty}
            accessibilityRole="button"
            accessibilityLabel="Bagong chat"
            hitSlop={4}
            className="flex-row items-center active:opacity-70"
            style={{
              height: 36,
              paddingHorizontal: 14,
              borderRadius: 18,
              backgroundColor: colors.primaryContainer,
              opacity: isEmpty ? 0 : busy ? 0.4 : 1,
              gap: 6,
            }}
          >
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text className="text-[13px] font-semibold" style={{ color: colors.primary }}>
              Bagong Chat
            </Text>
          </Pressable>
        </View>

        <View className="flex-1">
          <ScrollView
            ref={scrollRef}
            className="flex-1 px-5"
            contentContainerStyle={isEmpty ? { flexGrow: 1 } : undefined}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {isEmpty ? (
              <ChatEmptyState onPickPrompt={(text) => handleSend(text)} />
            ) : (
              <View className="gap-5 pt-5 pb-6">
                {messages.map((m) =>
                  m.from === "user" ? (
                    <Animated.View
                      key={m.id}
                      entering={FadeInUp.duration(260).easing(Easing.out(Easing.cubic))}
                      className="flex-row justify-end"
                    >
                      {/* Bottom-right corner pulled in - one soft "tail"
                          corner instead of a fully symmetric pill, so the
                          bubble reads as flowing out of the composer below
                          it rather than a discrete shape dropped on screen. */}
                      <View
                        className="max-w-[85%] px-4 py-3"
                        style={{
                          backgroundColor: BOT_COLORS.accent,
                          borderRadius: 22,
                          borderBottomRightRadius: 6,
                        }}
                      >
                        <Text className="text-[14px] leading-5 text-white">{m.text}</Text>
                      </View>
                    </Animated.View>
                  ) : (
                    <Animated.View
                      key={m.id}
                      entering={FadeInUp.duration(280).easing(Easing.out(Easing.cubic))}
                      className="flex-row items-start"
                    >
                      <BotAvatar />
                      {/* pt-2.5, not pt-0.5 - re-centered against the 40px
                          avatar (was tuned for the old 24px one). */}
                      <Text className="flex-1 text-[15px] leading-6 text-ink pt-2.5">{m.text}</Text>
                    </Animated.View>
                  )
                )}

                {sending && (
                  <Animated.View entering={FadeIn.duration(200)} className="flex-row items-start">
                    <BotAvatar />
                    <View className="pt-3">
                      <TypingDots />
                    </View>
                  </Animated.View>
                )}

                {streamingId && (
                  <Animated.View entering={FadeIn.duration(150)} className="flex-row items-start">
                    <BotAvatar />
                    <Text className="flex-1 text-[15px] leading-6 text-ink pt-2.5">
                      {streamingText}
                      <Text className="text-ink-faint">▍</Text>
                    </Text>
                  </Animated.View>
                )}
              </View>
            )}
          </ScrollView>

          <View>
            {/* Composer as a floating island, not a flush edge-to-edge bar:
                margin on all sides so it doesn't touch the screen edges.
                No shadow anywhere on this screen - separation from the
                page comes from the white fill and a flat 1.5px accent-tint
                border alone, not simulated elevation. */}
            <View
              className="flex-row items-end gap-2 bg-white mx-4 mb-1 px-3 py-2"
              style={{
                borderRadius: 26,
                borderWidth: 1.5,
                borderColor: BOT_COLORS.accentTint,
              }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
                placeholder="Type a message…"
                placeholderTextColor={colors.outline}
                multiline
                style={{ maxHeight: 120 }}
                className="flex-1 px-2 py-2 text-[14px] leading-5 text-ink"
              />
              <SendButton onPress={() => handleSend()} disabled={busy || !input.trim()} />
            </View>

            {/* Same placement/role Claude's own app gives this line — a
                standing footnote under the composer, read once at the point
                of sending, not header furniture repeated every visit. */}
            <Text className="text-[11px] text-ink-faint text-center px-10 pb-2 pt-1">
              Maaaring magkamali ang Barangay-Bot. Para sa opisyal na detalye, bisitahin o tawagan ang barangay hall.
            </Text>
          </View>

          {/* The actual dock: an empty view whose height tracks the
              keyboard frame-by-frame (see useKeyboardHandler above). Placed
              after the composer, not as padding on it - height on a
              trailing sibling reserves real layout space the same way
              padding did, but reads simpler paired with a value that's
              already "the keyboard's height" rather than a derived gap. */}
          <Animated.View style={keyboardSpacerStyle} />
        </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}
