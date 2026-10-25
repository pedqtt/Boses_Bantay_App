import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, View, Text, Pressable, ScrollView, TextInput, Keyboard, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";
import { ReportsOverview } from "./ReportsOverview";
import { ReportStatusBadge } from "./ReportStatusBadge";

const STEPS = [
  { id: "overview", title: "Piliin ang status", body: "Pindutin ang Aktibo para makita ang mga bukas na report.", action: "Pindutin ang Aktibo sa itaas." },
  { id: "search", title: "Maghanap ng report", body: "I-type ang “ilaw” sa search box.", action: "I-type: ilaw" },
  { id: "scope", title: "Piliin ang mga report mo", body: "Pindutin ang Ginawa ko. Nakatalaga naman para sa mga concern na ibinigay sa iyo.", action: "Pindutin ang Ginawa ko." },
  { id: "card", title: "Buksan ang report", body: "Pindutin ang card para makita ang detalye. Ang badge ang kasalukuyang status.", action: "Pindutin ang unang report card." },
] as const;
type Target = "refresh" | "overview" | "search" | "scope" | "card" | "status";
const EXAMPLES = [
  { id: "DEMO-001", title: "Sirang ilaw", summary: "Halimbawa ng concern tungkol sa ilaw sa poste.", status: "Under Review", own: true, assigned: false },
  { id: "DEMO-002", title: "Basura sa paligid", summary: "Halimbawa ng concern na nakatalaga sa account.", status: "Investigating", own: false, assigned: true },
  { id: "DEMO-003", title: "Sirang kalsada", summary: "Halimbawa ng report na naresolba na.", status: "Resolved", own: true, assigned: false },
];
export function ReportsPageGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");
  const [scope, setScope] = useState<"all" | "created" | "assigned">("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [details, setDetails] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<Target>>(new Set());
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<Target, number>>>({});
  const active: { id: Target; title: string; body: string; action: string } = STEPS[step];
  useEffect(() => {
    if (!visible) return;
    setStep(0); setFilter("all"); setScope("all"); setSearch(""); setFeedback(""); setDetails(null); setCompleted(new Set());
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const key = active.id === "status" ? "card" : active.id;
    scroll.current?.scrollTo({ y: Math.max(0, (positions.current[key] ?? 0) - 12), animated: true });
  }, [step, visible, active.id]);
  function go(next: number) {
    Keyboard.dismiss(); setFeedback(""); setDetails(null);
    setSearch(""); setFilter("all"); setScope("all");
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
  }
  function done(target: Target, text: string) {
    setCompleted(previous => new Set([...previous, target])); setFeedback(text);
  }
  function close() { Keyboard.dismiss(); onClose(); }
  const results = EXAMPLES.filter(row => (filter === "all" || filter === "closed" && row.status === "Resolved" || filter === "active" && row.status !== "Resolved") &&
    (scope === "all" || scope === "created" && row.own || scope === "assigned" && row.assigned) &&
    (!search.trim() || `${row.id} ${row.title} ${row.summary}`.toLowerCase().includes(search.trim().toLowerCase())));
  return <Modal visible={visible} animationType="slide" onRequestClose={() => step ? go(step - 1) : close()}>
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.toolbar}>
          <View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.title}>Paano gamitin ang My Reports</Text><Text style={styles.demoCaption}>Pagsasanay lang · Walang ise-save</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Isara ang demo" onPress={close} style={styles.close}><Ionicons name="close" size={22} color={colors.onSurfaceVariant} /></Pressable>
        </View>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.demoContent}>
          <View onLayout={event => { positions.current.refresh = event.nativeEvent.layout.y; }}>
            <View style={styles.demoHeader}>
              <Text style={styles.pageTitle}>My Reports</Text>
              <DemoTarget active={active.id === "refresh"} style={{ borderRadius: 16 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Subukan ang refresh" onPress={() => done("refresh", "Na-refresh ang demo.")} style={styles.refresh}><Ionicons name="refresh-outline" size={20} color={colors.primary} /></Pressable>
              </DemoTarget>
            </View>
          </View>
          <View onLayout={event => { positions.current.overview = event.nativeEvent.layout.y; }}>
            <DemoTarget active={active.id === "overview"} style={{ marginBottom: 12 }}>
              <ReportsOverview total={3} active={2} closed={1} unavailable={false} partial={false} selected={filter} onSelect={value => { setFilter(value); done("overview", value === "closed" ? "Tapos na report lang ang ipinapakita." : value === "active" ? "Aktibong reports lang ang ipinapakita." : "Lahat ng demo reports ang ipinapakita."); }} />
            </DemoTarget>
          </View>
          <View onLayout={event => { positions.current.search = event.nativeEvent.layout.y; }}>
            <DemoTarget active={active.id === "search"} style={{ marginBottom: 8 }}>
              <View style={styles.search}><Ionicons name="search-outline" size={18} color={colors.onSurfaceVariant} /><TextInput accessibilityLabel="Demo search" value={search} placeholder="Subukang i-type: ilaw" placeholderTextColor={colors.outline} onChangeText={text => { setSearch(text); if (text.trim()) done("search", "Makikita sa ibaba ang tumugmang report."); }} style={styles.searchInput} autoCorrect={false} /><Pressable accessibilityRole="button" accessibilityLabel="Burahin ang demo search" onPress={() => setSearch("")} style={{ padding: 10 }}><Ionicons name="close-circle-outline" size={18} color={colors.onSurfaceVariant} /></Pressable></View>
            </DemoTarget>
          </View>
          <View onLayout={event => { positions.current.scope = event.nativeEvent.layout.y; }}>
            <DemoTarget active={active.id === "scope"} style={{ marginBottom: 16 }}>
              <View style={styles.scopes}>{[{ id: "all" as const, label: "Lahat" }, { id: "created" as const, label: "Ginawa ko" }, { id: "assigned" as const, label: "Nakatalaga" }].map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: scope === item.id }} onPress={() => { setScope(item.id); done("scope", item.id === "assigned" ? "Nakatalaga sa iyo lang ang makikita." : item.id === "created" ? "Mga report na ginawa mo lang ang makikita." : "Lahat ng iyong report ang makikita."); }} style={[styles.scope, scope === item.id && { backgroundColor: "#EDF1FC" }]}><Text style={{ fontSize: 12, lineHeight: 18, fontWeight: "600", color: scope === item.id ? colors.primary : colors.onSurfaceVariant }}>{item.label}</Text></Pressable>)}</View>
            </DemoTarget>
          </View>
          <View onLayout={event => { positions.current.card = event.nativeEvent.layout.y; }}>
            <Text style={styles.resultCount}>{results.length} halimbawang report</Text>
            {!results.length && <Text style={styles.empty}>Walang tumugma sa demo. Burahin ang search o piliin ang Lahat.</Text>}
            {results.map((row, index) => <DemoTarget key={row.id} active={active.id === "card" && index === 0} style={{ marginBottom: 12 }}>
              <View style={styles.report}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Buksan ang demo ${row.id}`} onPress={() => { setDetails(details === row.id ? null : row.id); done("card", "Nabuksan ang detalye. Ganito rin sa totoong report."); }} style={{ padding: 16 }}>
                  <View style={styles.reportTop}><Text style={styles.reportType}>Service complaint · DEMO</Text><Ionicons name="chevron-forward" size={16} color={colors.primary} /></View>
                  <Text style={styles.reportId}>{row.id}</Text><Text style={styles.reportTitle}>{row.title}</Text><Text style={styles.reportBody}>{row.summary}</Text>
                  <Text style={styles.relationship}>{row.own ? "Ginawa ko" : "Nakatalaga sa akin"}</Text>
                </Pressable>
                <View style={styles.statusRow}>
                  <DemoTarget active={active.id === "status" && index === 0} style={{ alignSelf: "flex-start", borderRadius: 12 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Ipaliwanag ang demo status ${row.status}`} onPress={() => done("status", row.status === "Under Review" ? "Under Review: nasa pagsusuri ang report." : row.status === "Resolved" ? "Resolved: naresolba na ang report." : "Investigating: iniimbestigahan o inaaksyunan ang report.")} style={{ padding: 6 }}><ReportStatusBadge status={row.status} soft /></Pressable>
                  </DemoTarget>
                </View>
                {details === row.id && <View style={styles.expanded}><Text style={styles.expandedTitle}>Detalye ng demo</Text><Text style={styles.reportBody}>Reference: {row.id}{"\n"}Lokasyon: Halimbawang lugar{"\n"}Halimbawa lamang ito.</Text></View>}
              </View>
            </DemoTarget>)}
          </View>
        </ScrollView>
        <View style={styles.coach}>
          <View style={styles.coachTop}><Text style={styles.stepNumber}>HAKBANG {step + 1} / {STEPS.length}</Text><Pressable accessibilityRole="button" onPress={close} style={{ padding: 8 }}><Text style={styles.skip}>Laktawan</Text></Pressable></View>
          <Text accessibilityRole="header" style={styles.coachTitle}>{active.title}</Text>
          <Text style={styles.coachBody}>{active.body}</Text>
          {completed.has(active.id) && feedback && <View style={styles.hint} accessibilityLiveRegion="polite"><Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} /><Text style={styles.hintText}>{feedback}</Text></View>}
          <View style={styles.navigation}>
            <Pressable accessibilityRole="button" disabled={step === 0} accessibilityLabel="Nakaraang hakbang" onPress={() => go(step - 1)} style={[styles.back, step === 0 && { opacity: 0.35 }]}><Text style={styles.backText}>Bumalik</Text></Pressable>
            <View style={styles.dots} accessible accessibilityLabel={`Hakbang ${step + 1} sa ${STEPS.length}`}>
              {STEPS.map((item, index) => <View key={item.id} style={styles.dotTouch}><View style={[styles.dot, { backgroundColor: index === step ? colors.primary : completed.has(item.id) ? "#9BAEE8" : "#DDE3EF" }]} /></View>)}
            </View>
            <Pressable accessibilityRole="button" onPress={() => step === STEPS.length - 1 ? close() : go(step + 1)} style={styles.next}><Text style={styles.nextText}>{step === STEPS.length - 1 ? "Tapos na" : "Susunod"}</Text><Ionicons name={step === STEPS.length - 1 ? "checkmark" : "arrow-forward"} size={16} color="white" /></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
