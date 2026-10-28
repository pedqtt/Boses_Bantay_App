import { FilterRadioGroup } from "@/components/FilterRadioGroup";
import { DateSortOptions } from "@/components/DateSortOptions";
import { sortByDate, type DateSortOrder } from "@/lib/list-sort";
import { SlideUpSheet } from "@/components/SlideUpSheet";
import { BackButton } from "@/components/BackButton";
import { useNavbarScroll } from "@/lib/navbar-scroll";
import { useTypography } from "@/lib/typography-context";
import { Text, TextInput } from "@/components/AppText";
import { homeStyles } from "@/components/home/homeStyles";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, SectionList, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@/components/AppIcon";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { reportDate, type AccountReport } from "@/lib/myReports";
import { colors, headerActionColors } from "@/lib/theme";
import { useAppPreferences } from "@/lib/app-preferences";
import { ReportStatusBadge, reportStatusColors } from "./ReportStatusBadge";

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

// UI preview only: these records are never written to Supabase or opened as real reports.
const SAMPLE_NOTIFICATIONS: AccountReport[] = [
  { id: "sample-1", referenceNo: "DEMO-001", category: "Natanggap ang inyong ulat", status: "Under Review", createdAt: "2026-10-26T08:00:00+08:00", updatedAt: null, hearingDate: null },
  { id: "sample-2", referenceNo: "DEMO-002", category: "May iskedyul ng hearing", status: "Under Review", createdAt: "2026-10-25T09:00:00+08:00", updatedAt: "2026-10-26T07:30:00+08:00", hearingDate: "2026-10-28T10:00:00+08:00" },
  { id: "sample-3", referenceNo: "DEMO-003", category: "Na-resolba ang service complaint", status: "Resolved", createdAt: "2026-10-24T09:00:00+08:00", updatedAt: "2026-10-25T16:00:00+08:00", hearingDate: null },
].map<AccountReport>(item => ({ ...item, source: "reports", summary: "Sample notification para sa design preview.", location: "", kind: item.id === "sample-3" ? "service_complaint" : "blotter", createdByMe: true, assignedToMe: false, photoCount: 0, hearingCompleted: false }));

const sampleRead = new Map<string, Record<string, string>>();
const sampleListeners = new Set<() => void>();

