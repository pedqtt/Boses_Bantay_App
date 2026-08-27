import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import { CHUNKS, REVIEW_SECTIONS, INTRO_COPY } from "@/lib/reportQuestions";

const CONFIRM_YOU_SECTION = REVIEW_SECTIONS.find((s) => s.key === "nagrereklamo")!;

/**
 * Landing screen for the guided flow. Previews the three chunks so nobody is
 * surprised mid-flow by what's being asked.
 *
 * "Tatlong tanong lang po" is doing real work here. The same content behind
 * a sixteen-question list reads as several times the commitment, because
 * perceived effort tracks visible step count rather than actual effort
 * (Hick's Law). Three is a number a resident can hold in their head before
 * they start.
 *
 * Header/chrome (SafeAreaView, ScreenBackground, BahagiHeader) is no longer
 * rendered here - report.tsx mounts one persistent copy of that trio for
 * the whole flow and this screen renders only its body content into it.
 * See report.tsx's "Chrome" comment for why: a screen-owned header used to
 * fully unmount/remount on every stage change, which read as a twitchy
 * flash at each transition.
 */
export function IntroScreen({
  onStart,
  hasSavedDraft,
  onResumeDraft,
  onDiscardDraft,
}: {
  onStart: () => void;
  hasSavedDraft?: boolean;
  onResumeDraft?: () => void;
  onDiscardDraft?: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 px-8"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "space-between",
        paddingTop: 16,
        paddingBottom: 28,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text className="text-[28px] font-semibold text-ink tracking-tight mb-3">
          {INTRO_COPY.title}
        </Text>
        <Text className="text-[15px] text-ink-soft leading-7 mb-7">{INTRO_COPY.body}</Text>

        {/* An unfinished report from a previous session. Recovering it
            has to be offered explicitly rather than silently resumed:
            a resident returning to this screen may well intend to
            start a different report, and silently restoring someone
            else's half-finished narrative into it would be worse than
            losing it. */}
        {hasSavedDraft && (
          <View className="border border-brand-100 bg-brand-50 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center mb-1.5">
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text className={`${REPORT_TYPE.fieldLabel} ml-1.5`}>
                May hindi natapos na report
              </Text>
            </View>
            <Text className={`${REPORT_TYPE.caption} mb-3`}>
              Gusto po ba ninyong ipagpatuloy kung saan kayo huminto?
            </Text>
            <View className="flex-row" style={{ gap: 10 }}>
              <Pressable
                onPress={onResumeDraft}
                className="flex-1 bg-brand rounded-xl py-3 items-center active:opacity-85"
              >
                <Text className="text-white font-semibold text-[15px]">Ipagpatuloy</Text>
              </Pressable>
              <Pressable
                onPress={onDiscardDraft}
                className="flex-1 border border-gray-200 rounded-xl py-3 items-center active:opacity-70"
              >
                <Text className={REPORT_TYPE.buttonSecondary}>Magsimula ulit</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="bg-white border border-gray-200 rounded-2xl p-5">
          <Text className={`${REPORT_TYPE.eyebrowMuted} mb-4`}>4 na hakbang</Text>

          {/* Step 1 - confirm identity. Not a spoken question like the
              three below it, so it gets its own row styled the same
              way but with a "tap lang" note instead - setting the
              expectation that this step is a quick confirm-and-edit,
              not another recording. */}
          <View>
            <View className="flex-row items-start">
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.primary}
                style={{ marginRight: 10, marginTop: 2 }}
              />
              <View className="flex-1">
                <Text className={REPORT_TYPE.body}>1. {CONFIRM_YOU_SECTION.label}</Text>
                <Text className={`${REPORT_TYPE.caption} mt-0.5`}>
                  Kumpirmahin lang po - hindi na kailangang mag-record.
                </Text>
              </View>
            </View>
          </View>

          {CHUNKS.map((chunk, i) => (
            <View key={chunk.key} className="mt-5">
              <View className="flex-row items-start">
                <Ionicons
                  name={chunk.icon as any}
                  size={18}
                  color={colors.primary}
                  style={{ marginRight: 10, marginTop: 2 }}
                />
                <View className="flex-1">
                  <Text className={REPORT_TYPE.body}>
                    {i + 2}. {chunk.question}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-8">
        <Pressable
          onPress={onStart}
          className="bg-brand rounded-2xl py-4 items-center overflow-hidden active:opacity-85 mb-3"
        >
          <Text className={REPORT_TYPE.buttonPrimary}>Simulan</Text>
        </Pressable>
        <Text className={`${REPORT_TYPE.hint} text-center`}>
          Maaari po kayong mag-record o mag-type. Hindi pa po ito opisyal hangga't
          hindi napipirmahan sa barangay hall.
        </Text>
      </View>
    </ScrollView>
  );
}