function DemoTarget({ active, style, children }: { active: boolean; style?: import("react-native").StyleProp<import("react-native").ViewStyle>; children: ReactNode }) {
  return <View style={[{ borderWidth: 2, borderColor: active ? colors.primary : "transparent", borderRadius: 20, padding: 2, backgroundColor: active ? "#E8EEFF" : "transparent" }, style]}>{children}</View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8FC" },
  toolbar: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E4E8F0" },
  title: { fontSize: 16, lineHeight: 24, fontWeight: "600", color: colors.onSurface },
  demoCaption: { fontSize: 11, lineHeight: 17, color: colors.onSurfaceVariant, marginTop: 3 },
  close: { width: 44, height: 44, backgroundColor: "#F0F3FA", borderRadius: 14, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  demoContent: { padding: 14, paddingBottom: 22 },
  demoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 8, marginBottom: 12 },
  pageTitle: { fontSize: 22, lineHeight: 30, color: colors.onSurface, fontWeight: "600" },
  refresh: { width: 44, height: 44, backgroundColor: "#EDF1FC", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 15, paddingLeft: 12 },
  searchInput: { flex: 1, fontSize: 13, lineHeight: 20, paddingHorizontal: 10, paddingVertical: 14, color: colors.onSurface },
  scopes: { flexDirection: "row", padding: 5, backgroundColor: "white", borderRadius: 15, gap: 4 },
  scope: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingHorizontal: 3 },
  resultCount: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant, marginBottom: 10, paddingLeft: 5 },
  empty: { padding: 18, color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 21 },
  report: { backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: "#DFE5EF", overflow: "hidden" },
  reportTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reportType: { fontSize: 11, lineHeight: 17, color: colors.onSurfaceVariant },
  reportId: { fontSize: 11, lineHeight: 17, color: colors.onSurfaceFaint, marginTop: 3 },
  reportTitle: { fontSize: 16, lineHeight: 23, color: colors.onSurface, fontWeight: "600", marginTop: 10 },
  reportBody: { fontSize: 13, lineHeight: 21, color: colors.onSurfaceVariant, marginTop: 6 },
  relationship: { fontSize: 11, lineHeight: 17, color: colors.primary, marginTop: 10 },
  statusRow: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#F8FAFD", borderTopWidth: 1, borderTopColor: "#EDF0F5" },
  expanded: { padding: 16, backgroundColor: "#F0F4FE" },
  expandedTitle: { fontSize: 14, fontWeight: "600", lineHeight: 21, color: colors.primary },
  coach: { backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#DDE3EF", paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12 },
  coachTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepNumber: { fontSize: 10, lineHeight: 16, letterSpacing: 1, fontWeight: "700", color: colors.primary },
  skip: { fontSize: 12, color: colors.onSurfaceVariant },
  coachTitle: { fontSize: 17, lineHeight: 24, color: colors.onSurface, fontWeight: "600", marginBottom: 5 },
  coachBody: { fontSize: 14, lineHeight: 22, color: colors.onSurfaceVariant },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 10, backgroundColor: "#EDF2FF", padding: 10, borderRadius: 12 },
  hintText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.onPrimaryContainer },
  navigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 6, flexWrap: "wrap" },
  back: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
  backText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceVariant },
  dots: { flexDirection: "row" },
  dotTouch: { width: 18, minHeight: 44, justifyContent: "center", alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  next: { minHeight: 44, backgroundColor: colors.primary, borderRadius: 13, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  nextText: { color: "white", fontSize: 13, fontWeight: "600" },
});
