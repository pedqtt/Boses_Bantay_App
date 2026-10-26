import { useTypography } from "@/lib/typography-context";
import { Text, TextInput } from "@/components/AppText";
import { homeStyles } from "@/components/home/homeStyles";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, SectionList, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@/components/AppIcon";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { reportDate, type AccountReport } from "@/lib/myReports";
import { colors } from "@/lib/theme";
import { useAppPreferences } from "@/lib/app-preferences";
import { ReportStatusBadge } from "./ReportStatusBadge";

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

// UI preview only: these records are never written to Supabase or opened as real reports.
const SAMPLE_NOTIFICATIONS: AccountReport[] = [
  { id: "sample-1", referenceNo: "DEMO-001", category: "Natanggap ang inyong ulat", status: "Under Review", createdAt: "2026-10-26T08:00:00+08:00", updatedAt: null, hearingDate: null },
  { id: "sample-2", referenceNo: "DEMO-002", category: "May iskedyul ng hearing", status: "Under Review", createdAt: "2026-10-25T09:00:00+08:00", updatedAt: "2026-10-26T07:30:00+08:00", hearingDate: "2026-10-28T10:00:00+08:00" },
  { id: "sample-3", referenceNo: "DEMO-003", category: "Na-resolba ang service complaint", status: "Resolved", createdAt: "2026-10-24T09:00:00+08:00", updatedAt: "2026-10-25T16:00:00+08:00", hearingDate: null },
].map<AccountReport>(item => ({ ...item, source: "reports", summary: "Sample notification para sa design preview.", location: "", kind: item.id === "sample-3" ? "service_complaint" : "blotter", createdByMe: true, assignedToMe: false, photoCount: 0, hearingCompleted: false }));

const sampleRead = new Map<string, Record<string, string>>();
const sampleListeners = new Set<() => void>();

