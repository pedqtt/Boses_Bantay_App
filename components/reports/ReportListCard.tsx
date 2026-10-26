import { Text } from "@/components/AppText";
import { View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { KIND_META } from "@/lib/sampleReports";
import { reportDate, reportNextStep, type AccountReport } from "@/lib/myReports";
import { colors } from "@/lib/theme";
import { ReportStatusBadge } from "./ReportStatusBadge";

export function ReportListCard({ report }: { report: AccountReport }) {
  const meta = KIND_META[report.kind];
  return <Pressable accessibilityRole="button" accessibilityLabel={`Buksan ${report.referenceNo}, ${report.category}, ${report.status}`}
    onPress={() => router.push({ pathname: "/(resident)/report-detail", params: { id: report.id, source: report.source } })}
    className="active:opacity-80" style={styles.card}>
    <View style={styles.content}>
      <View style={styles.topRow}>
        <View style={[styles.kindIcon, { backgroundColor: meta.bg }]}><Ionicons name={meta.icon} size={17} color={meta.fg} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.kind}>{report.kind === "blotter" ? "Blotter report" : "Service complaint"}</Text><Text style={styles.reference}>{report.referenceNo}</Text></View>
        <Ionicons name="chevron-forward" size={17} color={colors.onSurfaceVariant} />
      </View>
      <Text style={styles.title}>{report.category}</Text>
      <Text style={styles.summary} numberOfLines={2}>{report.summary}</Text>
      <View style={styles.relationships}>
        {report.createdByMe && <SmallDetail icon="person-outline" text="Ginawa ko" />}
        {report.assignedToMe && <SmallDetail icon="briefcase-outline" text="Nakatalaga sa akin" highlighted />}
        {report.photoCount > 0 && <SmallDetail icon="images-outline" text={`${report.photoCount} larawan`} />}
      </View>
      <View style={styles.metadata}>
        <SmallDetail icon="calendar-outline" text={`Isinumite ${reportDate(report.createdAt)}`} />
        {report.location ? <SmallDetail icon="location-outline" text={report.location} /> : null}
        {report.updatedAt && report.updatedAt !== report.createdAt ? <SmallDetail icon="refresh-outline" text={`Na-update ${reportDate(report.updatedAt)}`} /> : null}
        {report.hearingDate && !report.hearingCompleted ? <SmallDetail icon="time-outline" text={`Hearing: ${reportDate(report.hearingDate)}`} highlighted /> : null}
      </View>
    </View>
    <View style={styles.statusArea}>
      <ReportStatusBadge status={report.status} soft />
      <Text style={styles.nextStep}>{reportNextStep(report)}</Text>
    </View>
  </Pressable>;
}
function SmallDetail({ icon, text, highlighted = false }: { icon: keyof typeof Ionicons.glyphMap; text: string; highlighted?: boolean }) {
  return <View style={{ flexDirection: "row", alignItems: "flex-start", columnGap: 6, maxWidth: "100%" }}>
    <Ionicons name={icon} size={13} color={highlighted ? colors.primary : colors.onSurfaceVariant} style={{ marginTop: 2 }} />
    <Text numberOfLines={2} style={{ flexShrink: 1, fontSize: 12, lineHeight: 19, color: highlighted ? colors.primary : colors.onSurfaceVariant, fontWeight: highlighted ? "600" : "400" }}>{text}</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 20, marginBottom: 14, overflow: "hidden" },
  content: { padding: 18 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 15 },
  kindIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  kind: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant, fontWeight: "500" },
  reference: { fontSize: 11, lineHeight: 17, color: colors.onSurfaceFaint, marginTop: 1, letterSpacing: 0.3 },
  title: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: colors.onSurface },
  summary: { fontSize: 14, lineHeight: 22, color: colors.onSurfaceVariant, marginTop: 7 },
  relationships: { flexDirection: "row", flexWrap: "wrap", columnGap: 13, rowGap: 6, marginTop: 12 },
  metadata: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E3E8F0", paddingTop: 12, marginTop: 14, rowGap: 7 },
  statusArea: { paddingHorizontal: 18, paddingVertical: 13, backgroundColor: "#F8FAFD", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E3E8F0", alignItems: "flex-start" },
  nextStep: { fontSize: 12, lineHeight: 19, color: colors.onSurfaceVariant, marginTop: 7 },
});
