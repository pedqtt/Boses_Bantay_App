import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQItem = {
  question: string;
  answer: string;
};

const FAQS: FAQItem[] = [
  {
    question: "How do I submit an incident report?",
    answer:
      "Tap the mic/report button at the center of the bottom navigation bar. You can record a voice note or type in the details manually.",
  },
  {
    question: "How long does report verification take?",
    answer:
      "Barangay officials review incoming reports within 15 to 30 minutes during operating hours.",
  },
  {
    question: "How do I submit my Barangay ID for verification?",
    answer:
      "Go to Profile > Barangay ID and upload a photo of your official ID or proof of residency.",
  },
  {
    question: "What should I do in a life-threatening emergency?",
    answer:
      "For urgent emergencies, call 911 immediately or reach out via the emergency hotline in the Directory tab.",
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  function toggleFAQ(index: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex((prev) => (prev === index ? null : index));
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(resident)/profile");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-2 pb-4 flex-row items-center border-b border-gray-100">
        <Pressable
          onPress={handleBack}
          className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:opacity-70 mr-3"
        >
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
        </Pressable>
        <Text className="text-[20px] font-semibold text-gray-900 tracking-tight">
          Help & Support
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Contact Support Section */}
        <Text className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          Contact Support
        </Text>

        <View className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden mb-6">
          <Pressable
            onPress={() => Linking.openURL("tel:+639456844770")}
            className="p-4 flex-row items-center justify-between border-b border-gray-100 active:bg-gray-100"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center">
                <Ionicons name="call-outline" size={18} color="#1D4ED8" />
              </View>
              <View>
                <Text className="text-[14px] font-semibold text-gray-900">
                  Call Barangay Hall
                </Text>
                <Text className="text-[12px] text-gray-500">
                  Open 24/7 • Hotline Support
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL("mailto:support@barangay.gov.ph")}
            className="p-4 flex-row items-center justify-between active:bg-gray-100"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center">
                <Ionicons name="mail-outline" size={18} color="#1D4ED8" />
              </View>
              <View>
                <Text className="text-[14px] font-semibold text-gray-900">
                  Email Support
                </Text>
                <Text className="text-[12px] text-gray-500">
                  Get assistance via email
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* FAQs Section */}
        <Text className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          Frequently Asked Questions
        </Text>

        <View className="gap-2.5">
          {FAQS.map((faq, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <Pressable
                key={index}
                onPress={() => toggleFAQ(index)}
                className="bg-gray-50 p-4 rounded-2xl border border-gray-100 active:opacity-90"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-[14px] font-semibold text-gray-900 flex-1 pr-2">
                    {faq.question}
                  </Text>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#6B7280"
                  />
                </View>

                {isExpanded && (
                  <Text className="text-[13px] text-gray-600 leading-5 mt-2.5 pt-2.5 border-t border-gray-200/60">
                    {faq.answer}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}