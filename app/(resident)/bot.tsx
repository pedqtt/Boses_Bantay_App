import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Keyboard,
  Platform,
  type KeyboardEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { sendBotMessage, type ChatMessage } from "@/lib/api/mockData";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors } from "@/lib/theme";

// Same three topics the header/disclaimer already promise ("serbisyo,
// requirements, oras ng opisina") — example *questions* only, never example
// *answers*, so nothing here reads as a real requirement or office hour.
const EXAMPLE_PROMPTS = [
  "Ano ang requirements sa Barangay Clearance?",
  "Anong oras bukas ang opisina?",
  "Paano mag-file ng blotter report?",
];

function BotAvatar() {
  return (
    <View className="w-6 h-6 rounded-full bg-brand-50 items-center justify-center mr-2 mt-0.5">
      <Ionicons name="chatbubble-ellipses" size={11} color={colors.primary} />
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
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.outline }, style]}
    />
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
 * FIXED — was a static header that owned its own tab-root hero treatment
 * (24px title, avatar circle, full subtitle sentence) even though this
 * screen isn't a tab root at all; it's pushed on top of one, the same way
 * every screen in the report flow is pushed on top of Reports. Rebuilt on
 * that flow's own BahagiHeader convention instead of inventing a second
 * "in-flow" header shape: icon-only back chevron, thin vertical rule, 17px
 * bold title, subtle bottom-only shadow on `colors.surface`. Same design
 * concept this app already has for "I'm a step inside something," reused
 * here instead of redrawn.
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

  // FIXED — the first pass leaned on KeyboardAvoidingView, betting on
  // Android's own windowSoftInputMode="adjustResize" to shrink the window
  // and push the composer up automatically. That bet was wrong for how this
  // screen actually gets tested: Expo Go runs its own shell manifest, not
  // this project's, so the native resize this relied on was never actually
  // happening — the keyboard opened over a window that never resized, and
  // the composer just sat wherever it already was underneath it.
  //
  // Rebuilt to not depend on any native manifest setting at all: this reads
  // the keyboard's own height directly off Keyboard's show/hide events and
  // animates the composer up by exactly that amount (minus the bottom safe
  // area, which SafeAreaView is still reserving whether or not the keyboard
  // is open — without subtracting it the composer would overshoot the
  // keyboard by that same margin). Same mechanism on iOS and Android, same
  // result in Expo Go and in a native build, since nothing here reads from
  // the manifest.
  const insets = useSafeAreaInsets();
  const keyboardPad = useSharedValue(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates?.height ?? 0;
      keyboardPad.value = withTiming(Math.max(0, height - insets.bottom), { duration: 220 });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    };
    const onHide = () => {
      keyboardPad.value = withTiming(0, { duration: 200 });
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const composerLift = useAnimatedStyle(() => ({ paddingBottom: keyboardPad.value }));

  const busy = sending || streamingId !== null;

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
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: colors.surface }}>
      <ScreenBackground>
        <View
          className="flex-row items-center px-6 pt-5 pb-4"
          style={{
            backgroundColor: colors.surface,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Bumalik"
            hitSlop={12}
            className="active:opacity-60"
          >
            <Ionicons name="chevron-back" size={24} color={colors.onSurfaceVariant} />
          </Pressable>

          <View className="w-px h-7 bg-gray-300 mx-4" />

          <Text numberOfLines={1} className="flex-1 mr-3 text-[17px] font-bold text-ink tracking-tight">
            Barangay-Bot
          </Text>

          <View className="bg-gray-100 rounded-full px-2.5 py-1">
            <Text className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">AI</Text>
          </View>
        </View>

        <Animated.View className="flex-1" style={composerLift}>
          <ScrollView
            ref={scrollRef}
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <View className="gap-5 pt-5 pb-6">
              {messages.map((m) =>
                m.from === "user" ? (
                  <View key={m.id} className="flex-row justify-end">
                    <View className="max-w-[85%] px-4 py-3 rounded-3xl bg-brand">
                      <Text className="text-[14px] leading-5 text-white">{m.text}</Text>
                    </View>
                  </View>
                ) : (
                  <View key={m.id} className="flex-row items-start">
                    <BotAvatar />
                    <Text className="flex-1 text-[15px] leading-6 text-ink pt-0.5">{m.text}</Text>
                  </View>
                )
              )}

              {sending && (
                <View className="flex-row items-start">
                  <BotAvatar />
                  <TypingDots />
                </View>
              )}

              {streamingId && (
                <View className="flex-row items-start">
                  <BotAvatar />
                  <Text className="flex-1 text-[15px] leading-6 text-ink pt-0.5">
                    {streamingText}
                    <Text className="text-ink-faint">▍</Text>
                  </Text>
                </View>
              )}

              {/* Only before the resident's first message. Indented to sit
                  under the bot text column (24px avatar + 8px gap = pl-8),
                  labeled the same small-caps way SectionLabel treats every
                  other grouped section in the app. */}
              {messages.length === 1 && !busy && (
                <View className="pl-8">
                  <Text className="text-[12px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    Halimbawa ng maitatanong
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {EXAMPLE_PROMPTS.map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => handleSend(p)}
                        className="border border-gray-200 bg-white rounded-full px-3.5 py-2 active:opacity-70"
                      >
                        <Text className="text-[13px] font-medium text-ink-soft">{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          <View className="flex-row items-end gap-2 px-5 pt-3 pb-1 border-t border-gray-100">
            <TextInput
              value={input}
              onChangeText={setInput}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
              placeholder="Type a message…"
              placeholderTextColor={colors.outline}
              multiline
              style={{ maxHeight: 120 }}
              className="flex-1 bg-white border border-gray-200 rounded-3xl px-4 py-3 text-[14px] leading-5 text-ink"
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={busy || !input.trim()}
              className={`w-11 h-11 rounded-full items-center justify-center active:opacity-85 ${
                busy || !input.trim() ? "bg-gray-300" : "bg-brand"
              }`}
            >
              <Ionicons name="arrow-up" size={18} color="white" />
            </Pressable>
          </View>

          {/* Same placement/role Claude's own app gives this line — a
              standing footnote under the composer, read once at the point
              of sending, not header furniture repeated every visit. */}
          <Text className="text-[11px] text-ink-faint text-center px-10 pb-2 pt-1">
            Maaaring magkamali ang Barangay-Bot. Para sa opisyal na detalye, bisitahin o tawagan ang barangay hall.
          </Text>
        </Animated.View>
      </ScreenBackground>
    </SafeAreaView>
  );
}
