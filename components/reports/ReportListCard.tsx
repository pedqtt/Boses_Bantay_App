import { Text } from "@/components/AppText";
import { View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { KIND_META } from "@/lib/sampleReports";
import { reportDate, reportNextStep, type AccountReport } from "@/lib/myReports";
import { colors } from "@/lib/theme";
import { ReportStatusBadge } from "./ReportStatusBadge";

function submittedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Hindi nakatala" : date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
  });
}
export function ReportListCard({ report }: { report: AccountReport }) {
  const meta = KIND_META[report.kind];
  const hasSummary = Boolean(report.summary.trim()) && report.summary.trim().toLowerCase() !== report.category.trim().toLowerCase();
  const hasHearing = Boolean(report.hearingDate && !report.hearingCompleted);
  return <Pressable accessibilityRole="button"
    accessibilityLabel={"Buksan " + report.category + ", " + report.referenceNo + ", " + report.status}
    accessibilityHint="Buksan ang buong detalye at kasalukuyang hakbang ng report."
    onPress={() => router.push({ pathname: "/(resident)/report-detail", params: { id: report.id, source: report.source } })}
    android_ripple={{ color: "rgba(2,31,148,0.04)" }} className="active:opacity-90" style={styles.card}>
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.kind, { color: meta.fg }]}>{report.kind === "blotter" ? "Blotter report" : "Service complaint"}</Text>
        <ReportStatusBadge status={report.status} soft compact />
      </View>
      <Text style={styles.title}>{report.category}</Text>
      <Text numberOfLines={1} style={styles.reference}>{report.referenceNo}</Text>
      {hasSummary && <Text numberOfLines={2} style={styles.summary}>{report.summary}</Text>}
      {(report.createdByMe || report.assignedToMe || report.photoCount > 0) && <View style={styles.relationships}>
        {report.createdByMe && <View style={styles.tag}><Text style={styles.tagText}>Ginawa ko</Text></View>}
        {report.assignedToMe && <View style={[styles.tag, styles.assignedTag]}><Text style={[styles.tagText, styles.assignedText]}>Nakatalaga sa akin</Text></View>}
        {report.photoCount > 0 && <View style={styles.tag}><Text style={styles.tagText}>{report.photoCount} larawan</Text></View>}
      </View>}
      <View style={styles.details}>
        <View style={styles.detailCell}><Text style={styles.detailLabel}>Isinumite</Text><Text style={styles.detailValue}>{submittedDate(report.createdAt)}</Text></View>
        <View style={styles.detailCell}><Text style={styles.detailLabel}>Lokasyon</Text><Text numberOfLines={2} style={styles.detailValue}>{report.location || "Hindi nakatala"}</Text></View>
      </View>
      {hasHearing && <View style={styles.hearing}>
        <Ionicons name="calendar-outline" size={17} color={colors.primary} />
        <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.hearingLabel}>Iskedyul ng hearing</Text><Text style={styles.hearingDate}>{reportDate(report.hearingDate!)}</Text></View>
      </View>}
    </View>
    <View style={styles.footer}>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.nextLabel}>Susunod na hakbang</Text><Text style={styles.nextStep}>{reportNextStep(report)}</Text></View>
      <View style={styles.openIndicator}><Ionicons name="chevron-forward" size={16} color={colors.primary} /></View>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE4EF", borderRadius: 18, marginBottom: 12, overflow: "hidden" },
  content: { padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  kind: { fontSize: 11, lineHeight: 17, fontWeight: "600" },
  title: { fontSize: 17, lineHeight: 24, fontWeight: "700", color: "#20304A", letterSpacing: -0.2 },
  reference: { fontSize: 11, lineHeight: 17, color: "#718096", marginTop: 4, fontVariant: ["tabular-nums"] },
  summary: { fontSize: 13, lineHeight: 20, color: "#64748B", marginTop: 9 },
  relationships: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: "#F3F5F8" },
  tagText: { fontSize: 10, lineHeight: 15, color: "#52617A", fontWeight: "500" },
  assignedTag: { backgroundColor: "#EDF2FC" },
  assignedText: { color: colors.primary, fontWeight: "600" },
  details: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 12, marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5EAF2" },
  detailCell: { flex: 1, flexBasis: "44%", minWidth: 110, gap: 4 },
  detailLabel: { fontSize: 10, lineHeight: 16, fontWeight: "500", color: "#718096" },
  detailValue: { fontSize: 12, lineHeight: 19, color: "#37465E", fontWeight: "500" },
  hearing: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#EDF2FC", borderRadius: 10, padding: 12, marginTop: 12 },
  hearingLabel: { fontSize: 10, lineHeight: 16, color: "#52617A" },
  hearingDate: { fontSize: 12, lineHeight: 19, color: colors.primary, fontWeight: "600", marginTop: 2 },
  footer: { paddingHorizontal: 16, paddingVertical: 13, backgroundColor: "#F8FAFD", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5EAF2", flexDirection: "row", alignItems: "center", gap: 12 },
  nextLabel: { fontSize: 10, lineHeight: 16, fontWeight: "600", color: "#52617A" },
  nextStep: { fontSize: 12, lineHeight: 19, color: "#64748B", marginTop: 3 },
  openIndicator: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#EDF2FC", alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
