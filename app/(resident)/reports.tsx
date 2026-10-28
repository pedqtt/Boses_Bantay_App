import { liveDataCache } from "@/lib/live-data-cache";
import { useNavbarScroll } from "@/lib/navbar-scroll";
import { Text, TextInput } from "@/components/AppText";
import { FilterRadioGroup } from "@/components/FilterRadioGroup";
import { DateSortOptions } from "@/components/DateSortOptions";
import { sortByDate, type DateSortOrder } from "@/lib/list-sort";
import { SlideUpSheet } from "@/components/SlideUpSheet";
import { ReportsPageGuide } from "@/components/reports/ReportsPageGuide";
import { ReportListCard } from "@/components/reports/ReportListCard";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, FlatList, RefreshControl, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { fetchAccountReports } from "@/lib/api/myReports";
import { isClosedReport, type AccountReport } from "@/lib/myReports";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors, headerActionColors } from "@/lib/theme";
export type { ReportSummary } from "@/lib/sampleReports";

type Filter = "all" | "active" | "closed";
type Scope = "all" | "created" | "assigned";
export default function ReportsScreen() {
  const navbarScroll = useNavbarScroll();
  const { profile } = useAuth();
  const [records, setRecords] = useState<{ owner: string; reports: AccountReport[] }>(() => ({ owner: profile?.id ?? "", reports: liveDataCache.accounts.get(profile?.id ?? "")?.reports ?? [] }));
  const [loading, setLoading] = useState(!liveDataCache.accounts.has(profile?.id ?? ""));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [scopePickerOpen, setScopePickerOpen] = useState(false);
  const [draftScope, setDraftScope] = useState<Scope>("all");
  const [draftFilter, setDraftFilter] = useState<Filter>("all");
  const [sortOrder, setSortOrder] = useState<DateSortOrder>("newest");
  const [draftSort, setDraftSort] = useState<DateSortOrder>("newest");
  const generation = useRef(0);
  const loadedOwner = useRef<string | null>(null);
  const load = useCallback(async (refresh = false) => {
    const request = ++generation.current;
    setRefreshing(refresh);
    setLoading(loadedOwner.current !== (profile?.id ?? ""));
    setError("");
    try {
      if (!isSupabaseConfigured || !supabase) throw Error("Hindi pa naka-configure ang report service.");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || !profile?.id || user.id !== profile.id) throw Error("Mag-sign in po muli upang makita ang inyong reports.");
      const result = await fetchAccountReports(supabase, user.id);
      if (generation.current !== request) return;
      setRecords({ owner: user.id, reports: result.reports }); setPartial(result.warnings.length > 0);
      const old = liveDataCache.accounts.get(user.id); liveDataCache.accounts.set(user.id, { reports: result.reports, notices: old?.notices ?? [], partial: result.warnings.length > 0 });
    } catch (err) {
      if (generation.current !== request) return;
      setRecords({ owner: profile?.id ?? "", reports: [] });
      setError(err instanceof Error ? err.message : "Hindi ma-load ang mga report. Pakisubukan muli.");
    } finally { if (generation.current === request) { loadedOwner.current = profile?.id ?? ""; setLoading(false); setRefreshing(false); } }
  }, [profile?.id]);
  useEffect(() => { setFilter("all"); setScope("all"); setSearch(""); setSortOrder("newest"); setScopePickerOpen(false); }, [profile?.id]);
  useFocusEffect(useCallback(() => {
    if (loadedOwner.current !== profile?.id || !liveDataCache.accounts.has(profile?.id ?? "")) void load();
    if (!supabase || !profile?.id) return () => { generation.current++; };
    const changed = () => { void load(); };
    const channel = supabase.channel(`my-reports-live-${profile.id}`).on("postgres_changes", { event: "*", schema: "public", table: "reports" }, changed).on("postgres_changes", { event: "*", schema: "public", table: "service_complaints" }, changed).on("postgres_changes", { event: "*", schema: "public", table: "pre_blotters" }, changed).subscribe();
    return () => { generation.current++; void supabase.removeChannel(channel); };
  }, [load, profile?.id]));
  const reports = records.owner === profile?.id ? records.reports : [];
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const query = normalizeSearch(search);
  const terms = query.split(/\s+/).filter(Boolean);
  const matchesStatus = (report: AccountReport) => filter === "all" || (filter === "active" ? !isClosedReport(report.status) : isClosedReport(report.status));
  const searched = reports.filter(report => {
    const content = normalizeSearch([report.referenceNo, report.category, report.summary, report.location, report.status, report.kind === "blotter" ? "blotter" : "service complaint serbisyo"].join(" "));
    return terms.every(term => content.includes(term));
  });
  const statusMatches = searched.filter(matchesStatus);
  const statuses: { id: Filter; label: string }[] = [
    { id: "all", label: "Lahat" }, { id: "active", label: "Aktibo" }, { id: "closed", label: "Tapos na" },
  ];
  const scopes: { id: Scope; label: string }[] = [
    { id: "all", label: "Lahat ng report" }, { id: "created", label: "Ginawa ko" }, { id: "assigned", label: "Nakatalaga sa akin" },
  ];
  const visible = sortByDate(statusMatches.filter(report => scope === "all" || (scope === "created" ? report.createdByMe : report.assignedToMe)), report => report.createdAt, sortOrder);
  const clearFilters = () => { setSearch(""); setFilter("all"); setScope("all"); setSortOrder("newest"); };
  const openFilters = () => { setDraftScope(scope); setDraftFilter(filter); setDraftSort(sortOrder); setScopePickerOpen(true); };
  const filtersActive = scope !== "all" || filter !== "all" || sortOrder !== "newest";
  return <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
    <ScreenBackground backgroundColor={colors.residentBackground}>
      <View style={{ backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="screenTitle" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36, fontWeight: "700", color: "#14244B", letterSpacing: -0.6 }}>My Reports</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Buksan ang gabay sa My Reports" accessibilityHint="Nagbubukas ng interactive demo na may naka-highlight na controls" onPress={() => setGuideOpen(true)} android_ripple={{ color: "#DCE4F5" }} style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 16, borderWidth: 1, ...headerActionColors.secondary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}><Ionicons name="help-circle-outline" size={23} color={colors.primary} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="I-refresh ang reports" accessibilityState={{ disabled: loading || refreshing, busy: loading || refreshing }} disabled={loading || refreshing} onPress={() => { void load(true); }} android_ripple={{ color: "#DCE4F5" }} style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 16, borderWidth: 1, ...headerActionColors.primary, alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: refreshing ? 0.65 : 1 }}>{refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={20} color={colors.primary} />}</Pressable>
        </View>
      </View>
      <FlatList onScroll={navbarScroll.onScroll} onScrollBeginDrag={navbarScroll.onScrollBeginDrag} scrollEventThrottle={16} data={loading ? [] : visible} keyExtractor={report => `${report.source}:${report.id}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: navbarScroll.bottomPadding }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
        ListHeaderComponent={<View>
          <View style={f.toolbar}>
            <View style={[f.searchRow, { flex: 1 }]}>
              <Ionicons name="search-outline" size={19} color="#64748B" />
              <TextInput accessibilityLabel="Hanapin ang report" value={search} onChangeText={setSearch} placeholder="Hanapin ang report" placeholderTextColor="#8793A6" style={f.searchInput} returnKeyType="search" autoCorrect={false} />
              {search ? <Pressable accessibilityRole="button" accessibilityLabel="Burahin ang paghahanap" onPress={() => setSearch("")} style={f.clearSearch}><Ionicons name="close-circle" size={18} color="#8793A6" /></Pressable> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={filtersActive ? "Filters, may aktibong filter" : "Buksan ang filters"} accessibilityState={{ expanded: scopePickerOpen }} onPress={openFilters} style={[f.filterButton, filtersActive && f.filterButtonActive]}><Ionicons name="options-outline" size={20} color={colors.primary} /><Text style={f.filterButtonText}>Filters</Text></Pressable>
          </View>
          {partial && <Text accessibilityRole="alert" className="text-[13px] leading-5 text-alert mb-4">May ilang report na hindi ma-load. Maaaring hindi kumpleto ang bilang. I-refresh upang subukang muli.</Text>}
          {!loading && !error && reports.length > 0 && <View className="flex-row items-center justify-between mt-1 mb-4 px-1">
            <Text className="text-[14px] font-semibold text-ink">Mga report</Text>
            <View className="flex-row items-center"><Ionicons name="swap-vertical-outline" size={13} color={colors.onSurfaceVariant} style={{ marginRight: 4 }} /><Text className="text-[11px] text-ink-soft">{sortOrder === "newest" ? "Pinakabago" : "Pinakaluma"}</Text></View>
          </View>}
        </View>}
        ListEmptyComponent={loading ? <View className="items-center py-10"><ActivityIndicator color={colors.primary} /><Text className="text-[13px] text-ink-soft mt-3">Kinukuha ang inyong reports...</Text></View> : <View className="bg-white border border-gray-200 rounded-[20px] px-6 py-9 items-center">
          <Ionicons name={error ? "cloud-offline-outline" : "documents-outline"} size={32} color={colors.primary} />
          <Text className="text-[17px] font-semibold text-ink text-center mt-4">{error ? "Hindi ma-load ang reports" : reports.length ? "Walang tumugmang report" : "Wala ka pang report"}</Text>
          <Text className="text-[14px] leading-6 text-ink-soft text-center mt-2">{error || (reports.length ? "Baguhin ang paghahanap o filter." : "Dito lalabas ang mga report na ginawa mo o nakatalaga sa iyo.")}</Text>
          <Pressable accessibilityRole="button" onPress={() => { if (error) void load(true); else if (reports.length) { clearFilters(); } else router.push("/(resident)/report"); }} className="bg-brand-50 rounded-xl px-5 py-3 mt-5 active:opacity-70"><Text className="text-brand font-semibold">{error ? "Subukan muli" : reports.length ? "Ipakita lahat" : "Gumawa ng report"}</Text></Pressable>
        </View>}
        renderItem={({ item }) => <ReportListCard report={item} />} />
    </ScreenBackground>
    <SlideUpSheet visible={scopePickerOpen} title="Filters" onClose={() => setScopePickerOpen(false)} footer={close => <View style={f.actionRow}>
      <Pressable accessibilityRole="button" onPress={() => { setDraftScope("all"); setDraftFilter("all"); setDraftSort("newest"); }} style={f.resetButton}><Text style={f.resetText}>I-reset</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setScope(draftScope); setFilter(draftFilter); setSortOrder(draftSort); close(); }} style={f.applyButton}><Text style={f.applyText}>I-apply ang filters</Text></Pressable>
    </View>}>
      <FilterRadioGroup title="Mga report" value={draftScope} options={scopes} onChange={setDraftScope} />
      <FilterRadioGroup title="Katayuan" value={draftFilter} options={statuses} onChange={setDraftFilter} separated />
      <DateSortOptions value={draftSort} onChange={setDraftSort} />
    </SlideUpSheet>
    <ReportsPageGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
  </SafeAreaView>;
}


const f = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  filterButton: { minHeight: 48, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#D0DBEC", borderRadius: 14, backgroundColor: "#FFFFFF" },
  filterButtonActive: { backgroundColor: "#E9EFFC", borderColor: "#9FB7E5" },
  filterButtonText: { fontSize: 12, lineHeight: 18, color: colors.primary, fontWeight: "600" },
  groupTitle: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: "#20304A" },
  groupHint: { fontSize: 12, lineHeight: 19, color: "#64748B", marginTop: 3, marginBottom: 12 },
  statusGroup: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E1E7EF" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  resetButton: { minHeight: 50, minWidth: 90, paddingHorizontal: 18, borderWidth: 1, borderColor: "#D5DDE9", borderRadius: 12, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  applyButton: { flex: 1, minWidth: 160, minHeight: 50, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  applyText: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: "#FFFFFF" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 4, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E0E6EF", backgroundColor: "#FFFFFF" },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 12, fontSize: 13, lineHeight: 20, color: "#20304A" },
  clearSearch: { width: 38, height: 44, alignItems: "center", justifyContent: "center" },
  panel: { marginTop: 12, marginBottom: 16, padding: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D0DBEC", borderRadius: 18, shadowColor: "#263B64", shadowOpacity: 0.035, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 },
  selectorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  selector: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, paddingVertical: 3 },
  selectorLabel: { fontSize: 11, lineHeight: 16, fontWeight: "500", color: "#64748B", marginBottom: 3 },
  selectorValue: { fontSize: 15, lineHeight: 21, fontWeight: "600", color: "#20304A" },
  chevron: { width: 30, height: 30, borderRadius: 9, backgroundColor: "#EDF2FC", alignItems: "center", justifyContent: "center" },
  reset: { minHeight: 36, paddingHorizontal: 10, justifyContent: "center", borderRadius: 10, backgroundColor: "#F2F5FA" },
  resetText: { fontSize: 11, lineHeight: 17, fontWeight: "600", color: colors.primary },
  statuses: { flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E1E7F0", gap: 5 },
  status: { flex: 1, minWidth: 0, minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 7, borderRadius: 11, borderWidth: 1, borderColor: "transparent" },
  statusSelected: { backgroundColor: "#E9EFFC", borderColor: "#CEDAF3" },
  statusLabel: { fontSize: 12, lineHeight: 18, color: "#64748B", fontWeight: "500" },
  statusLabelSelected: { color: colors.primary, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(18,28,49,0.3)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  handle: { alignSelf: "center", width: 34, height: 4, borderRadius: 2, backgroundColor: "#D9E1ED", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sheetTitle: { fontSize: 18, lineHeight: 25, fontWeight: "700", color: "#20304A" },
  close: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: "#DEE5EF", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 12, lineHeight: 19, color: "#64748B", marginBottom: 16 },
  option: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 13, marginBottom: 8, borderWidth: 1, borderColor: "#E7ECF3" },
  optionSelected: { backgroundColor: "#EDF2FC", borderColor: "#CFDBF2" },
  optionLabel: { flex: 1, fontSize: 14, lineHeight: 21, color: "#52617A", fontWeight: "500" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#B9C4D5", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
