import { Text, TextInput } from "@/components/AppText";
import { ReportsPageGuide } from "@/components/reports/ReportsPageGuide";
import { ReportListCard } from "@/components/reports/ReportListCard";
import { ReportsOverview } from "@/components/reports/ReportsOverview";
import { useCallback, useRef, useState } from "react";
import { View, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { fetchAccountReports } from "@/lib/api/myReports";
import { isClosedReport, type AccountReport } from "@/lib/myReports";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors } from "@/lib/theme";
export type { ReportSummary } from "@/lib/sampleReports";

type Filter = "all" | "active" | "closed";
type Scope = "all" | "created" | "assigned";
export default function ReportsScreen() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<{ owner: string; reports: AccountReport[] }>({ owner: "", reports: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async (refresh = false) => {
    const request = ++generation.current;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(""); setPartial(false);
    try {
      if (!isSupabaseConfigured || !supabase) throw Error("Hindi pa naka-configure ang report service.");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || !profile?.id || user.id !== profile.id) throw Error("Mag-sign in po muli upang makita ang inyong reports.");
      const result = await fetchAccountReports(supabase, user.id);
      if (generation.current !== request) return;
      setRecords({ owner: user.id, reports: result.reports }); setPartial(result.warnings.length > 0);
    } catch (err) {
      if (generation.current !== request) return;
      setRecords({ owner: profile?.id ?? "", reports: [] });
      setError(err instanceof Error ? err.message : "Hindi ma-load ang mga report. Pakisubukan muli.");
    } finally { if (generation.current === request) { setLoading(false); setRefreshing(false); } }
  }, [profile?.id]);
  useFocusEffect(useCallback(() => { setFilter("all"); setScope("all"); setSearch(""); void load(); return () => { generation.current++; }; }, [load]));
  const reports = records.owner === profile?.id ? records.reports : [];
  const active = reports.filter(report => !isClosedReport(report.status)).length;
  const closed = reports.length - active;
  const assigned = reports.filter(report => report.assignedToMe).length;
  const scopes: { id: Scope; label: string; count: number }[] = [
    { id: "all", label: "Lahat", count: reports.length },
    { id: "created", label: "Ginawa ko", count: reports.filter(report => report.createdByMe).length },
    { id: "assigned", label: "Nakatalaga", count: assigned },
  ];
  const query = search.trim().toLowerCase();
  const visible = reports.filter(report =>
    (scope === "all" || scope === "created" && report.createdByMe || scope === "assigned" && report.assignedToMe) &&
    (filter === "all" || filter === "active" && !isClosedReport(report.status) || filter === "closed" && isClosedReport(report.status)) &&
    (!query || [report.referenceNo, report.category, report.summary, report.location, report.status].some(value => value.toLowerCase().includes(query))));
  return <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
    <ScreenBackground backgroundColor={colors.residentBackground}>
      <View style={{ backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="screenTitle" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36, fontWeight: "700", color: "#14244B", letterSpacing: -0.6 }}>My Reports</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Buksan ang gabay sa My Reports" accessibilityHint="Nagbubukas ng interactive demo na may naka-highlight na controls"
            onPress={() => setGuideOpen(true)} android_ripple={{ color: "#DCE4F5" }}
            style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 16, backgroundColor: "#F1F3F8", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <Ionicons name="help-circle-outline" size={23} color={colors.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="I-refresh ang reports"
            accessibilityState={{ disabled: loading || refreshing, busy: loading || refreshing }}
            disabled={loading || refreshing} onPress={() => { void load(true); }}
            android_ripple={{ color: "#DCE4F5" }}
            style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 16, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: loading || refreshing ? 0.65 : 1 }}>
            {loading || refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={20} color={colors.primary} />}
          </Pressable>
        </View>
      </View>
      <FlatList data={loading ? [] : visible} keyExtractor={report => `${report.source}:${report.id}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
        ListHeaderComponent={<View>
          <ReportsOverview total={reports.length} active={active} closed={closed} unavailable={loading || Boolean(error)} partial={partial} selected={filter} onSelect={setFilter} />
          <View className="bg-white rounded-[20px] mb-5" style={{ borderWidth: 1, borderColor: "#DFE5EF" }}>
            <View className="flex-row items-center px-4" style={{ minHeight: 54 }}>
              <Ionicons name="search-outline" size={19} color={colors.onSurfaceVariant} />
              <TextInput accessibilityLabel="Hanapin ang report" value={search} onChangeText={setSearch}
                placeholder="Hanapin ang reference, uri, lokasyon..." placeholderTextColor={colors.outline}
                className="flex-1 text-[13px] text-ink px-3 py-4" returnKeyType="search" autoCorrect={false} />
              {search ? <Pressable accessibilityRole="button" accessibilityLabel="Burahin ang paghahanap" onPress={() => setSearch("")} style={{ minWidth: 32, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close-circle" size={18} color={colors.outline} /></Pressable> : null}
            </View>
            <View style={{ height: 1, backgroundColor: "#EDF0F5", marginHorizontal: 16 }} />
            <View className="flex-row p-2" style={{ gap: 5 }}>
              {scopes.map(item => {
                const selected = scope === item.id;
                return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${item.label}, ${item.count} reports`}
                  onPress={() => setScope(item.id)} className="flex-1 rounded-xl items-center justify-center active:opacity-70"
                  style={{ minHeight: 44, paddingHorizontal: 4, paddingVertical: 9, backgroundColor: selected ? colors.residentSelected : "white" }}>
                  <Text style={{ color: selected ? colors.primary : colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, fontWeight: selected ? "600" : "500", textAlign: "center" }}>{item.label}{loading ? "" : ` (${item.count})`}</Text>
                </Pressable>;
              })}
            </View>
            {filter !== "all" && <View className="flex-row items-center justify-between px-4 pb-3 pt-1">
              <View className="flex-row items-center"><Ionicons name="filter-outline" size={13} color={colors.primary} style={{ marginRight: 6 }} /><Text className="text-[12px] text-brand">{filter === "active" ? "Aktibong reports" : "Mga tapos na report"}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Alisin ang status filter" onPress={() => setFilter("all")} className="flex-row items-center py-2 px-2"><Text className="text-[12px] text-ink-soft mr-1">Alisin</Text><Ionicons name="close" size={13} color={colors.onSurfaceVariant} /></Pressable>
            </View>}
          </View>
          {partial && <Text accessibilityRole="alert" className="text-[13px] leading-5 text-alert mb-4">May ilang report na hindi ma-load. Maaaring hindi kumpleto ang bilang. I-refresh upang subukang muli.</Text>}
          {!loading && !error && reports.length > 0 && <View className="flex-row items-center justify-between mt-1 mb-4 px-1">
            <Text className="text-[14px] font-semibold text-ink">Mga report <Text className="text-ink-soft font-normal">({visible.length})</Text></Text>
            <View className="flex-row items-center"><Ionicons name="swap-vertical-outline" size={13} color={colors.onSurfaceVariant} style={{ marginRight: 4 }} /><Text className="text-[11px] text-ink-soft">Pinakabago muna</Text></View>
          </View>}
        </View>}
        ListEmptyComponent={loading ? <View className="items-center py-10"><ActivityIndicator color={colors.primary} /><Text className="text-[13px] text-ink-soft mt-3">Kinukuha ang inyong reports...</Text></View> : <View className="bg-white border border-gray-200 rounded-[20px] px-6 py-9 items-center">
          <Ionicons name={error ? "cloud-offline-outline" : "documents-outline"} size={32} color={colors.primary} />
          <Text className="text-[17px] font-semibold text-ink text-center mt-4">{error ? "Hindi ma-load ang reports" : reports.length ? "Walang tumugmang report" : "Wala ka pang report"}</Text>
          <Text className="text-[14px] leading-6 text-ink-soft text-center mt-2">{error || (reports.length ? "Baguhin ang paghahanap o filter." : "Dito lalabas ang mga report na ginawa mo o nakatalaga sa iyo.")}</Text>
          <Pressable accessibilityRole="button" onPress={() => { if (error) void load(); else if (reports.length) { setSearch(""); setFilter("all"); setScope("all"); } else router.push("/(resident)/report"); }} className="bg-brand-50 rounded-xl px-5 py-3 mt-5 active:opacity-70"><Text className="text-brand font-semibold">{error ? "Subukan muli" : reports.length ? "Ipakita lahat" : "Gumawa ng report"}</Text></Pressable>
        </View>}
        renderItem={({ item }) => <ReportListCard report={item} />} />
    </ScreenBackground>
    <ReportsPageGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
  </SafeAreaView>;
}
