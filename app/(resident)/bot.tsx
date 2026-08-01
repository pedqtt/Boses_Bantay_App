import { useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { sendBotMessage, type ChatMessage } from "@/lib/api/mockData";
import { BackButton } from "@/components/BackButton";

export default function BotScreen() {
  // Same tab-bar-hiding recipe used on the report flow: a chat screen with
  // a keyboard and a send button right above the same screen edge the tab
  // bar occupies is exactly the kind of layout where an accidental tap on
  // "Home" or "Reports" costs you the message you were mid-typing. Hiding
  // it removes that misclick target for the whole time this screen is
  // focused, not just visually decluttering it.
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  // The bot is reached both by pushing (Home's quick-access card, the
  // floating FAB) and — because it's a tab-navigator screen with
  // href: null, not a plain stack screen — there isn't always a
  // guaranteed "previous screen" in history to pop back to.
  // canGoBack() covers the normal pushed case; Home is the safe fallback
  // for any path that got here without adding to the stack.
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
  const scrollRef = useRef<ScrollView>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, from: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const reply = await sendBotMessage(text);
      setMessages((prev) => [...prev, reply]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-3 pb-4">
        <View className="mr-2">
          <BackButton onPress={goBack} />
        </View>
        {/* A first-time visitor lands here with no other context than the
            title — a one-line description sets expectations up front (what
            this is for, that a real person isn't reading it) instead of
            making them guess from the welcome bubble below. */}
        <View className="flex-1">
          <Text className="text-[24px] font-semibold text-ink tracking-tight">Barangay-Bot</Text>
          <Text className="text-[13px] text-ink-soft mt-0.5">
            Magtanong tungkol sa mga serbisyo, requirements, o oras ng opisina
          </Text>
        </View>
      </View>

      {/* behavior was "undefined" on Android, which is a no-op — the input
          bar never actually moved above the keyboard there. "height" is
          the Android-correct behavior (resizes the container instead of
          padding it, which is what "padding" does on iOS). */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Extra bottom margin — breathing room between the last message
              and the input bar/keyboard, instead of the list ending flush
              against it. */}
          <View className="gap-3 pb-6">
            {messages.map((m) => (
              <View
                key={m.id}
                className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                  m.from === "user" ? "bg-brand self-end" : "bg-gray-100 self-start"
                }`}
              >
                <Text className={`text-[14px] leading-5 ${m.from === "user" ? "text-white" : "text-ink"}`}>
                  {m.text}
                </Text>
              </View>
            ))}
            {sending && <ActivityIndicator className="self-start" color="#1D4ED8" />}
          </View>
        </ScrollView>

        <View className="flex-row items-center gap-2 px-5 py-3 border-t border-gray-100">
          <TextInput
            value={input}
            onChangeText={setInput}
            // Scroll-into-view for a chat input: on focus, once the
            // keyboard finishes animating in, make sure the latest
            // message + the input itself are still the visible, active
            // area rather than sitting behind the keyboard.
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
            placeholder="Type a message…"
            placeholderTextColor="#9CA3AF"
            className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-[14px] text-ink"
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !input.trim()}
            className="w-11 h-11 rounded-full bg-brand items-center justify-center active:opacity-85"
          >
            <Ionicons name="arrow-up" size={18} color="white" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