function alertPalette(level?: string) {
  if (level === "Emergency") return { accent: "#B4232E", tint: "#FFF0F1", icon: "#FCE0E3" };
  if (level === "Mataas na Alerto") return { accent: "#A85A0A", tint: "#FFF5E8", icon: "#FFE8C8" };
  if (level === "Normal na Pagpapayo") return { accent: "#267044", tint: "#EAF7EE", icon: "#D9F0E0" };
  return { accent: "#52617A", tint: "#F3F5F8", icon: "#E7EBF0" };
}
function alertLevelLabel(level?: string) {
  if (level === "Normal na Pagpapayo") return "Normal";
  if (level === "Mataas na Alerto") return "Mataas na Alerto";
  if (level === "Emergency") return "Emergency";
  return "Hindi nakatala";
}
function AlertLevelBadge({ level, unread = false }: { level?: string; unread?: boolean }) {
  const palette = alertPalette(level);
  return <View style={[s.alertLevelMini, { backgroundColor: unread ? "#FFFFFF" : palette.tint, borderColor: unread ? palette.accent : "transparent" }]}>
    <View style={[s.alertLevelDot, { backgroundColor: palette.accent }]} />
    <Text style={[s.alertLevelMiniText, { color: palette.accent }]}>{alertLevelLabel(level)}</Text>
  </View>;
}
function version(report: AccountReport) {
  return JSON.stringify([report.status, report.noticeMessage, report.noticeType, report.noticeTarget, report.noticeLevel, report.noticeSender, report.updatedAt || report.createdAt, report.hearingDate, report.hearingCompleted, report.assignedToMe]);
}
function alertTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Oras hindi nakatala" : date.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
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
export function ReportNotifications({ owner, reports, notices = [], loading: reportLoading, error: reportError, partial: reportPartial, refresh, refreshing: manualRefreshing = false, children, sample = false, page = false }: {
  page?: boolean; sample?: boolean; owner: string; reports: AccountReport[]; notices?: AccountReport[]; loading: boolean; error: string; partial: boolean; refresh: () => void | Promise<void>; refreshing?: boolean; children?: (parts: { bell: ReactNode; preview: ReactNode }) => ReactNode;
}) {
  const navbarScroll = useNavbarScroll();
  const { preferences } = useAppPreferences();
  const loading = sample ? false : reportLoading;
  const error = sample ? "" : reportError;
  const partial = sample ? false : reportPartial;
  const [seen, setSeen] = useState<{ owner: string; values: Record<string, string> }>({ owner: "", values: {} });
  const [storageError, setStorageError] = useState(false);
  const [marking, setMarking] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "announcements" | "blotter" | "service">("all");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<"all" | "announcements" | "blotter" | "service">("all");
  const [draftRead, setDraftRead] = useState<"all" | "unread" | "read">("all");
  const [sortOrder, setSortOrder] = useState<DateSortOrder>("newest");
  const [draftSort, setDraftSort] = useState<DateSortOrder>("newest");
  const [query, setQuery] = useState("");
  const [undo, setUndo] = useState<{ owner: string; previous: Record<string, string | undefined>; message: string } | null>(null);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), 6000); return () => clearTimeout(timer); }, [undo]);
  const [selection, setSelection] = useState<{ owner: string; report: AccountReport } | null>(null);
  const selectedItem = selection?.owner === owner ? selection.report : null;
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { scale: textScale } = useTypography();
  const badgeSize = Math.max(22, Math.ceil(18 * textScale * Math.max(1, fontScale)) + 4);
  const sheetY = useRef(new Animated.Value(windowHeight)).current;
  const panelHeight = useRef(0);
  const modalReady = useRef(false);
  const entering = useRef(false);
  const closing = useRef(false);
  const motionId = useRef(0);
  function enterDetails() {
    if (!modalReady.current || !panelHeight.current || entering.current || closing.current) return;
    entering.current = true;
    sheetY.setValue(panelHeight.current + 12);
    Animated.timing(sheetY, { toValue: 0, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }
  function closeDetails(afterClose?: () => void) {
    if (!selectedItem) { afterClose?.(); return; }
    if (closing.current) return;
    closing.current = true;
    const id = ++motionId.current;
    sheetY.stopAnimation();
    Animated.timing(sheetY, {
      toValue: (panelHeight.current || windowHeight) + 12,
      duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || motionId.current !== id) return;
      closing.current = false;
      setSelection(null);
      afterClose?.();
    });
  }
  useEffect(() => {
    ++motionId.current; sheetY.stopAnimation();
    setSelection(null); setQuery(""); setFilter("all"); setCategoryFilter("all"); setSortOrder("newest"); setCategoryPickerOpen(false); setUndo(null);
  }, [owner, sheetY]);
  useEffect(() => () => { ++motionId.current; sheetY.stopAnimation(); }, [sheetY]);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  // This is a list of current report updates, not a fabricated event history.
  const items = useMemo(() => [...(sample ? SAMPLE_NOTIFICATIONS : [...reports, ...notices])].sort((a, b) => (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0)).slice(0, 50), [reports, notices, sample]);
  useEffect(() => {
    let active = true;
    setSeen(previous => previous.owner === owner ? previous : { owner: "", values: {} });
    setStorageError(false); setMarking(false);
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
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
  const search = normalizeSearch(query);
  const terms = search.split(/\s+/).filter(Boolean);
  const matchesCategory = (item: AccountReport, category: typeof categoryFilter) => category === "all" || (category === "announcements" ? item.source === "notifications" : item.source !== "notifications" && item.kind === (category === "blotter" ? "blotter" : "service_complaint"));
  const searchedItems = items.filter(item => {
    const content = normalizeSearch([item.category, item.referenceNo, item.status, item.summary, item.noticeMessage, item.noticeSender, item.noticeType, item.noticeLevel, item.noticeTarget, item.source === "notifications" ? "abiso announcement" : item.kind === "blotter" ? "blotter" : "service complaint serbisyo"].filter(Boolean).join(" "));
    return terms.every(term => content.includes(term));
  });
  const matchesRead = (item: AccountReport) => filter === "all" || (filter === "unread" ? isUnread(item) : ready && !isUnread(item));
  const categoryItems = searchedItems.filter(item => matchesCategory(item, categoryFilter));
  const visibleItems = sortByDate(categoryItems.filter(matchesRead), item => item.updatedAt || item.createdAt, sortOrder);
  const categoryOptions = [
    { id: "all", label: "Lahat" },
    { id: "announcements", label: "Mga abiso" },
    { id: "blotter", label: "Blotter" },
    { id: "service", label: "Serbisyo" },
  ] as const;
  const hasFilters = filter !== "all" || categoryFilter !== "all" || sortOrder !== "newest" || Boolean(search);
  const clearFilters = () => { setFilter("all"); setCategoryFilter("all"); setQuery(""); setSortOrder("newest"); };
  const filtersActive = categoryFilter !== "all" || filter !== "all" || sortOrder !== "newest";
  const openFilters = () => { setDraftCategory(categoryFilter); setDraftRead(filter); setDraftSort(sortOrder); setCategoryPickerOpen(true); };
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
    ++motionId.current;
    sheetY.stopAnimation(); sheetY.setValue(windowHeight);
    panelHeight.current = 0; modalReady.current = false; entering.current = false; closing.current = false;
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
  const bell = <Pressable accessibilityRole="button" accessibilityLabel={`Notifications${preferences.notificationsEnabled && unread ? `, ${unread} hindi pa nababasa` : ""}`} onPress={() => router.push("/(resident)/notifications")} style={{ width: 48, height: 48, borderRadius: 16, borderWidth: 1, ...headerActionColors.primary, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="notifications-outline" size={23} color={colors.primary} />
      {preferences.notificationsEnabled && unread > 0 && <View style={[s.badge, { height: badgeSize, minWidth: badgeSize, borderRadius: badgeSize / 2 }]}><Text variant="caption" style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>}
    </Pressable>;
  const preview = <View style={s.previewSection}>
    <View style={s.previewHeading}><Text variant="section" accessibilityRole="header" style={s.previewTitle}>Notifications</Text><Pressable accessibilityRole="button" accessibilityLabel="Buksan lahat ng notifications" onPress={() => router.push("/(resident)/notifications")} style={homeStyles.link}><Text style={homeStyles.linkText}>Tingnan lahat</Text><Ionicons name="chevron-forward" size={14} color={colors.primary} /></Pressable></View>
    <View style={s.previewCard}>
      {loading ? <View style={s.previewMessage}><ActivityIndicator size="small" color={colors.primary} /><Text style={s.previewText}>Kinukuha ang updates…</Text></View>
        : error ? <Pressable accessibilityRole="button" onPress={refresh} style={s.previewMessage}><Ionicons name="refresh-outline" size={19} color={colors.primary} /><Text style={s.previewText}>Hindi ma-load ang notifications. I-tap para subukan muli.</Text></Pressable>
        : !items.length ? <View style={s.previewMessage}><Ionicons name="notifications-outline" size={20} color="#64748B" /><Text style={s.previewText}>{partial ? "Walang update mula sa mga report na na-load." : "Wala pang notifications."}</Text></View>
        : items.slice(0, 3).map((item, index) => <Pressable key={`${item.source}:${item.id}`} accessibilityRole="button" accessibilityLabel={`${isUnread(item) ? "Hindi pa nababasa. " : ""}${item.category}, ${item.status}`} onPress={() => { void markRead([item]); if (!sample && item.source !== "notifications") router.push({ pathname: "/(resident)/report-detail", params: { id: item.id, source: item.source } }); else router.push("/(resident)/notifications"); }} style={[s.previewRow, index > 0 && s.previewDivider]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {item.source === "notifications" ? <View style={s.alertColumns}>
              <View style={s.alertMain}>
                <Text numberOfLines={1} style={s.previewSender}>{item.noticeSender}</Text>
                <Text numberOfLines={2} style={s.previewRowTitle}>{item.category}</Text>
                <Text numberOfLines={1} style={s.previewText}>{item.noticeMessage}</Text>
              </View>
              <View style={s.alertTagColumn}><AlertLevelBadge level={item.noticeLevel} unread={isUnread(item)} /><Text style={s.alertTagTime}>{alertTime(item.createdAt)}</Text></View>
            </View> : <View style={s.alertColumns}>
              <View style={s.alertMain}>
                <Text numberOfLines={1} style={s.previewSender}>{item.kind === "blotter" ? "Blotter report" : "Service complaint"}</Text>
                <Text numberOfLines={2} style={s.previewRowTitle}>{item.category}</Text>
                <Text numberOfLines={1} style={s.previewText}>{item.referenceNo}{item.assignedToMe ? " · Nakatalaga sa iyo" : ""}</Text>
              </View>
              <View style={s.alertTagColumn}><ReportStatusBadge status={item.status} soft compact unread={isUnread(item)} /><Text style={s.alertTagTime}>{alertTime(item.updatedAt || item.createdAt)}</Text></View>
            </View>}
          </View>
          
        </Pressable>)}
      {partial && !loading && !error && items.length > 0 && <Text style={s.previewWarning}>Maaaring hindi kumpleto ang updates.</Text>}
    </View>
  </View>;
  if (page) return (
      <SafeAreaView edges={["top", "bottom"]} style={s.screen}>
        <View style={s.header}><BackButton showLabel={false} onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(resident)/home"); }} /><Text variant="screenTitle" accessibilityRole="header" style={s.title}>Notifications</Text></View>
        <View style={s.filterToolbar}>
          <View style={[s.searchBox, { flex: 1, marginHorizontal: 0, marginTop: 0 }]}><Ionicons name="search-outline" size={19} color="#64748B" /><TextInput accessibilityLabel="Hanapin ang notification" value={query} onChangeText={setQuery} placeholder="Hanapin ang notification" placeholderTextColor="#8793A6" autoCorrect={false} returnKeyType="search" style={s.searchInput} />{query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Burahin ang paghahanap" onPress={() => setQuery("")} style={s.clearSearch}><Ionicons name="close-circle" size={18} color="#8793A6" /></Pressable>}</View>
          <Pressable accessibilityRole="button" accessibilityLabel={filtersActive ? "Filters, may aktibong filter" : "Buksan ang filters"} accessibilityState={{ expanded: categoryPickerOpen }} onPress={openFilters} style={[s.filterOpenButton, filtersActive && s.filterOpenButtonActive]}><Ionicons name="options-outline" size={20} color={colors.primary} /><Text style={s.filterOpenText}>Filters</Text></Pressable>
        </View>
        <View style={s.filterSummary}><Text style={s.filterSummaryText}>{sortOrder === "newest" ? "Pinakabago" : "Pinakaluma"}</Text></View>
        <SlideUpSheet visible={categoryPickerOpen} title="Filters" onClose={() => setCategoryPickerOpen(false)} footer={close => <View style={s.filterActionRow}>
          <Pressable accessibilityRole="button" onPress={() => { setDraftCategory("all"); setDraftRead("all"); setDraftSort("newest"); }} style={s.filterResetButton}><Text style={s.clearFiltersText}>I-reset</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setCategoryFilter(draftCategory); setFilter(draftRead); setSortOrder(draftSort); close(); }} style={s.filterApplyButton}><Text style={s.filterApplyText}>I-apply ang filters</Text></Pressable>
        </View>}>
          <FilterRadioGroup title="Uri ng notification" value={draftCategory} options={categoryOptions.map(option => ({ ...option, label: option.id === "all" ? "Lahat ng uri" : option.label }))} onChange={setDraftCategory} />
          <FilterRadioGroup title="Katayuan" value={draftRead} options={[{ id: "all", label: "Lahat" }, { id: "unread", label: "Hindi nabasa" }, { id: "read", label: "Nabasa" }] as const} onChange={setDraftRead} separated />
          <DateSortOptions value={draftSort} onChange={setDraftSort} />
        </SlideUpSheet>
        {(partial || storageError) && <Text accessibilityRole="alert" style={s.notice}>{partial ? "May ilang report na hindi ma-load. " : ""}{storageError ? "Hindi na-save o ma-load ang read status sa device." : ""}</Text>}
        {error ? <View style={s.empty}><Ionicons name="cloud-offline-outline" size={32} color={colors.primary} /><Text style={s.emptyText}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh} style={s.mark}><Text style={s.markText}>Subukan muli</Text></Pressable></View>
          : loading ? <View style={s.empty}><ActivityIndicator color={colors.primary} /><Text style={s.emptyText}>Kinukuha ang updates…</Text></View>
          : <SectionList onScroll={navbarScroll.onScroll} onScrollBeginDrag={navbarScroll.onScrollBeginDrag} scrollEventThrottle={16} stickySectionHeadersEnabled={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" sections={sections} renderSectionHeader={({ section }) => <View style={s.dayHeading}><Text style={s.dayText}>{section.title}</Text><View style={s.dayRule} /></View>} keyExtractor={item => `${item.source}:${item.id}`} refreshing={manualRefreshing} onRefresh={sample ? undefined : refresh} contentContainerStyle={{ paddingTop: 8, paddingBottom: navbarScroll.bottomPadding, flexGrow: 1 }}
            ListEmptyComponent={<View style={s.empty}><Ionicons name="notifications-off-outline" size={34} color="#64748B" /><Text style={s.emptyTitle}>{hasFilters ? "Walang tumugmang notification" : "Wala pang notifications"}</Text><Text style={s.emptyText}>{hasFilters ? "Subukan ang ibang uri, read status, o salita sa paghahanap." : "Lalabas dito ang mga abiso at update sa inyong reports."}</Text>{hasFilters && <Pressable accessibilityRole="button" onPress={clearFilters} style={s.mark}><Text style={s.markText}>I-clear ang filters</Text></Pressable>}</View>}
            renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${isUnread(item) ? "Hindi pa nababasa. " : ""}${item.category}, ${item.source === "notifications" ? `${item.noticeLevel}, ${alertTime(item.createdAt)}` : `${item.status}, ${reportDate(item.updatedAt || item.createdAt)}`}`} android_ripple={{ color: "rgba(2,31,148,0.04)" }} onPress={() => { void openDetails(item); }} accessibilityHint="Buksan ang buong detalye ng notification" style={[s.inboxRow, isUnread(item) && s.inboxUnread, { borderLeftColor: item.source === "notifications" ? alertPalette(item.noticeLevel).accent : reportStatusColors(item.status).fg }, item.source === "notifications" && { backgroundColor: isUnread(item) ? alertPalette(item.noticeLevel).tint : "#FFFFFF" }]}>
              <View style={s.inboxContent}>
                {item.source === "notifications" ? <View style={s.alertColumns}>
                  <View style={s.alertMain}>
                    <Text numberOfLines={1} style={[s.inboxSender, s.alertSender]}>{item.noticeSender || "Barangay"}</Text>
                    <Text numberOfLines={2} style={[s.inboxSubject, isUnread(item) && s.inboxBold]}>{item.category}</Text>
                    <Text numberOfLines={2} style={s.inboxSnippet}>{item.noticeMessage}</Text>
                  </View>
                  <View style={s.alertTagColumn}><AlertLevelBadge level={item.noticeLevel} unread={isUnread(item)} /><Text style={s.alertTagTime}>{alertTime(item.createdAt)}</Text></View>
                </View> : <View style={s.alertColumns}>
                  <View style={s.alertMain}>
                    <Text numberOfLines={1} style={[s.inboxSender, s.alertSender]}>{item.kind === "blotter" ? "Blotter report" : "Service complaint"}</Text>
                    <Text numberOfLines={2} style={[s.inboxSubject, isUnread(item) && s.inboxBold]}>{item.category}</Text>
                    <Text numberOfLines={2} style={s.inboxSnippet}>{item.hearingDate && !item.hearingCompleted ? "Hearing: " + reportDate(item.hearingDate) : item.referenceNo}{item.assignedToMe ? " · Nakatalaga sa iyo" : ""}</Text>
                  </View>
                  <View style={s.alertTagColumn}><ReportStatusBadge status={item.status} soft compact unread={isUnread(item)} /><Text style={s.alertTagTime}>{alertTime(item.updatedAt || item.createdAt)}</Text></View>
                </View>}
              </View>
              
            </Pressable>} />}

        {undo?.owner === owner && <View accessibilityLiveRegion="polite" style={[s.undoBar, { marginBottom: navbarScroll.bottomPadding }]}><Text style={s.undoText}>{undo.message}</Text><Pressable accessibilityRole="button" accessibilityLabel="Ibalik ang dating read status" disabled={marking} onPress={() => { void undoReadChange(); }} style={s.undoButton}><Text style={s.undoButtonText}>Ibalik</Text></Pressable></View>}

        <Modal visible={Boolean(selectedItem)} transparent animationType="none" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onShow={() => { modalReady.current = true; enterDetails(); }} onRequestClose={() => closeDetails()}>
          <View style={s.sheetOverlay}>
            <StatusBar style="light" animated={false} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(18,28,49,0.3)" }]} />
            <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: "#17294B" }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Isara ang notification" onPress={() => closeDetails()} style={StyleSheet.absoluteFill} />
            <AnimatedSafeAreaView edges={["bottom"]} onLayout={event => { panelHeight.current = event.nativeEvent.layout.height; enterDetails(); }} style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
              <View style={s.sheetHeader}><Text accessibilityRole="header" style={s.sheetLabel}>Detalye ng notification</Text><Pressable accessibilityRole="button" accessibilityLabel="Isara" onPress={() => closeDetails()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", ...headerActionColors.secondary, borderWidth: 1, borderRadius: 14 }}><Ionicons name="close" size={22} color="#52617A" /></Pressable></View>
              {selectedItem && <><ScrollView style={s.detailScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetBody}>
                {selectedItem.source === "notifications" ? <>
                  <View style={[s.alertHero, { backgroundColor: alertPalette(selectedItem.noticeLevel).tint, borderTopColor: alertPalette(selectedItem.noticeLevel).accent }]}>
                    <View style={s.detailHeroRow}>
                      <View style={s.detailHeroMain}>
                        <Text style={s.alertHeroTitle}>{selectedItem.category}</Text>
                        <View style={s.senderBlock}><Text style={s.senderLabel}>NAGPADALA</Text><Text style={s.senderValue}>{selectedItem.noticeSender}</Text></View>
                      </View>
                      <View style={s.detailHeroMeta}>
                        <AlertLevelBadge level={selectedItem.noticeLevel} unread={isUnread(selectedItem)} />
                        <Text style={s.alertHeroDate}>{alertTime(selectedItem.createdAt)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.alertInfoCard}>
                    <View style={s.alertInfoRow}><Text style={s.alertInfoKey}>Uri ng abiso</Text><Text selectable style={s.alertInfoValue}>{selectedItem.noticeType}</Text></View>
                    <View style={[s.alertInfoRow, s.alertInfoRowLast]}><Text style={s.alertInfoKey}>Para sa</Text><Text selectable style={s.alertInfoValue}>{selectedItem.noticeTarget}</Text></View>
                  </View>
                  <View style={s.alertMessageCard}>
                    <Text style={s.alertSectionLabel}>MENSAHE</Text>
                    <Text selectable style={s.alertMessage}>{selectedItem.noticeMessage || selectedItem.summary}</Text>
                  </View>
                </> : <>
                  <View style={[s.alertHero, { backgroundColor: reportStatusColors(selectedItem.status).bg, borderTopColor: reportStatusColors(selectedItem.status).fg }]}>
                    <View style={s.detailHeroRow}>
                      <View style={s.detailHeroMain}>
                        <Text style={s.detailEyebrow}>{selectedItem.kind === "blotter" ? "Blotter report" : "Service complaint"}</Text>
                        <Text style={s.alertHeroTitle}>{selectedItem.category}</Text>
                        <Text selectable style={s.detailSender}>{selectedItem.referenceNo}</Text>
                      </View>
                      <View style={s.detailHeroMeta}>
                        <ReportStatusBadge status={selectedItem.status} soft compact unread={isUnread(selectedItem)} />
                        <Text style={s.alertHeroDate}>{alertTime(selectedItem.updatedAt || selectedItem.createdAt)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.alertInfoCard}>
                    <View style={[s.alertInfoRow, !selectedItem.hearingDate && !selectedItem.assignedToMe && s.alertInfoRowLast]}><Text style={s.alertInfoKey}>{selectedItem.updatedAt ? "Huling update" : "Isinumite"}</Text><Text style={s.alertInfoValue}>{reportDate(selectedItem.updatedAt || selectedItem.createdAt)}</Text></View>
                    {selectedItem.hearingDate && !selectedItem.hearingCompleted && <View style={[s.alertInfoRow, !selectedItem.assignedToMe && s.alertInfoRowLast]}><Text style={s.alertInfoKey}>Hearing</Text><Text style={s.alertInfoValue}>{reportDate(selectedItem.hearingDate)}</Text></View>}
                    {selectedItem.assignedToMe && <View style={[s.alertInfoRow, s.alertInfoRowLast]}><Text style={s.alertInfoKey}>Nakatalaga</Text><Text style={s.alertInfoValue}>Sa iyo</Text></View>}
                  </View>
                  {!sample && selectedItem.summary && <View style={s.alertMessageCard}><Text style={s.alertSectionLabel}>BUOD NG REPORT</Text><Text selectable style={s.alertMessage}>{selectedItem.summary}</Text></View>}
                </>}
              </ScrollView>
              <View style={s.sheetActions}>
                <Pressable accessibilityRole="button" disabled={!ready || marking} accessibilityState={{ disabled: !ready || marking }} onPress={() => { void changeReadState([selectedItem], !isUnread(selectedItem)); }} style={s.readAction}><Ionicons name={isUnread(selectedItem) ? "mail-open-outline" : "mail-unread-outline"} size={19} color={colors.primary} /><Text style={s.markText}>{marking ? "Ina-update…" : isUnread(selectedItem) ? "Markahang nabasa" : "Markahang hindi nabasa"}</Text></Pressable>
                {!sample && selectedItem.source !== "notifications" && <Pressable accessibilityRole="button" onPress={() => closeDetails(() => router.push({ pathname: "/(resident)/report-detail", params: { id: selectedItem.id, source: selectedItem.source } }))} style={s.openReport}><Text style={s.openReportText}>Buksan ang report</Text><Ionicons name="arrow-forward" size={18} color="white" /></Pressable>}
              </View></>}
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
  sheetOverlay: { flex: 1, justifyContent: "flex-end" }, sheet: { maxHeight: "82%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }, sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 20, paddingBottom: 12 }, sheetLabel: { fontSize: 13, lineHeight: 20, color: "#64748B", fontWeight: "500" }, sheetBody: { paddingHorizontal: 20, paddingBottom: 8 }, sheetTitle: { fontSize: 23, lineHeight: 31, fontWeight: "600", color: "#172033" }, sheetReference: { fontSize: 12, lineHeight: 20, color: "#64748B", marginTop: 8, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5EAF2" }, detailLabel: { fontSize: 11, lineHeight: 18, fontWeight: "500", color: "#64748B", marginTop: 18, marginBottom: 4 }, detailValue: { fontSize: 14, lineHeight: 22, color: "#374151" }, readAction: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.residentTint, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 12, flex: 1 }, openReport: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.primary, borderRadius: 14, padding: 12, flex: 1 }, openReportText: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: "#FFFFFF" },
  detailScroll: { flexShrink: 1 }, sheetActions: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E1E7EF", backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 14 },
  detailHeroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  detailHeroMain: { flex: 1, minWidth: 0 },
  detailHeroMeta: { alignItems: "flex-end", gap: 8, maxWidth: "44%" },
  senderBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(82,97,122,0.18)", gap: 3 }, senderLabel: { fontSize: 9, lineHeight: 14, letterSpacing: 0.7, fontWeight: "700", color: "#64748B" }, senderValue: { fontSize: 12, lineHeight: 19, fontWeight: "600", color: "#20304A" }, senderPrefix: { fontWeight: "400", color: "#52617A" },
  detailSender: { fontSize: 11, lineHeight: 17, color: "#52617A", marginTop: 7 },
  detailEyebrow: { fontSize: 11, lineHeight: 17, fontWeight: "500", color: "#52617A", marginBottom: 4 },
  alertHero: { borderTopWidth: 4, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, marginTop: 4 },
  alertHeroTitle: { fontSize: 20, lineHeight: 27, fontWeight: "700", color: "#172033" },
  alertHeroDate: { fontSize: 11, lineHeight: 16, color: "#52617A", textAlign: "right", fontVariant: ["tabular-nums"] },
  alertMessageCard: { paddingTop: 20, paddingBottom: 18, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DFE5EE" },
  alertSectionLabel: { fontSize: 10, lineHeight: 16, fontWeight: "700", letterSpacing: 0.7, color: "#52617A" },
  alertMessage: { fontSize: 15, lineHeight: 24, color: "#26344A", marginTop: 10 },
  alertInfoCard: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16, backgroundColor: "#F5F7FB", borderRadius: 12, padding: 16, marginTop: 14 },
  alertInfoRow: { width: "47%", alignItems: "flex-start", gap: 5 },
  alertInfoRowLast: { borderBottomWidth: 0 },
  alertInfoKey: { fontSize: 11, lineHeight: 16, color: "#64748B", fontWeight: "500" },
  alertInfoValue: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: "#26344A" },
  alertTagColumn: { alignItems: "flex-end", justifyContent: "space-between", alignSelf: "stretch", flexShrink: 0, gap: 12 }, alertTagTime: { fontSize: 11, lineHeight: 16, color: "#64748B", textAlign: "right", fontVariant: ["tabular-nums"] },
  alertColumns: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, alertMain: { flex: 1, minWidth: 0 }, alertSender: { flex: 0, marginBottom: 3 }, previewSender: { minWidth: 0, fontSize: 11, lineHeight: 16, fontWeight: "500", color: "#64748B", marginBottom: 3 },
  alertLevelMini: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1 }, alertLevelMiniText: { fontSize: 10, lineHeight: 15, fontWeight: "700" },
  alertLevel: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 }, alertLevelDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 }, alertLevelText: { fontSize: 13, lineHeight: 20, fontWeight: "700" },
  inboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 16, marginBottom: 6, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 16, borderBottomRightRadius: 16, overflow: "hidden", paddingLeft: 11, paddingRight: 14, paddingVertical: 12, borderLeftWidth: 3, borderLeftColor: "transparent", backgroundColor: "#FFFFFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E8ECF3" }, inboxUnread: { backgroundColor: "#E9EFFB", borderLeftColor: colors.primary }, inboxAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E8EEFA", alignItems: "center", justifyContent: "center", marginTop: 2 }, inboxResolved: { backgroundColor: "#EAF3ED" }, inboxAvatarUnread: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D4DFF3" }, inboxContent: { flex: 1, minWidth: 0 }, inboxTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 3 }, inboxSender: { flex: 1, fontSize: 11, lineHeight: 16, color: "#64748B", fontWeight: "500" }, inboxTime: { fontSize: 10, lineHeight: 16, color: "#64748B" }, inboxTimeUnread: { color: colors.primary, fontWeight: "600" }, inboxSubject: { fontSize: 15, lineHeight: 21, color: "#20304A", fontWeight: "600" }, inboxBold: { fontWeight: "700", color: "#14244B" }, inboxSnippet: { fontSize: 12, lineHeight: 18, color: "#64748B", marginTop: 4 }, inboxState: { width: 7, alignSelf: "center" },
  selectorChevron: { width: 30, height: 30, borderRadius: 9, backgroundColor: "#EDF2FC", alignItems: "center", justifyContent: "center" },
  statusCount: { minWidth: 20, minHeight: 20, paddingHorizontal: 4, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F4F8" },
  statusCountSelected: { backgroundColor: "#FFFFFF" },
  pickerHandle: { alignSelf: "center", width: 34, height: 4, borderRadius: 2, backgroundColor: "#D9E1ED", marginBottom: 14 },
  pickerCountBadge: { minWidth: 30, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F2F5FA", alignItems: "center" },
  pickerCountBadgeSelected: { backgroundColor: "#FFFFFF" },
  filterToolbar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginTop: 16 },
  filterOpenButton: { minHeight: 48, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#D0DBEC", borderRadius: 14, backgroundColor: "#FFFFFF" },
  filterOpenButtonActive: { backgroundColor: "#E9EFFC", borderColor: "#9FB7E5" },
  filterOpenText: { fontSize: 12, lineHeight: 18, color: colors.primary, fontWeight: "600" },
  filterGroupTitle: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: "#20304A" },
  filterGroupHint: { fontSize: 12, lineHeight: 19, color: "#64748B", marginTop: 3, marginBottom: 12 },
  filterReadGroup: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E1E7EF" },
  filterActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  filterResetButton: { minHeight: 50, minWidth: 90, paddingHorizontal: 18, borderWidth: 1, borderColor: "#D5DDE9", borderRadius: 12, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  filterApplyButton: { flex: 1, minWidth: 160, minHeight: 50, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  filterApplyText: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: "#FFFFFF" },
  filterTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  categorySelector: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, paddingVertical: 3 },
  selectorLabel: { fontSize: 11, lineHeight: 16, fontWeight: "500", color: "#64748B", marginBottom: 3 },
  selectorValue: { fontSize: 15, lineHeight: 21, fontWeight: "600", color: "#20304A" },
  filterReset: { minHeight: 36, paddingHorizontal: 10, justifyContent: "center", borderRadius: 10, backgroundColor: "#F2F5FA" },
  categoryOverlay: { flex: 1, backgroundColor: "rgba(18,28,49,0.3)", justifyContent: "flex-end" },
  categorySheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  categorySheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  categorySheetTitle: { fontSize: 18, lineHeight: 25, fontWeight: "700", color: "#20304A" },
  categorySheetHint: { fontSize: 12, lineHeight: 19, color: "#64748B", marginBottom: 16 },
  pickerClose: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: "#DEE5EF", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  pickerOption: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 13, marginBottom: 8, borderWidth: 1, borderColor: "#E7ECF3" },
  pickerOptionSelected: { backgroundColor: "#EDF2FC", borderColor: "#CFDBF2" },
  pickerLabel: { flex: 1, fontSize: 14, lineHeight: 21, color: "#52617A", fontWeight: "500" },
  pickerLabelSelected: { color: colors.primary, fontWeight: "600" },
  pickerCount: { fontSize: 12, lineHeight: 18, color: "#64748B", fontVariant: ["tabular-nums"] },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#B9C4D5", alignItems: "center", justifyContent: "center" },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  filterPanel: { marginHorizontal: 20, marginTop: 12, padding: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D0DBEC", borderRadius: 18, shadowColor: "#263B64", shadowOpacity: 0.035, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 },
  categoryFilters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  categoryChip: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DEE5EF" },
  categoryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: "#52617A" },
  categoryChipTextSelected: { color: "#FFFFFF" },
  categoryChipCount: { fontSize: 11, lineHeight: 17, color: "#718096", fontWeight: "600", fontVariant: ["tabular-nums"] },
  filters: { flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E1E7F0", gap: 5 },
  filter: { flex: 1, minWidth: 0, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 7, borderRadius: 11, borderWidth: 1, borderColor: "transparent", gap: 5 },
  filterSelected: { backgroundColor: "#E9EFFC", borderColor: "#CEDAF3" },
  filterLabel: { fontSize: 11, lineHeight: 17, color: "#64748B", fontWeight: "500", flexShrink: 1 },
  filterLabelSelected: { color: colors.primary, fontWeight: "700" },
  filterCountText: { fontSize: 10, lineHeight: 16, color: "#718096", fontWeight: "600", fontVariant: ["tabular-nums"] },
  filterCountTextSelected: { color: colors.primary },
  filterSummary: { minHeight: 36, marginHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  filterSummaryText: { fontSize: 11, lineHeight: 17, color: "#64748B" },
  clearFilters: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 36 },
  clearFiltersText: { fontSize: 11, lineHeight: 17, color: colors.primary, fontWeight: "600" },
  previewSection: { marginBottom: 28 }, previewHeading: homeStyles.sectionHeading, previewTitle: homeStyles.sectionTitle, previewCard: { ...homeStyles.card, paddingHorizontal: 16 }, previewRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }, previewDivider: homeStyles.divider, previewIcon: homeStyles.itemIcon, previewRowTitle: { ...homeStyles.itemTitle, fontSize: 15, lineHeight: 21, fontWeight: "600", color: "#20304A", marginBottom: 3 }, previewText: { fontSize: 12, lineHeight: 19, color: "#64748B", flexShrink: 1 }, previewDate: { ...homeStyles.metadata, marginTop: 4 }, previewMessage: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 }, previewWarning: { fontSize: 11, lineHeight: 18, color: "#92400E", paddingBottom: 12 },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: "#D92D43", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, badgeText: { color: "#FFFFFF", fontSize: 10, lineHeight: 14, fontWeight: "700", fontVariant: ["tabular-nums"], includeFontPadding: false },
  screen: { flex: 1, backgroundColor: colors.residentBackground }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 12, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, title: { fontSize: 26, lineHeight: 34, fontWeight: "700", color: "#14244B", letterSpacing: -0.5 }, toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 10, columnGap: 12, rowGap: 2 }, count: { fontSize: 12, color: "#64748B" }, mark: { flexDirection: "row", gap: 5, minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" }, markText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }, empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 12 }, emptyTitle: { fontSize: 17, fontWeight: "600", color: "#172033" }, emptyText: { fontSize: 13, lineHeight: 21, color: "#64748B", textAlign: "center" }, notice: { color: "#92400E", fontSize: 12, lineHeight: 19, paddingHorizontal: 20, paddingTop: 8 },
});
