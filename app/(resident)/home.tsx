import { liveDataCache } from "@/lib/live-data-cache";
import { useNavbarScroll } from "@/lib/navbar-scroll";
import { Text } from "@/components/AppText";
import { useTypography } from "@/lib/typography-context";
import { homeStyles } from "@/components/home/homeStyles";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, RefreshControl, StyleSheet, useWindowDimensions, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { useAuth } from "@/lib/auth-context";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { fetchAccountReports } from "@/lib/api/myReports";
import { fetchResidentNotices } from "@/lib/api/residentNotifications";
import { type AccountReport } from "@/lib/myReports";
import { ReportNotifications } from "@/components/reports/ReportNotifications";
import { ReportStatusBadge } from "@/components/reports/ReportStatusBadge";
import { getGreetingPeriod, pickHomeGreeting } from "@/lib/home-greeting";
import { colors } from "@/lib/theme";

function homeReportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Hindi nakatala" : date.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
}
export default function ResidentHome() {
  const navbarScroll = useNavbarScroll();
  const { width, fontScale } = useWindowDimensions();
  const { scale: textScale } = useTypography();
  const stackActions = width < 360 || textScale * fontScale > 1.25;
  const [pressedAction, setPressedAction] = useState<string | null>(null);
  const { profile } = useAuth();
  const [greeting, setGreeting] = useState(() => pickHomeGreeting());
  const hasFocusedHome = useRef(false);
  useEffect(() => {
    const updateTimePeriod = () => setGreeting(previous => {
      const now = new Date();
      return previous.period === getGreetingPeriod(now) ? previous : pickHomeGreeting(now, previous);
    });
    const timer = setInterval(updateTimePeriod, 60_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") updateTimePeriod(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  useFocusEffect(useCallback(() => {
    const returning = hasFocusedHome.current;
    hasFocusedHome.current = true;
    setGreeting(previous => {
      const now = new Date();
      return !returning && previous.period === getGreetingPeriod(now) ? previous : pickHomeGreeting(now, previous);
    });
  }, []));
  const [records, setRecords] = useState<{ owner: string; reports: AccountReport[] }>(() => ({ owner: profile?.id ?? "", reports: liveDataCache.accounts.get(profile?.id ?? "")?.reports ?? [] }));
  const [notices, setNotices] = useState<AccountReport[]>(() => liveDataCache.accounts.get(profile?.id ?? "")?.notices ?? []);
  const [loading, setLoading] = useState(!liveDataCache.accounts.has(profile?.id ?? ""));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const generation = useRef(0);
  const loadedOwner = useRef<string | null>(null);
  const load = useCallback(async (refresh = false) => {
    const request = ++generation.current;
    setRefreshing(refresh);
    setLoading(loadedOwner.current !== (profile?.id ?? ""));
    setError("");
    try {
      if (!isSupabaseConfigured || !supabase) throw Error("Hindi pa available ang report service.");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || !profile?.id || user.id !== profile.id) throw Error("Mag-sign in muli upang makita ang inyong reports.");
      const [reportResult, noticeResult] = await Promise.allSettled([fetchAccountReports(supabase, user.id), fetchResidentNotices(supabase, user.id)]);
      if (reportResult.status === "rejected" && noticeResult.status === "rejected") throw Error("Hindi ma-load ang notifications. Pakisubukan muli.");
      const result = reportResult.status === "fulfilled" ? reportResult.value : { reports: [], warnings: ["reports"] };
      if (request !== generation.current) return;
      setRecords({ owner: user.id, reports: result.reports });
      const nextNotices = noticeResult.status === "fulfilled" ? noticeResult.value : [];
      setNotices(nextNotices);
      liveDataCache.accounts.set(user.id, { reports: result.reports, notices: nextNotices, partial: result.warnings.length > 0 || noticeResult.status === "rejected" });
      setPartial(result.warnings.length > 0 || noticeResult.status === "rejected");
    } catch (err) {
      if (request !== generation.current) return;
      setRecords({ owner: profile?.id ?? "", reports: [] });
      setNotices([]);
      setError(err instanceof Error ? err.message : "Hindi ma-load ang reports. Pakisubukan muli.");
    } finally { if (request === generation.current) { loadedOwner.current = profile?.id ?? ""; setLoading(false); setRefreshing(false); } }
  }, [profile?.id]);
  useFocusEffect(useCallback(() => {
    if (loadedOwner.current !== profile?.id || !liveDataCache.accounts.has(profile?.id ?? "")) void load();
    if (!supabase || !profile?.id) return () => { generation.current++; };
    const changed = () => { void load(); };
    const channel = supabase.channel(`home-live-${profile.id}`).on("postgres_changes", { event: "*", schema: "public", table: "reports" }, changed).on("postgres_changes", { event: "*", schema: "public", table: "service_complaints" }, changed).on("postgres_changes", { event: "*", schema: "public", table: "pre_blotters" }, changed).on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, changed).subscribe();
    return () => { generation.current++; void supabase.removeChannel(channel); };
  }, [load, profile?.id]));
  const reports = records.owner === profile?.id ? records.reports : [];
  const name = [profile?.firstName?.trim(), profile?.lastName?.trim()].filter(Boolean).join(" ") || "Resident";
  return <ReportNotifications owner={profile?.id ?? ""} reports={reports} notices={records.owner === profile?.id ? notices : []} loading={loading} error={error} partial={partial} refreshing={refreshing} refresh={() => load(true)}>{({ bell, preview }) => <SafeAreaView edges={["top"]} style={s.screen}>
    <View style={s.header}>
      <View style={s.headerIdentity}>
        <Text style={s.greeting}>{greeting.text}</Text>
        <Text variant="display" accessibilityRole="header" numberOfLines={2} style={s.name}>{name}</Text>
      </View>
      {bell}
    </View>
    <ScrollView onScroll={navbarScroll.onScroll} onScrollBeginDrag={navbarScroll.onScrollBeginDrag} scrollEventThrottle={16} style={s.content} showsVerticalScrollIndicator={false} contentContainerStyle={[s.body, { paddingBottom: navbarScroll.bottomPadding }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={s.quickActions}>
        <View style={[s.primaryActions, stackActions && { flexDirection: "column" }]}>
          <Pressable android_ripple={{ color: "transparent" }} accessibilityRole="button" accessibilityLabel="Blotter report. I-record ang inyong salaysay." onPressIn={() => setPressedAction("blotter")} onPressOut={() => setPressedAction(null)} onPress={() => router.push("/(resident)/report")} style={[s.primaryTile, s.blotterTile, pressedAction === "blotter" && s.actionPressed]}>
            <View style={s.tileTop}><View style={s.blotterTileIcon}><Ionicons name="mic-outline" size={24} color={colors.primary} /></View></View>
            <View style={s.tileCopy}><Text style={s.tileTitle}>Blotter report</Text><Text style={s.tileDescription}>I-record ang inyong salaysay</Text></View>
          </Pressable>
          <Pressable android_ripple={{ color: "transparent" }} accessibilityRole="button" accessibilityLabel="Service complaint. Mag-ulat ng problema sa inyong lugar." onPressIn={() => setPressedAction("service")} onPressOut={() => setPressedAction(null)} onPress={() => router.push("/(resident)/service-complaint")} style={[s.primaryTile, s.serviceTile, pressedAction === "service" && s.actionPressed]}>
            <View style={s.tileTop}><View style={s.serviceTileIcon}><Ionicons name="construct-outline" size={23} color="#986712" /></View></View>
            <View style={s.tileCopy}><Text style={[s.tileTitle, s.serviceTileTitle]}>Service complaint</Text><Text style={[s.tileDescription, s.serviceTileDescription]}>Mag-ulat ng problema sa inyong lugar</Text></View>
          </Pressable>
        </View>
        <View style={[s.secondaryActions, stackActions && { flexDirection: "column" }]}>
          <Pressable android_ripple={{ color: "transparent" }} accessibilityRole="button" onPressIn={() => setPressedAction("bot")} onPressOut={() => setPressedAction(null)} onPress={() => router.push("/(resident)/bot")} style={[s.secondaryAction, pressedAction === "bot" && s.secondaryPressed]}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} /><Text style={s.secondaryLabel}>Barangay Bot</Text>
          </Pressable>
          <View style={stackActions ? s.secondaryDividerHorizontal : s.secondaryDivider} />
          <Pressable android_ripple={{ color: "transparent" }} accessibilityRole="button" onPressIn={() => setPressedAction("emergency")} onPressOut={() => setPressedAction(null)} onPress={() => router.push("/(resident)/directory")} style={[s.secondaryAction, pressedAction === "emergency" && s.secondaryPressed]}>
            <Ionicons name="call-outline" size={20} color={colors.error} /><Text style={[s.secondaryLabel, { color: colors.error }]}>Emergency</Text>
          </Pressable>
        </View>
      </View>
      <View style={s.reportsSection}>
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>Mga ulat</Text><Pressable android_ripple={{ color: "#DCE4F5" }} accessibilityRole="button" accessibilityLabel="Tingnan lahat ng reports" onPress={() => router.push("/(resident)/reports")} style={s.link}><Text style={s.linkText}>Tingnan lahat</Text><Ionicons name="chevron-forward" size={14} color={colors.primary} /></Pressable></View>
      {partial && !loading && <Text accessibilityRole="alert" style={s.notice}>May ilang report na hindi ma-load.</Text>}
      {loading ? <View accessibilityLabel="Kinukuha ang inyong reports" accessibilityState={{ busy: true }} style={s.reportGroup}>
          {[0, 1].map(index => <View key={index} accessible={false} importantForAccessibility="no-hide-descendants" style={s.reportRow}>
            <View style={s.reportHeading}><View style={[s.skeleton, { width: 40, height: 40, borderRadius: 12 }]} /><View style={{ flex: 1, gap: 7 }}><View style={[s.skeleton, { height: 12, width: "68%" }]} /><View style={[s.skeleton, { height: 9, width: "42%" }]} /></View></View>
            <View style={[s.skeleton, { height: 22, width: 82, marginTop: 13 }]} />
          </View>)}
        </View>
        : error ? <View style={s.empty}><Ionicons name="cloud-offline-outline" size={28} color={colors.primary} /><Text accessibilityRole="alert" style={s.emptyText}>{error}</Text><Pressable android_ripple={{ color: "#DCE4F5" }} accessibilityRole="button" onPress={() => void load(true)} style={s.retry}><Text style={s.linkText}>Subukan muli</Text></Pressable></View>
        : reports.length === 0 ? <View style={s.empty}><View style={s.icon}><Ionicons name="document-text-outline" size={24} color={colors.primary} /></View><Text style={s.emptyTitle}>Wala pang ulat</Text><Text style={s.emptyText}>Lalabas dito ang inyong mga isinumiteng ulat.</Text></View>
        : <View style={s.reportGroup}>{reports.slice(0, 3).map((report, index) => <Pressable key={`${report.source}:${report.id}`} accessibilityRole="button" accessibilityLabel={`Buksan ${report.category}, ${report.referenceNo}`}
          onPress={() => router.push({ pathname: "/(resident)/report-detail", params: { id: report.id, source: report.source } })} style={[s.reportRow, index > 0 && s.reportDivider]}>
          <View style={s.reportMain}>
            <View style={s.reportTitleRow}><Text numberOfLines={2} style={s.reportTitle}>{report.category}</Text><Ionicons name="chevron-forward" size={16} color="#94A3B8" /></View>
            <Text numberOfLines={1} style={s.reportReference}>{report.kind === "blotter" ? "Blotter" : "Service complaint"} · {report.referenceNo}</Text>
            <View style={s.reportFooter}>
              <ReportStatusBadge status={report.status} soft compact />
              <Text style={s.reportDate}>{homeReportDate(report.updatedAt || report.createdAt)}</Text>
            </View>
          </View>
        </Pressable>)}</View>}
      </View>
      {preview}
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
  quickActions: { marginBottom: 28 },
  reportsSection: { marginBottom: 28 },
  primaryActions: { flexDirection: "row", alignItems: "stretch", gap: 12 },
  primaryTile: { flex: 1, minWidth: 0, minHeight: 152, padding: 16, borderRadius: 20, justifyContent: "space-between", borderWidth: 1, overflow: "hidden" },
  blotterTile: { backgroundColor: "#F2F5FC", borderColor: "#E1E7F2" },
  serviceTile: { backgroundColor: "#FFFAEF", borderColor: "#EEE6D6" },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  blotterTileIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  serviceTileIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  tileArrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF14", alignItems: "center", justifyContent: "center" },
  serviceArrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF60", alignItems: "center", justifyContent: "center" },
  tileCopy: { marginTop: 18 },
  tileTitle: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: "#20304A", letterSpacing: -0.2 },
  tileDescription: { fontSize: 12, lineHeight: 18, color: "#64748B", marginTop: 5 },
  serviceTileTitle: { color: "#20304A" },
  serviceTileDescription: { color: "#786E59" },
  secondaryActions: { flexDirection: "row", marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: "#E1E6EF", backgroundColor: "#FFFFFF", overflow: "hidden" },
  secondaryAction: { flex: 1, minWidth: 0, minHeight: 58, paddingHorizontal: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryLabel: { flexShrink: 1, fontSize: 12, lineHeight: 19, fontWeight: "600", color: colors.primary },
  secondaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "#E5EAF2", marginVertical: 14 },
  secondaryDividerHorizontal: { height: StyleSheet.hairlineWidth, backgroundColor: "#E5EAF2", marginHorizontal: 16 },
  actionPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  secondaryPressed: { backgroundColor: "#F0F3F8" },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" },
  reportTitle: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21, color: "#20304A", fontWeight: "600" },
  sectionHeader: homeStyles.sectionHeading, link: homeStyles.link, linkText: homeStyles.linkText,
  reportGroup: { ...homeStyles.card, paddingHorizontal: 14, overflow: "hidden" },
  reportRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 15 },
  reportDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E3E8F0" },
  reportHeading: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  reportMain: { flex: 1, minWidth: 0 },
  reportTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reportReference: { fontSize: 11, lineHeight: 17, color: "#64748B", marginTop: 3 },
  reportFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, flexWrap: "wrap" },
  reportDate: { fontSize: 11, lineHeight: 16, color: "#718096", fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", padding: 24, borderRadius: 20, borderWidth: 1, borderColor: "#DFE5EF", backgroundColor: "white", gap: 12 }, emptyTitle: { fontSize: 16, fontWeight: "600", color: "#172033" }, emptyText: { fontSize: 13, lineHeight: 21, color: "#64748B", textAlign: "center" }, retry: { padding: 12 }, notice: { fontSize: 12, lineHeight: 19, color: "#92400E", marginTop: 10 },
});
