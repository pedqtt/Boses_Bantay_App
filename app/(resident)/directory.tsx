import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ScreenBackground } from "@/components/ScreenBackground";
import { DirectoryContactCard, PrimaryDirectoryHotline, type DirectoryContact } from "@/components/directory/DirectoryContactCard";
import { colors } from "@/lib/theme";

// Existing fixed hotline; published barangay contacts remain separate below.
const QC_HELPLINE: DirectoryContact = { id: "qc-helpline-122", name: "Quezon City Emergency Hotline", role: "", phone: "122", urgent: true };
type Filter = "all" | "emergency" | "services";
export default function DirectoryScreen() {
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const requestId = useRef(0);
  const fetchContacts = useCallback(async (silent = false) => {
    const request = ++requestId.current;
    if (!silent) setLoading(true); else setRefreshing(true);
    setLoadError(null);
    try {
      if (!isSupabaseConfigured || !supabase) throw Error("Hindi pa naka-configure ang directory. Pakikontak ang admin.");
      const { data, error } = await supabase.from("emergency_contacts").select("*").eq("is_active", true).order("contact_id", { ascending: true });
      if (error) throw error;
      if (request !== requestId.current) return;
      setContacts((data ?? []).map(contact => ({ id: String(contact.contact_id), name: String(contact.agency_name || contact.name || "Contact"),
        role: String(contact.contact_person || contact.role || ""), phone: String(contact.phone_number || contact.phone || ""),
        urgent: String(contact.category).toLowerCase() === "emergency" || contact.urgent === true })));
    } catch (error) {
      if (request !== requestId.current) return;
      console.warn("[directory] load failed", error);
      setLoadError("Hindi ma-update ang directory. Pakisuri ang internet at subukan muli.");
    } finally { if (request === requestId.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  useEffect(() => { void fetchContacts(); return () => { requestId.current++; }; }, [fetchContacts]);
  const categories: { id: Filter; label: string }[] = [
    { id: "all", label: "Lahat" }, { id: "emergency", label: "Emergency" }, { id: "services", label: "Serbisyo" },
  ];
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const digits = text.replace(/[^0-9+]/g, "");
    return contacts.filter(contact => (filter === "all" || filter === "emergency" && contact.urgent || filter === "services" && !contact.urgent) &&
      (!text || `${contact.name} ${contact.role} ${contact.phone}`.toLowerCase().includes(text) || Boolean(digits && /^[+0-9\s().-]+$/.test(text) && contact.phone.replace(/[^0-9+]/g, "").includes(digits))));
  }, [contacts, query, filter]);
  const urgent = filtered.filter(contact => contact.urgent);
  const routine = filtered.filter(contact => !contact.urgent);
  return <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: "#FAF8F7" }}>
    <ScreenBackground backgroundColor="#FAF8F7">
      <View className="bg-white px-5 pt-4 pb-3 border-b border-gray-200">
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text accessibilityRole="header" className="text-[24px] leading-8 font-semibold text-ink tracking-tight">Directory</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="I-refresh ang directory"
            accessibilityState={{ disabled: loading || refreshing, busy: loading || refreshing }}
            disabled={loading || refreshing} onPress={() => { void fetchContacts(true); }}
            className="bg-brand-50 rounded-[14px] items-center justify-center active:opacity-70"
            style={{ width: 44, height: 44, flexShrink: 0 }}>
            {loading || refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh-outline" size={20} color={colors.primary} />}
          </Pressable>
        </View>
        <View className="flex-row items-center rounded-xl pl-3 pr-1" style={{ backgroundColor: "#F3F5FA", minHeight: 46 }}>
          <Ionicons name="search-outline" size={18} color={colors.onSurfaceVariant} />
          <TextInput accessibilityLabel="Hanapin ang contact o serbisyo" value={query} onChangeText={setQuery} placeholder="Sino ang tatawagan?" placeholderTextColor={colors.outline} returnKeyType="search" autoCorrect={false} className="flex-1 text-[14px] text-ink px-3 py-3" />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Burahin ang paghahanap" onPress={() => setQuery("")} style={{ padding: 12 }}><Ionicons name="close-circle" size={18} color={colors.outline} /></Pressable> : null}
        </View>
        <View className="flex-row mt-2" style={{ gap: 6 }}>{categories.map(category => <Pressable key={category.id} accessibilityRole="button" accessibilityState={{ selected: filter === category.id }} onPress={() => setFilter(category.id)} className="flex-1 items-center justify-center rounded-lg active:opacity-70" style={{ minHeight: 40, backgroundColor: filter === category.id ? "#EDF1FC" : "white" }}><Text style={{ fontSize: 12, lineHeight: 18, fontWeight: filter === category.id ? "600" : "400", color: filter === category.id ? colors.primary : colors.onSurfaceVariant }}>{category.label}</Text></Pressable>)}</View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void fetchContacts(true); }} tintColor={colors.primary} />}>
        <PrimaryDirectoryHotline contact={QC_HELPLINE} />
        {loadError && <View className="bg-white border border-gray-200 rounded-2xl p-5 mb-5"><Text accessibilityRole="alert" className="text-[14px] leading-6 text-ink-soft">{loadError}</Text>{contacts.length > 0 && <Text className="text-[12px] text-ink-soft leading-5 mt-1">Ang huling na-load na contacts ang ipinapakita.</Text>}<Pressable accessibilityRole="button" onPress={() => { void fetchContacts(true); }} className="self-start bg-brand-50 rounded-xl px-4 py-3 mt-3"><Text className="text-brand font-semibold text-[13px]">Subukan muli</Text></Pressable></View>}
        {loading ? <View className="items-center py-9"><ActivityIndicator color={colors.primary} /><Text className="text-[13px] text-ink-soft mt-3">Kinukuha ang directory...</Text></View> : !filtered.length && !loadError ? <View className="bg-white border border-gray-200 rounded-[20px] p-7 items-center"><View className="bg-brand-50 rounded-2xl p-4"><Ionicons name={contacts.length ? "search-outline" : "call-outline"} size={28} color={colors.primary} /></View><Text className="text-[16px] font-semibold text-ink mt-4 text-center">{contacts.length ? "Walang tumugmang contact" : "Wala pang nakatalang contact"}</Text><Text className="text-[13px] leading-6 text-ink-soft text-center mt-2">{contacts.length ? "Subukan ang ibang keyword o ipakita lahat ng contact." : "Dito lalabas ang mga contact na inilathala ng barangay."}</Text>{contacts.length > 0 && <Pressable accessibilityRole="button" onPress={() => { setQuery(""); setFilter("all"); }} className="bg-brand-50 rounded-xl px-4 py-3 mt-4"><Text className="text-brand text-[13px] font-semibold">Ipakita lahat</Text></Pressable>}</View> : <View>
          {urgent.length > 0 && <ContactSection title="Emergency contacts" count={urgent.length} urgent>{urgent.map(contact => <DirectoryContactCard key={contact.id} contact={contact} />)}</ContactSection>}
          {routine.length > 0 && <ContactSection title="Barangay services" count={routine.length}>{routine.map(contact => <DirectoryContactCard key={contact.id} contact={contact} />)}</ContactSection>}
        </View>}
      </ScrollView>
    </ScreenBackground>
  </SafeAreaView>;
}
function ContactSection({ title, count, urgent = false, children }: { title: string; count: number; urgent?: boolean; children: import("react").ReactNode }) {
  const accent = urgent ? "#B42332" : colors.primary;
  const tint = urgent ? "#FFF0F1" : "#EDF1FC";
  return <View className="mb-5">
    <View className="flex-row items-center mb-2.5" style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ flex: 1, fontSize: 13, lineHeight: 20, fontWeight: "600", color: accent }}>{title}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: tint }}>
        <Text style={{ color: accent, fontSize: 12, lineHeight: 17, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{count}</Text>
        <Text style={{ color: accent, fontSize: 10, lineHeight: 17 }}>contact{count === 1 ? "" : "s"}</Text>
      </View>
    </View>
    <View style={{ gap: 8 }}>{children}</View>
  </View>;
}
