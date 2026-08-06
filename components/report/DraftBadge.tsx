import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DRAFT_BADGE_COPY } from "@/lib/reportQuestions";

/**
 * "Draft · Hindi pa Opisyal" — the interview was explicit that a blotter
 * isn't official until printed and signed in person at the barangay hall;
 * the app can only ever produce a draft. Shown at the moments that matter
 * most (reviewing before submit, right after submitting, and in the
 * reports list until a report is finalized) rather than on every single
 * step screen, where it would just be repetitive noise alongside the
 * progress header that's already there.
 */
export function DraftBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View className="flex-row items-center self-start bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
      <Ionicons name="alert-circle-outline" size={12} color="#B45309" style={{ marginRight: 4 }} />
      <Text className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
        {compact ? DRAFT_BADGE_COPY.label : DRAFT_BADGE_COPY.labelFull}
      </Text>
    </View>
  );
}
