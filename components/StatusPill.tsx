import { View, Text } from "react-native";
import type { ReportSummary } from "@/lib/api/mockData";

// Single source of truth for the status badge vocabulary — was previously
// defined identically in both home.tsx and reports.tsx, which is exactly
// the kind of drift risk the component-hierarchy skill warns against
// ("define a small, fixed set of label/badge types up front... don't
// invent ad hoc emphasis per screen"). One definition now, imported
// everywhere status needs to render.
//
// Solid, traffic-light-coded fills with white text — status is meant to be
// readable at a glance, not inferred from a subtle tint. Red = needs
// attention now, yellow = queued/waiting, green = done. Shade picked one
// step darker than the default (amber-700, green-700) so white text stays
// at or above WCAG AA contrast at this badge's small size.
//
// bg and text are separate fields (not one combined className) because
// React Native doesn't cascade text color from a parent View to a child
// Text the way CSS does on the web — the text color has to be applied
// directly on the <Text> element itself, or it silently falls back to the
// platform default (black) no matter what the wrapping View says.
const STATUS_META: Record<ReportSummary["status"], { bg: string; text: string; dot: string }> = {
  "Under Review": { bg: "bg-amber-700", text: "text-white", dot: "bg-white" },
  Investigating: { bg: "bg-alert", text: "text-white", dot: "bg-white" },
  Resolved: { bg: "bg-green-700", text: "text-white", dot: "bg-white" },
};

export function StatusPill({ status }: { status: ReportSummary["status"] }) {
  const meta = STATUS_META[status];
  return (
    <View className={`flex-row items-center px-2.5 py-1 rounded-full ${meta.bg}`}>
      <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${meta.dot}`} />
      <Text className={`text-[11px] font-medium ${meta.text}`}>{status}</Text>
    </View>
  );
}
