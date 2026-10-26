import { Text } from "@/components/AppText";
import { homeStyles } from "@/components/home/homeStyles";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { useAuth } from "@/lib/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { fetchAccountReports } from "@/lib/api/myReports";
import { reportDate, type AccountReport } from "@/lib/myReports";
import { ReportNotifications } from "@/components/reports/ReportNotifications";
import { ReportStatusBadge } from "@/components/reports/ReportStatusBadge";
import { colors } from "@/lib/theme";

function getHomeGreeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour >= 5 && hour < 12) return "Magandang umaga,";
  if (hour >= 12 && hour < 18) return "Magandang hapon,";
  return "Magandang gabi,";
}

export default function ResidentHome() {
  const { profile } = useAuth();
  const [greeting, setGreeting] = useState(() => getHomeGreeting());
  useEffect(() => {
    const timer = setInterval(() => setGreeting(getHomeGreeting()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useFocusEffect(useCallback(() => { setGreeting(getHomeGreeting()); }, []));
  const [records, setRecords] = useState<{ owner: string; reports: AccountReport[] }>({ owner: "", reports: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(""); setPartial(false);
    try {
      if (!isSupabaseConfigured || !supabase) throw Error("Hindi pa available ang report service.");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || !profile?.id || user.id !== profile.id) throw Error("Mag-sign in muli upang makita ang inyong reports.");
      const result = await fetchAccountReports(supabase, user.id);
      if (request !== generation.current) return;
      setRecords({ owner: user.id, reports: result.reports });
      setPartial(result.warnings.length > 0);
    } catch (err) {
      if (request !== generation.current) return;
      setRecords({ owner: profile?.id ?? "", reports: [] });
      setError(err instanceof Error ? err.message : "Hindi ma-load ang reports. Pakisubukan muli.");
    } finally { if (request === generation.current) setLoading(false); }
  }, [profile?.id]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  const reports = records.owner === profile?.id ? records.reports : [];
  const name = profile?.firstName?.trim() || "Resident";
  return <ReportNotifications sample owner={profile?.id ?? ""} reports={reports} loading={loading} error={error} partial={partial} refresh={() => void load()}>{({ bell, preview }) => <SafeAreaView edges={["top"]} style={s.screen}>
    <View style={s.header}>
      <View style={s.headerIdentity}>
        <Text style={s.greeting}>{greeting}</Text>
        <Text variant="display" accessibilityRole="header" numberOfLines={2} style={s.name}>{name}</Text>
      </View>
      {bell}
    </View>
    <ScrollView style={s.content} showsVerticalScrollIndicator={false} contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={s.actionGroup}>
        <Pressable android_ripple={{ color: "#DCE4F5" }} accessibilityRole="button" onPress={() => router.push("/(resident)/report")} style={s.hero}>
          <View style={s.heroIcon}><Ionicons name="mic-outline" size={23} color="white" /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={s.heroTitle}>Blotter report</Text><Text style={s.heroDescription}>I-record ang inyong salaysay</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
        <Pressable android_ripple={{ color: "#DCE4F5" }} accessibilityRole="button" onPress={() => router.push("/(resident)/service-complaint")} style={s.service}>
          <View style={s.icon}><Ionicons name="construct-outline" size={22} color={colors.primary} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={s.actionTitle}>Service complaint</Text><Text style={s.actionDescription}>Mag-ulat ng problema sa inyong lugar</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>
      <View style={s.quickRow}>
        <Pressable android_ripple={{ color: "#DCE4F5" }} accessibilityRole="button" onPress={() => router.push("/(resident)/bot")} style={s.quickCard}>
          <View style={s.shortcutIcon}><Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.primary} /></View><Text style={s.shortcutTitle}>Barangay Bot</Text>
        </Pressable>
        <Pressable android_ripple={{ color: "#DCE4F5" }} accessibilityRole="button" onPress={() => router.push("/(resident)/directory")} style={[s.quickCard, s.emergency]}>
          <View style={s.shortcutIcon}><Ionicons name="call-outline" size={19} color={colors.error} /></View><Text style={[s.shortcutTitle, { color: colors.error }]}>Emergency</Text>
        </Pressable>
      </View>
      {preview}
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>Mga ulat</Text><Pressable android_ripple={{ color: "#DCE4F5" }} accessibilityRole="button" accessibilityLabel="Tingnan lahat ng reports" onPress={() => router.push("/(resident)/reports")} style={s.link}><Text style={s.linkText}>Tingnan lahat</Text><Ionicons name="arrow-forward" size={15} color={colors.primary} /></Pressable></View>
      {partial && !loading && <Text accessibilityRole="alert" style={s.notice}>May ilang report na hindi ma-load.</Text>}
      {loading ? <View accessibilityLabel="Kinukuha ang inyong reports" accessibilityState={{ busy: true }} style={s.reportGroup}>
          {[0, 1].map(index => <View key={index} accessible={false} importantForAccessibility="no-hide-descendants" style={[s.reportRow, index > 0 && s.reportDivider]}>
            <View style={s.reportHeading}><View style={[s.skeleton, { width: 40, height: 40, borderRadius: 12 }]} /><View style={{ flex: 1, gap: 7 }}><View style={[s.skeleton, { height: 12, width: "68%" }]} /><View style={[s.skeleton, { height: 9, width: "42%" }]} /></View></View>
            <View style={[s.skeleton, { height: 22, width: 82, marginTop: 13 }]} />
          </View>)}
        </View>
        : error ? <View style={s.empty}><Ionicons name="cloud-offline-outline" size={28} color={colors.primary} /><Text accessibilityRole="alert" style={s.emptyText}>{error}</Text><Pressable android_ripple={{ color: "#DCE4F5" }} accessibilityRole="button" onPress={() => void load()} style={s.retry}><Text style={s.linkText}>Subukan muli</Text></Pressable></View>
        : reports.length === 0 ? <View style={s.empty}><View style={s.icon}><Ionicons name="document-text-outline" size={24} color={colors.primary} /></View><Text style={s.emptyTitle}>Wala pang ulat</Text><Text style={s.emptyText}>Lalabas dito ang inyong mga isinumiteng ulat.</Text></View>
        : <View style={s.reportGroup}>{reports.slice(0, 3).map((report, index) => <Pressable key={`${report.source}:${report.id}`} accessibilityRole="button" accessibilityLabel={`Buksan ${report.category}, ${report.referenceNo}`}
          onPress={() => router.push({ pathname: "/(resident)/report-detail", params: { id: report.id, source: report.source } })} style={[s.reportRow, index > 0 && s.reportDivider]}>
          <View style={s.reportHeading}>
            <View style={s.reportIcon}><Ionicons name={report.kind === "blotter" ? "document-text-outline" : "construct-outline"} size={19} color={colors.primary} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={2} style={s.reportTitle}>{report.category}</Text><Text style={s.reportReference}>{report.referenceNo}</Text></View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </View>
          <View style={s.reportStatus}><ReportStatusBadge status={report.status} soft /><Text style={s.reportDate}>{reportDate(report.createdAt)}</Text></View>
        </Pressable>)}</View>}
    </ScrollView>
  </SafeAreaView>}</ReportNotifications>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1, backgroundColor: colors.residentBackground },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerIdentity: { flex: 1, minWidth: 0, gap: 7 },
  greeting: { fontSize: 13, lineHeight: 20, fontWeight: "500", letterSpacing: 0.2, color: "#64748B" },
  name: { fontSize: 32, lineHeight: 40, fontWeight: "700", color: "#14244B", letterSpacing: -0.8 },
  skeleton: { backgroundColor: "#EDF0F6", borderRadius: 6 },
  body: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 110 }, sectionTitle: homeStyles.sectionTitle,
  actionGroup: { ...homeStyles.card, overflow: "hidden" },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 18, backgroundColor: colors.residentTint },
  heroIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primary, borderWidth: 1, borderColor: "#2445B5", alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 16, lineHeight: 24, fontWeight: "600", color: colors.primary }, heroDescription: { fontSize: 12, lineHeight: 19, color: "#596B94", marginTop: 4 },
  service: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DFE5EF" },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 16, lineHeight: 24, fontWeight: "600", color: "#172033" }, actionDescription: { fontSize: 12, lineHeight: 19, color: "#64748B", marginTop: 4 },
  quickRow: { flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 28 }, quickCard: { flex: 1, minWidth: 0, flexDirection: "row", justifyContent: "flex-start", paddingHorizontal: 12, paddingVertical: 14, alignItems: "center", gap: 8, backgroundColor: colors.residentTint, borderWidth: 1, borderColor: "#DDE6FA", borderRadius: 16 }, shortcutTitle: { flexShrink: 1, fontSize: 13, lineHeight: 20, fontWeight: "600", color: colors.primary }, emergency: { backgroundColor: colors.errorContainer, borderColor: colors.errorOutline },
  shortcutIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  reportIcon: homeStyles.itemIcon,
  reportTitle: homeStyles.itemTitle,
  sectionHeader: homeStyles.sectionHeading, link: homeStyles.link, linkText: homeStyles.linkText,
  reportGroup: { ...homeStyles.card, paddingHorizontal: 16 },
  reportRow: { paddingVertical: 20 }, reportDivider: homeStyles.divider,
  reportHeading: { flexDirection: "row", alignItems: "center", gap: 12 }, reportReference: { fontSize: 11, lineHeight: 17, color: "#64748B", marginTop: 4 }, reportStatus: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, rowGap: 8, marginTop: 16 }, reportDate: { ...homeStyles.metadata, flexShrink: 1 },
  empty: { alignItems: "center", padding: 24, borderRadius: 20, borderWidth: 1, borderColor: "#DFE5EF", backgroundColor: "white", gap: 12 }, emptyTitle: { fontSize: 16, fontWeight: "600", color: "#172033" }, emptyText: { fontSize: 13, lineHeight: 21, color: "#64748B", textAlign: "center" }, retry: { padding: 12 }, notice: { fontSize: 12, lineHeight: 19, color: "#92400E", marginTop: 10 },
});
