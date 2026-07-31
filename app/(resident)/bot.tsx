import { useState, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { sendBotMessage, type ChatMessage } from "@/lib/api/mockData";

export default function BotScreen() {
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
      <View className="px-5 pt-3 pb-4">
        <Text className="text-[24px] font-semibold text-ink tracking-tight">Barangay-Bot</Text>
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
