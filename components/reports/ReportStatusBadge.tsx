import { Text } from "@/components/AppText";
import { View } from "react-native";
import { StatusPill } from "@/components/StatusPill";
import { isKnownReportStatus } from "@/lib/myReports";
const softPalette: Record<string, { bg: string; fg: string }> = {
  "Under Review": { bg: "#FFF3DA", fg: "#82520A" },
  Forwarded: { bg: "#EAF0FE", fg: "#173D92" },
  Investigating: { bg: "#FDECEE", fg: "#A22839" },
  Resolved: { bg: "#E9F6EE", fg: "#166539" },
  "CFA Issued": { bg: "#F0EAFB", fg: "#6833A0" },
};
export function reportStatusColors(status: string) { return softPalette[status] ?? { bg: "#EDF0F5", fg: "#374151" }; }
export function ReportStatusBadge({ status, soft = false, compact = false, outlined = false, unread }: { status: string; soft?: boolean; compact?: boolean; outlined?: boolean; unread?: boolean }) {
  if (!soft && !outlined && !compact && unread === undefined && isKnownReportStatus(status)) return <StatusPill status={status} />;
  const palette = reportStatusColors(status);
  return <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: outlined || unread ? "#FFFFFF" : palette.bg, borderWidth: outlined || unread !== undefined ? 1 : 0, borderColor: outlined || unread ? palette.fg : "transparent", borderRadius: compact ? 7 : 8, paddingHorizontal: compact ? 7 : 9, paddingVertical: compact ? 2 : 5, maxWidth: "100%" }}>
    <View style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0, backgroundColor: palette.fg, marginRight: 6 }} />
    <Text style={{ fontSize: compact ? 10 : 11, lineHeight: compact ? 15 : 16, fontWeight: compact ? "700" : "600", color: palette.fg, flexShrink: 1 }}>{status}</Text>
  </View>;
}
