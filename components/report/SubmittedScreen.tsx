import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { CLOSING_COPY } from "@/lib/reportQuestions";

type SubmittedScreenProps = {
  referenceNo: string;
  onViewReports: () => void;
  onFileAnother: () => void;
};

/** Confirmation screen — sets the expectation that this is a pre-blotter,
 *  still pending barangay review, not a filed case. */
export function SubmittedScreen({ referenceNo, onViewReports, onFileAnother }: SubmittedScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-green-700 items-center justify-center mb-5">
          <Ionicons name="checkmark" size={28} color="white" />
        </View>
        <Text className={`${REPORT_TYPE.heroTitle} text-center mb-3`}>
          {CLOSING_COPY.thanks} Naipasa na ang report.
        </Text>
        <Text className={`${REPORT_TYPE.subtitle} text-center mb-1.5`}>Ang inyong reference number ay</Text>
        <Text className="text-[26px] font-bold text-brand tracking-tight mb-5">{referenceNo}</Text>
        {/* A separate thought from the reference number above it (an
            explanation, not a continuation) — real gap above it rather than
            the tight rhythm used for the title/subtitle pair. */}
        <Text className={`${REPORT_TYPE.hint} text-center max-w-[290px] mb-8`}>{CLOSING_COPY.body}</Text>

        <Pressable
          onPress={onViewReports}
          className="bg-brand rounded-2xl py-4 px-8 items-center active:opacity-85 mb-3 w-full"
        >
          <Text className={REPORT_TYPE.buttonPrimary}>Tingnan ang aking reports</Text>
        </Pressable>
        <Pressable onPress={onFileAnother} className="py-3 px-8 items-center active:opacity-70">
          <Text className={REPORT_TYPE.buttonSecondary}>Mag-report muli</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
