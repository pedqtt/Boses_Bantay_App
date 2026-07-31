import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { REPORT_QUESTIONS, CHAPTERS, INTRO_COPY } from "@/lib/reportQuestions";

/**
 * Landing screen for the guided flow. Previews all 7 questions grouped into
 * 3 chapters — nobody should be surprised mid-flow by what's being asked,
 * but the framing sets expectations at the size the task actually feels
 * like ("3 bahagi"), not the size a flat 7-item list would suggest.
 */
export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Same flexGrow + justify-between fix as the step screen: the intro
          copy + chapters card is one group, the Simulan button + its
          footnote is the other, and they get pushed apart to fill the
          screen on a normal-height phone instead of both sitting flush
          under the status bar with dead space before the bottom edge. */}
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between", paddingTop: 28, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className={`${REPORT_TYPE.heroTitle} mb-3`}>{INTRO_COPY.title}</Text>
          {/* Tagalog instruction + its English translation are paired
              tightly (same sentence, two languages) — with real space
              below the whole pair before the chapters card, a separate
              block. */}
          <Text className={REPORT_TYPE.subtitle}>{INTRO_COPY.body}</Text>
          <Text className={`${REPORT_TYPE.hint} italic mt-1.5 mb-9`}>{INTRO_COPY.bodyEn}</Text>

          <View className="border border-gray-200 rounded-2xl p-5">
            <Text className={`${REPORT_TYPE.eyebrowMuted} mb-4`}>3 bahagi</Text>
            {CHAPTERS.map((chapter, ci) => (
              <View key={chapter.key} className={ci > 0 ? "mt-6" : undefined}>
                <View className="flex-row items-center mb-2.5">
                  <Ionicons name={chapter.icon as any} size={16} color="#1D4ED8" style={{ marginRight: 6 }} />
                  <Text className={REPORT_TYPE.eyebrowBrand}>
                    {ci + 1}. {chapter.label}
                  </Text>
                </View>
                {REPORT_QUESTIONS.filter((q) => q.chapter === chapter.key).map((q) => (
                  <View key={q.key} className="flex-row items-center mb-2.5 ml-1">
                    <Ionicons name={q.icon as any} size={16} color="#6B7280" />
                    <Text className={`${REPORT_TYPE.body} ml-2 flex-1`}>
                      {q.label}
                      {!q.required && <Text className={REPORT_TYPE.caption}> (opsyonal)</Text>}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View className="mt-10">
          <Pressable onPress={onStart} className="bg-brand rounded-2xl py-4 items-center active:opacity-85 mb-3">
            <Text className={REPORT_TYPE.buttonPrimary}>Simulan</Text>
          </Pressable>
          <Text className={`${REPORT_TYPE.hint} text-center`}>
            Maaari po kayong mag-record o mag-type sa bawat tanong.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
