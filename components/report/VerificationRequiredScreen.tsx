import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";

type BarangayIdStatus = "unverified" | "secretary_verified" | "pb_authorized";

type VerificationRequiredScreenProps = {
  status: BarangayIdStatus;
  onGoVerify: () => void;
  onGoBack: () => void;
};

const COPY: Record<BarangayIdStatus, { title: string; body: string; ctaLabel: string }> = {
  unverified: {
    title: "Kailangan munang i-verify ang Barangay ID",
    body:
      "Para maiwasan ang spam na reports, dapat munang ma-verify ng barangay ang inyong Barangay ID bago makapag-file ng blotter report o reklamo. I-submit po ang inyong ID number at larawan.",
    ctaLabel: "I-verify ang Barangay ID",
  },
  secretary_verified: {
    title: "Naghihintay pa ng huling approval",
    body:
      "Na-verify na ng Secretary ang inyong ID — naghihintay na lang ng huling approval mula sa Punong Barangay bago po kayo makapag-file ng report.",
    ctaLabel: "Tingnan ang status",
  },
  pb_authorized: {
    // Unreachable in practice — ReportScreen only renders this component
    // when status isn't pb_authorized — but kept so COPY stays a total
    // function over BarangayIdStatus instead of silently falling through.
    title: "Naka-verify na ang inyong account",
    body: "Maaari na po kayong mag-file ng report.",
    ctaLabel: "Magpatuloy",
  },
};

/**
 * Gate shown in place of the report flow for any account that hasn't
 * cleared full Barangay ID authorization yet. Filing a blotter report
 * requires a real, checkable identity behind it (per the barangay's own
 * process — staff cross-reference the ID before anything is treated as
 * official); letting an unverified account reach the recorder first and
 * only rejecting on submit would waste a resident's time narrating an
 * answer that was never going to go through, so the gate sits at the
 * front door instead.
 */
export function VerificationRequiredScreen({ status, onGoVerify, onGoBack }: VerificationRequiredScreenProps) {
  const copy = COPY[status];

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-orange-100 items-center justify-center mb-5">
          <Ionicons name="shield-checkmark-outline" size={28} color="#C2410C" />
        </View>
        <Text className={`${REPORT_TYPE.heroTitle} text-center mb-3`}>{copy.title}</Text>
        <Text className={`${REPORT_TYPE.hint} text-center max-w-[290px] mb-8`}>{copy.body}</Text>

        <Pressable
          onPress={onGoVerify}
          className="bg-brand rounded-2xl py-4 px-8 items-center active:opacity-85 mb-3 w-full"
        >
          <Text className={REPORT_TYPE.buttonPrimary}>{copy.ctaLabel}</Text>
        </Pressable>
        <Pressable onPress={onGoBack} className="py-3 px-8 items-center active:opacity-70">
          <Text className={REPORT_TYPE.buttonSecondary}>Bumalik sa Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