function version(report: AccountReport) {
  return JSON.stringify([report.status, report.updatedAt || report.createdAt, report.hearingDate, report.hearingCompleted, report.assignedToMe]);
}
function inboxDate(report: AccountReport) {
  const date = new Date(report.updatedAt || report.createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
  return today.format(date) === today.format(new Date())
    ? date.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
}
function notificationDayLabel(report: AccountReport) {
  const date = new Date(report.updatedAt || report.createdAt);
  if (Number.isNaN(date.getTime())) return "Walang petsa";
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
  const key = format.format(date);
  if (key === format.format(new Date())) return "Ngayon";
  if (key === format.format(new Date(Date.now() - 86_400_000))) return "Kahapon";
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" });
}
function storageKey(owner: string, report: AccountReport) {
  return `report_notice.${owner}.${report.source}.${report.id}`.replace(/[^a-zA-Z0-9_.-]/g, "_");
}
export function ReportNotifications({ owner, reports, loading: reportLoading, error: reportError, partial: reportPartial, refresh, children, sample = false, page = false }: {
  page?: boolean; sample?: boolean; owner: string; reports: AccountReport[]; loading: boolean; error: string; partial: boolean; refresh: () => void; children?: (parts: { bell: ReactNode; preview: ReactNode }) => ReactNode;
}) {
  const { preferences } = useAppPreferences();
  const loading = sample ? false : reportLoading;
  const error = sample ? "" : reportError;
  const partial = sample ? false : reportPartial;
  const [seen, setSeen] = useState<{ owner: string; values: Record<string, string> }>({ owner: "", values: {} });
  const [storageError, setStorageError] = useState(false);
  const [marking, setMarking] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [query, setQuery] = useState("");
  const [undo, setUndo] = useState<{ owner: string; previous: Record<string, string | undefined>; message: string } | null>(null);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), 6000); return () => clearTimeout(timer); }, [undo]);
  const [selection, setSelection] = useState<{ owner: string; report: AccountReport } | null>(null);
  const selectedItem = selection?.owner === owner ? selection.report : null;
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const { scale: textScale } = useTypography();
  const badgeSize = Math.max(22, Math.ceil(18 * textScale * Math.max(1, fontScale)) + 4);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslation = useRef(new Animated.Value(windowHeight)).current;
  const panelHeight = useRef(0);
  const modalShown = useRef(false);
  const entranceStarted = useRef(false);
  const closing = useRef(false);
  function animateEntrance() {
    if (!modalShown.current || !panelHeight.current || entranceStarted.current) return;
    entranceStarted.current = true;
    sheetTranslation.setValue(panelHeight.current + 12);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(sheetTranslation, { toValue: 0, duration: 240, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
    ]).start();
  }
  function showDetails() {
    modalShown.current = true;
    animateEntrance();
  }
  function closeDetails(afterClose?: () => void) {
    if (!selectedItem) { afterClose?.(); return; }
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 150, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(sheetTranslation, { toValue: panelHeight.current + 12, duration: 180, easing: Easing.bezier(0.4, 0, 1, 1), useNativeDriver: true }),
    ]).start(({ finished }) => {
      closing.current = false;
      if (finished) { setSelection(null); afterClose?.(); }
    });
  }
  useEffect(() => () => { backdropOpacity.stopAnimation(); sheetTranslation.stopAnimation(); }, [backdropOpacity, sheetTranslation]);

  useEffect(() => { setSelection(null); setQuery(""); setFilter("all"); setUndo(null); }, [owner]);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  // This is a list of current report updates, not a fabricated event history.
  const items = useMemo(() => [...(sample ? SAMPLE_NOTIFICATIONS : reports)].sort((a, b) => (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0)).slice(0, 50), [reports, sample]);
  useEffect(() => {
    let active = true;
    setSeen({ owner: "", values: {} }); setStorageError(false); setMarking(false);
    if (sample) {
      const update = () => setSeen({ owner, values: sampleRead.get(owner) ?? {} });
      update(); sampleListeners.add(update);
      return () => { sampleListeners.delete(update); };
    }
    if (!owner) return;
    void Promise.all(items.map(async report => [storageKey(owner, report), await SecureStore.getItemAsync(storageKey(owner, report))] as const))
      .then(entries => { if (active) setSeen({ owner, values: Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry[1] !== null)) }); })
      .catch(() => { if (active) { setSeen({ owner, values: {} }); setStorageError(true); } });
    return () => { active = false; };
  }, [owner, items, sample]);
  const ready = seen.owner === owner;
  const isUnread = (report: AccountReport) => ready && seen.values[storageKey(owner, report)] !== version(report);
  const unread = items.filter(isUnread).length;
  const search = query.trim().toLocaleLowerCase();
  const visibleItems = items.filter(item => (filter !== "unread" || isUnread(item)) && (!search || [item.category, item.referenceNo, item.status, item.kind === "blotter" ? "blotter" : "service complaint"].some(value => value.toLocaleLowerCase().includes(search))));
  const sections: { title: string; data: AccountReport[] }[] = [];
  for (const item of visibleItems) {
    const title = notificationDayLabel(item);
    const last = sections[sections.length - 1];
    if (last?.title === title) last.data.push(item); else sections.push({ title, data: [item] });
  }
  async function markRead(targets: AccountReport[]) {
    if ((!owner && !sample) || !ready) return;
    const account = owner;
    const changes = Object.fromEntries(targets.map(report => [storageKey(account, report), version(report)]));
    setSeen(previous => previous.owner === account ? { owner: account, values: { ...previous.values, ...changes } } : previous);
    if (sample) {
      sampleRead.set(account, { ...(sampleRead.get(account) ?? {}), ...changes });
      sampleListeners.forEach(listener => listener());
      return;
    }
    try { await Promise.all(Object.entries(changes).map(([key, value]) => SecureStore.setItemAsync(key, value))); }
    catch { if (currentOwner.current === account) setStorageError(true); }
  }
  async function markUnread(item: AccountReport) {
    if ((!owner && !sample) || !ready) return;
    const account = owner, key = storageKey(account, item);
    setSeen(previous => {
      if (previous.owner !== account) return previous;
      const values = { ...previous.values }; delete values[key];
      return { owner: account, values };
    });
    if (sample) {
      const values = { ...(sampleRead.get(account) ?? {}) }; delete values[key];
      sampleRead.set(account, values); sampleListeners.forEach(listener => listener());
      return;
    }
    try { await SecureStore.deleteItemAsync(key); }
    catch { if (currentOwner.current === account) setStorageError(true); }
  }
  async function openDetails(item: AccountReport) {
    backdropOpacity.stopAnimation(); sheetTranslation.stopAnimation();
    closing.current = false; modalShown.current = false; entranceStarted.current = false; panelHeight.current = 0;
    backdropOpacity.setValue(0); sheetTranslation.setValue(windowHeight);
    setSelection({ owner, report: item });
    setMarking(true);
    try { await markRead([item]); } finally { setMarking(false); }
  }
  async function changeReadState(targets: AccountReport[], makeUnread: boolean) {
    if (!ready || marking || !targets.length) return;
    const account = owner;
    const previous = Object.fromEntries(targets.map(item => [storageKey(account, item), seen.values[storageKey(account, item)]]));
    setMarking(true);
    try {
      if (makeUnread) await Promise.all(targets.map(markUnread)); else await markRead(targets);
      if (currentOwner.current === account) {
        closeDetails();
        setUndo({ owner: account, previous, message: makeUnread ? "Minarkahang hindi pa nababasa" : targets.length > 1 ? "Minarkahang nabasa ang lahat" : "Minarkahang nabasa" });
      }
    } finally { setMarking(false); }
  }
  async function undoReadChange() {
    if (!undo || undo.owner !== owner || marking) return;
    const action = undo;
    setUndo(null); setMarking(true);
    const restore = (prior: Record<string, string>) => {
      const values = { ...prior };
      Object.entries(action.previous).forEach(([key, value]) => { if (value === undefined) delete values[key]; else values[key] = value; });
      return values;
    };
    setSeen(previous => previous.owner === action.owner ? { owner: action.owner, values: restore(previous.values) } : previous);
    try {
      if (sample) { sampleRead.set(action.owner, restore(sampleRead.get(action.owner) ?? {})); sampleListeners.forEach(listener => listener()); }
      else await Promise.all(Object.entries(action.previous).map(([key, value]) => value === undefined ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value)));
    } catch { if (currentOwner.current === action.owner) setStorageError(true); }
    finally { setMarking(false); }
  }
  const bell = <Pressable accessibilityRole="button" accessibilityLabel={`Notifications${preferences.notificationsEnabled && unread ? `, ${unread} hindi pa nababasa` : ""}`} onPress={() => router.push("/(resident)/notifications")} style={s.bell}>
      <Ionicons name="notifications-outline" size={24} color={colors.primary} />
      {preferences.notificationsEnabled && unread > 0 && <View style={[s.badge, { height: badgeSize, minWidth: badgeSize, borderRadius: badgeSize / 2 }]}><Text variant="caption" style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>}
    </Pressable>;
  const preview = <View style={s.previewSection}>
    <View style={s.previewHeading}><Text variant="section" accessibilityRole="header" style={s.previewTitle}>Notifications</Text><Pressable accessibilityRole="button" accessibilityLabel="Buksan lahat ng notifications" onPress={() => router.push("/(resident)/notifications")} style={homeStyles.link}><Text style={homeStyles.linkText}>Tingnan lahat</Text><Ionicons name="chevron-forward" size={14} color={colors.primary} /></Pressable></View>
    <View style={s.previewCard}>
      {loading ? <View style={s.previewMessage}><ActivityIndicator size="small" color={colors.primary} /><Text style={s.previewText}>Kinukuha ang updates…</Text></View>
        : error ? <Pressable accessibilityRole="button" onPress={refresh} style={s.previewMessage}><Ionicons name="refresh-outline" size={19} color={colors.primary} /><Text style={s.previewText}>Hindi ma-load ang notifications. I-tap para subukan muli.</Text></Pressable>
        : !items.length ? <View style={s.previewMessage}><Ionicons name="notifications-outline" size={20} color="#64748B" /><Text style={s.previewText}>{partial ? "Walang update mula sa mga report na na-load." : "Wala pang notifications."}</Text></View>
        : items.slice(0, 3).map((item, index) => <Pressable key={`${item.source}:${item.id}`} accessibilityRole="button" accessibilityLabel={`${isUnread(item) ? "Hindi pa nababasa. " : ""}${item.category}, ${item.status}`} onPress={() => { void markRead([item]); if (!sample) router.push({ pathname: "/(resident)/report-detail", params: { id: item.id, source: item.source } }); else router.push("/(resident)/notifications"); }} style={[s.previewRow, index > 0 && s.previewDivider]}>
          <View style={s.previewIcon}><Ionicons name={item.hearingDate && !item.hearingCompleted ? "calendar-outline" : "document-text-outline"} size={18} color={colors.primary} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={s.previewRowTitle}>{item.category}</Text><Text numberOfLines={2} style={s.previewText}>{item.status}{item.assignedToMe ? " · Nakatalaga sa iyo" : ""}</Text><Text style={s.previewDate}>{reportDate(item.updatedAt || item.createdAt)}</Text></View>
          {isUnread(item) ? <View style={s.dot} /> : <Ionicons name="chevron-forward" size={15} color="#94A3B8" />}
        </Pressable>)}
      {partial && !loading && !error && items.length > 0 && <Text style={s.previewWarning}>Maaaring hindi kumpleto ang updates.</Text>}
    </View>
  </View>;
  if (page) return (
      <SafeAreaView edges={["top", "bottom"]} style={s.screen}>
        <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Bumalik" onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(resident)/home"); }} style={s.close}><Ionicons name="chevron-back" size={23} color={colors.primary} /></Pressable><Text variant="screenTitle" accessibilityRole="header" style={s.title}>Notifications</Text></View>
        <View style={s.searchBox}><Ionicons name="search-outline" size={19} color="#64748B" /><TextInput accessibilityLabel="Hanapin ang notification" value={query} onChangeText={setQuery} placeholder="Hanapin ang title, reference o status" placeholderTextColor="#64748B" autoCorrect={false} returnKeyType="search" style={s.searchInput} />{query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Burahin ang paghahanap" onPress={() => setQuery("")} style={s.clearSearch}><Ionicons name="close-circle" size={18} color="#64748B" /></Pressable>}</View>
        <View style={s.toolbar}><Text style={s.count}>{loading || !ready ? "Kinukuha ang updates…" : `${unread} hindi pa nababasa`}</Text><Pressable accessibilityRole="button" disabled={!ready || !unread || marking} onPress={() => { void changeReadState(items.filter(isUnread), false); }} style={s.mark}><Text style={[s.markText, (!unread || marking) && { color: "#64748B" }]}>{marking ? "Ina-update…" : "Basahin lahat"}</Text><Ionicons name="checkmark-done-outline" size={17} color={!unread || marking ? "#64748B" : colors.primary} /></Pressable></View>
        <View style={s.filters}>
          {([{ id: "all", label: "Lahat", count: items.length }, { id: "unread", label: "Hindi pa nababasa", count: unread }] as const).map(option => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: filter === option.id }} onPress={() => setFilter(option.id)} style={[s.filter, filter === option.id && s.filterSelected]}><Text style={[s.filterLabel, filter === option.id && s.filterLabelSelected]}>{option.label}</Text><View style={[s.filterCount, filter === option.id && s.filterCountSelected]}><Text style={[s.filterCountText, filter === option.id && s.filterLabelSelected]}>{option.count}</Text></View></Pressable>)}
        </View>
        {(partial || storageError) && <Text accessibilityRole="alert" style={s.notice}>{partial ? "May ilang report na hindi ma-load. " : ""}{storageError ? "Hindi na-save o ma-load ang read status sa device." : ""}</Text>}
        {error ? <View style={s.empty}><Ionicons name="cloud-offline-outline" size={32} color={colors.primary} /><Text style={s.emptyText}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh} style={s.mark}><Text style={s.markText}>Subukan muli</Text></Pressable></View>
          : loading ? <View style={s.empty}><ActivityIndicator color={colors.primary} /><Text style={s.emptyText}>Kinukuha ang updates…</Text></View>
          : <SectionList stickySectionHeadersEnabled={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" sections={sections} renderSectionHeader={({ section }) => <View style={s.dayHeading}><Text style={s.dayText}>{section.title}</Text><View style={s.dayRule} /></View>} keyExtractor={item => `${item.source}:${item.id}`} refreshing={loading} onRefresh={sample ? undefined : refresh} contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, flexGrow: 1 }}
            ListEmptyComponent={<View style={s.empty}><Ionicons name="notifications-off-outline" size={34} color="#64748B" /><Text style={s.emptyTitle}>{search ? "Walang tumugmang notification" : filter === "unread" ? "Nabasa na ang lahat" : "Wala pang notifications"}</Text><Text style={s.emptyText}>{search ? "Subukan ang ibang title, reference o status." : filter === "unread" ? "Wala nang hindi nababasang update." : "Lalabas dito ang mga update sa inyong reports."}</Text>{search && <Pressable accessibilityRole="button" onPress={() => setQuery("")} style={s.mark}><Text style={s.markText}>Alisin ang paghahanap</Text></Pressable>}</View>}
            renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${isUnread(item) ? "Hindi pa nababasa. " : ""}${item.category}, ${item.status}, ${reportDate(item.updatedAt || item.createdAt)}`} android_ripple={{ color: "rgba(2,31,148,0.04)" }} onPress={() => { void openDetails(item); }} accessibilityHint="Buksan ang buong detalye ng notification" style={[s.inboxRow, isUnread(item) && s.inboxUnread]}>
              <View style={[s.inboxAvatar, item.status === "Resolved" && s.inboxResolved, isUnread(item) && s.inboxAvatarUnread]}><Ionicons name={item.status === "Resolved" ? "checkmark-outline" : item.hearingDate && !item.hearingCompleted ? "calendar-outline" : "document-text-outline"} size={21} color={item.status === "Resolved" ? "#397354" : colors.primary} /></View>
              <View style={s.inboxContent}>
                <View style={s.inboxTop}><Text numberOfLines={1} style={[s.inboxSender, isUnread(item) && s.inboxBold]}>{item.kind === "blotter" ? "Blotter report" : "Service complaint"}</Text><Text style={[s.inboxTime, isUnread(item) && s.inboxTimeUnread]}>{inboxDate(item)}</Text></View>
                <Text numberOfLines={2} style={[s.inboxSubject, isUnread(item) && s.inboxBold]}>{item.category}</Text>
                <Text numberOfLines={2} style={s.inboxSnippet}>{item.hearingDate && !item.hearingCompleted ? `Hearing: ${reportDate(item.hearingDate)}` : `${item.referenceNo} · ${item.status}`}</Text>
              </View>
              <View style={s.inboxState}>{isUnread(item) && <View style={s.dot} />}</View>
            </Pressable>} />}

        {undo?.owner === owner && <View accessibilityLiveRegion="polite" style={s.undoBar}><Text style={s.undoText}>{undo.message}</Text><Pressable accessibilityRole="button" accessibilityLabel="Ibalik ang dating read status" disabled={marking} onPress={() => { void undoReadChange(); }} style={s.undoButton}><Text style={s.undoButtonText}>Ibalik</Text></Pressable></View>}

        <Modal visible={Boolean(selectedItem)} transparent animationType="none" hardwareAccelerated onShow={showDetails} onRequestClose={() => closeDetails()}>
          <View style={s.sheetOverlay}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(18,28,49,0.3)", opacity: backdropOpacity }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Isara ang notification" onPress={() => closeDetails()} style={StyleSheet.absoluteFill} />
            <AnimatedSafeAreaView edges={["bottom"]} onLayout={event => { panelHeight.current = event.nativeEvent.layout.height; animateEntrance(); }} style={[s.sheet, { transform: [{ translateY: sheetTranslation }] }]}>
              <View style={s.sheetHeader}><Text accessibilityRole="header" style={s.sheetLabel}>Detalye ng notification</Text><Pressable accessibilityRole="button" accessibilityLabel="Isara" onPress={() => closeDetails()} style={s.close}><Ionicons name="close" size={22} color="#52617A" /></Pressable></View>
              {selectedItem && <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
                <Text style={s.sheetTitle}>{selectedItem.category}</Text>
                <Text selectable style={s.sheetReference}>{selectedItem.referenceNo} · {selectedItem.kind === "blotter" ? "Blotter report" : "Service complaint"}</Text>
                <View style={{ alignItems: "flex-start", marginTop: 16 }}><ReportStatusBadge status={selectedItem.status} soft /></View>
                <Text style={s.detailLabel}>{selectedItem.updatedAt ? "Huling update" : "Isinumite"}</Text><Text style={s.detailValue}>{reportDate(selectedItem.updatedAt || selectedItem.createdAt)}</Text>
                {selectedItem.hearingDate && !selectedItem.hearingCompleted && <><Text style={s.detailLabel}>Iskedyul ng hearing</Text><Text style={s.detailValue}>{reportDate(selectedItem.hearingDate)}</Text></>}
                {selectedItem.assignedToMe && <Text style={s.detailValue}>Nakatalaga sa iyo ang report na ito.</Text>}
                {!sample && selectedItem.summary && <><Text style={s.detailLabel}>Buod ng report</Text><Text style={s.detailValue}>{selectedItem.summary}</Text></>}
                <Pressable accessibilityRole="button" disabled={!ready || marking} accessibilityState={{ disabled: !ready || marking }} onPress={() => { void changeReadState([selectedItem], !isUnread(selectedItem)); }} style={s.readAction}><Ionicons name={isUnread(selectedItem) ? "mail-open-outline" : "mail-unread-outline"} size={19} color={colors.primary} /><Text style={s.markText}>{marking ? "Ina-update…" : isUnread(selectedItem) ? "Markahan bilang nabasa" : "Markahan bilang hindi pa nababasa"}</Text></Pressable>
                {!sample && <Pressable accessibilityRole="button" onPress={() => closeDetails(() => router.push({ pathname: "/(resident)/report-detail", params: { id: selectedItem.id, source: selectedItem.source } }))} style={s.openReport}><Text style={s.openReportText}>Buksan ang report</Text><Ionicons name="arrow-forward" size={18} color="white" /></Pressable>}
              </ScrollView>}
            </AnimatedSafeAreaView>
          </View>
        </Modal>

      </SafeAreaView>
  );
  return <>{children ? children({ bell, preview: preferences.notificationsEnabled ? preview : null }) : bell}</>;
}
const s = StyleSheet.create({
  dayHeading: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 19, paddingBottom: 11 }, dayText: { fontSize: 11, lineHeight: 18, fontWeight: "600", color: "#64748B" }, dayRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#E3E8F1" }, undoBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#23324D", margin: 16, marginTop: 8, paddingLeft: 16, paddingRight: 6, borderRadius: 15 }, undoText: { flex: 1, fontSize: 12, lineHeight: 19, color: "#FFFFFF" }, undoButton: { minHeight: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }, undoButtonText: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: "#CEDCFF" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginTop: 16, paddingLeft: 14, paddingRight: 4, borderRadius: 14, borderWidth: 1, borderColor: "#E0E6EF", backgroundColor: "white" }, searchInput: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 12, fontSize: 13, lineHeight: 20, color: "#172033" }, clearSearch: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" }, sheet: { maxHeight: "82%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }, sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 20, paddingBottom: 12 }, sheetLabel: { fontSize: 13, lineHeight: 20, color: "#64748B", fontWeight: "500" }, sheetBody: { paddingHorizontal: 24, paddingBottom: 28 }, sheetTitle: { fontSize: 23, lineHeight: 31, fontWeight: "600", color: "#172033" }, sheetReference: { fontSize: 12, lineHeight: 20, color: "#64748B", marginTop: 8, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5EAF2" }, detailLabel: { fontSize: 11, lineHeight: 18, fontWeight: "500", color: "#64748B", marginTop: 18, marginBottom: 4 }, detailValue: { fontSize: 14, lineHeight: 22, color: "#374151" }, readAction: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.residentTint, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, marginTop: 24 }, openReport: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.primary, borderRadius: 14, padding: 14, marginTop: 10 }, openReportText: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: "#FFFFFF" },
  inboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 13, marginHorizontal: 16, marginBottom: 8, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 16, borderBottomRightRadius: 16, overflow: "hidden", paddingLeft: 13, paddingRight: 16, paddingVertical: 18, borderLeftWidth: 3, borderLeftColor: "transparent", backgroundColor: "#FFFFFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E8ECF3" }, inboxUnread: { backgroundColor: "#D5E0F7", borderLeftColor: colors.primary }, inboxAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#E8EEFA", alignItems: "center", justifyContent: "center", marginTop: 2 }, inboxResolved: { backgroundColor: "#EAF3ED" }, inboxAvatarUnread: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D4DFF3" }, inboxContent: { flex: 1, minWidth: 0 }, inboxTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }, inboxSender: { flex: 1, fontSize: 12, lineHeight: 18, color: "#52617A", fontWeight: "500" }, inboxTime: { fontSize: 10, lineHeight: 16, color: "#64748B" }, inboxTimeUnread: { color: colors.primary, fontWeight: "600" }, inboxSubject: { fontSize: 14, lineHeight: 21, color: "#374151", fontWeight: "400" }, inboxBold: { fontWeight: "700", color: "#14244B" }, inboxSnippet: { fontSize: 12, lineHeight: 19, color: "#64748B", marginTop: 4 }, inboxState: { width: 7, alignSelf: "center" },
  filters: { flexDirection: "row", backgroundColor: "transparent", marginHorizontal: 20, padding: 0, borderRadius: 0, gap: 8, marginTop: 2 }, filter: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 44, gap: 8, paddingHorizontal: 14, borderRadius: 14 }, filterSelected: { backgroundColor: colors.residentSelected }, filterLabel: { flexShrink: 1, fontSize: 12, lineHeight: 18, color: "#64748B", fontWeight: "500" }, filterLabelSelected: { color: colors.primary, fontWeight: "600" }, filterCount: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: "#E2E7F0", alignItems: "center" }, filterCountSelected: { backgroundColor: colors.residentTint }, filterCountText: { fontSize: 10, lineHeight: 15, fontWeight: "600", color: "#64748B" }, previewSection: { marginBottom: 28 }, previewHeading: homeStyles.sectionHeading, previewTitle: homeStyles.sectionTitle, previewCard: { ...homeStyles.card, paddingHorizontal: 16 }, previewRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 }, previewDivider: homeStyles.divider, previewIcon: homeStyles.itemIcon, previewRowTitle: homeStyles.itemTitle, previewText: { fontSize: 12, lineHeight: 19, color: "#64748B", flexShrink: 1 }, previewDate: { ...homeStyles.metadata, marginTop: 4 }, previewMessage: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 }, previewWarning: { fontSize: 11, lineHeight: 18, color: "#92400E", paddingBottom: 12 },
  bell: { ...homeStyles.headerButton, position: "relative" }, badge: { position: "absolute", top: -4, right: -4, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: colors.error, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, badgeText: { color: "#FFFFFF", fontSize: 10, lineHeight: 14, fontWeight: "700", fontVariant: ["tabular-nums"], includeFontPadding: false },
  screen: { flex: 1, backgroundColor: colors.residentBackground }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 12, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, title: { fontSize: 26, lineHeight: 34, fontWeight: "700", color: "#14244B", letterSpacing: -0.5 }, close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F3FA", borderRadius: 14 }, toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 10 }, count: { fontSize: 12, color: "#64748B" }, mark: { flexDirection: "row", gap: 5, minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" }, markText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }, empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 12 }, emptyTitle: { fontSize: 17, fontWeight: "600", color: "#172033" }, emptyText: { fontSize: 13, lineHeight: 21, color: "#64748B", textAlign: "center" }, notice: { color: "#92400E", fontSize: 12, lineHeight: 19, paddingHorizontal: 20, paddingTop: 8 },
});
