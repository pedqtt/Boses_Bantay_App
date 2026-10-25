import { View, Text } from "react-native";
import { StatusPill } from "@/components/StatusPill";
import { isKnownReportStatus } from "@/lib/myReports";
const softPalette: Record<string, { bg: string; fg: string }> = {
  "Under Review": { bg: "#FFF3DA", fg: "#82520A" },
  Forwarded: { bg: "#EAF0FE", fg: "#173D92" },
  Investigating: { bg: "#FDECEE", fg: "#A22839" },
  Resolved: { bg: "#E9F6EE", fg: "#166539" },
  "CFA Issued": { bg: "#F0EAFB", fg: "#6833A0" },
};
export function ReportStatusBadge({ status, soft = false }: { status: string; soft?: boolean }) {
  if (!soft && isKnownReportStatus(status)) return <StatusPill status={status} />;
  const palette = softPalette[status] ?? { bg: "#EDF0F5", fg: "#374151" };
  return <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: palette.bg, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, maxWidth: "100%" }}>
    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.fg, marginRight: 6 }} />
    <Text style={{ fontSize: 11, lineHeight: 16, fontWeight: "600", color: palette.fg, flexShrink: 1 }}>{status}</Text>
  </View>;
}
