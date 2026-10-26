import { useCallback, useRef, useState } from "react";
import { FONT_SIZE_OPTIONS, type FontSizePreference } from "@/lib/typography";
import { TypographyPreview, useTypography } from "@/lib/typography-context";
import { Text } from "@/components/AppText";
import { View, Pressable, ScrollView, Switch, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";
import { homeStyles } from "@/components/home/homeStyles";
import { DEFAULT_PREFERENCES, updateAppPreferences, useAppPreferences } from "@/lib/app-preferences";

export default function SettingsScreen() {
  const { preferences, loaded, error } = useAppPreferences();
  const text = useTypography();
  const scrollRef = useRef<ScrollView>(null);
  const [resetDone, setResetDone] = useState(false);
  const [draftSize, setDraftSize] = useState<FontSizePreference>(text.size);
  useFocusEffect(useCallback(() => { setDraftSize(text.size); }, [text.size]));
  const pendingSize = draftSize !== text.size;
  const currentSizeLabel = FONT_SIZE_OPTIONS.find(option => option.id === text.size)?.label;
  const previewSizeLabel = FONT_SIZE_OPTIONS.find(option => option.id === draftSize)?.label;
  const controlsDefault = preferences.showBot && preferences.fadeBotWhenIdle && preferences.notificationsEnabled;
  const allDefault = controlsDefault && text.size === "standard" && draftSize === "standard";
  function confirmReset() {
    Alert.alert("Ibalik sa default?", "I-o-on muli ang notifications, floating Bot, at idle fade. Para sa text size, pipiliin ang Karaniwan sa preview. Pindutin pa rin ang Apply para gamitin ito.", [
      { text: "Kanselahin", style: "cancel" },
      { text: "Ibalik", onPress: () => {
        updateAppPreferences(DEFAULT_PREFERENCES);
        setDraftSize("standard"); setResetDone(true);
        if (text.size !== "standard") scrollRef.current?.scrollTo({ y: 0, animated: true });
      } },
    ]);
  }
  return <SafeAreaView edges={["top"]} style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Bumalik" onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(resident)/profile"); }} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.primary} /></Pressable><Text variant="screenTitle" accessibilityRole="header" style={s.title}>Settings</Text></View>
    <ScrollView ref={scrollRef} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <View style={s.section}>
        <Text accessibilityRole="header" variant="section" style={s.sectionTitle}>Pagbabasa</Text>
        <View style={s.typeCard}>
          <View style={s.typeHeader}><View style={s.typeIcon}><Text variant="title" style={{ color: colors.primary, fontWeight: "600" }}>Aa</Text></View><View style={{ flex: 1, minWidth: 0 }}><Text variant="body" style={s.rowTitle}>Laki ng text</Text><Text variant="caption" style={s.currentSize}>Ginagamit ngayon: {currentSizeLabel}</Text></View></View>
          <Text variant="secondary" style={s.typeDescription}>Pumili, tingnan ang halimbawa, saka i-apply.</Text>
          <View accessibilityRole="radiogroup" style={s.sizeChoices}>{FONT_SIZE_OPTIONS.map(option => <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: draftSize === option.id, disabled: !text.loaded }} disabled={!text.loaded} onPress={() => setDraftSize(option.id)} style={[s.sizeChoice, draftSize === option.id && s.sizeChoiceSelected]}><Text variant="label" style={[s.sizeChoiceLabel, draftSize === option.id && { color: colors.primary }]}>{option.label}</Text><Ionicons name={draftSize === option.id ? "radio-button-on" : "radio-button-off"} size={19} color={draftSize === option.id ? colors.primary : "#64748B"} /></Pressable>)}</View>
          <View style={s.typePreview} testID="font-size-preview">
            <Text variant="caption" style={s.previewLabel}>Halimbawa · {previewSizeLabel}</Text>
            <TypographyPreview size={draftSize}><Text variant="section" style={{ fontWeight: "600", color: "#172033" }}>Mga update sa inyong report</Text><Text variant="body" style={{ color: "#374151", marginTop: 8 }}>Dito ninyo makikita ang mga update sa inyong report.</Text><Text variant="caption" style={{ color: "#64748B", marginTop: 10 }}>Piliin ang laki na komportable ninyong basahin.</Text></TypographyPreview>
          </View>
          <View style={s.applyFooter}>
            <Text variant="caption" accessibilityLiveRegion="polite" style={s.applyHint}>{pendingSize ? "Hindi pa naka-apply ang napiling laki." : "Ginagamit na ang laki na ito."}</Text>
            <View style={s.applyActions}>{pendingSize && <Pressable accessibilityRole="button" accessibilityLabel="Kanselahin ang napiling laki" onPress={() => setDraftSize(text.size)} style={s.cancelSize}><Text variant="label" style={{ color: "#52617A", fontWeight: "500" }}>Kanselahin</Text></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel="I-apply ang laki ng text" accessibilityState={{ disabled: !text.loaded || !pendingSize }} disabled={!text.loaded || !pendingSize} onPress={() => text.setSize(draftSize)} style={[s.applyButton, (!text.loaded || !pendingSize) && s.applyButtonDisabled]}><Ionicons name="checkmark-outline" size={20} color={pendingSize ? "#FFFFFF" : "#64748B"} /><Text variant="label" style={[s.applyButtonText, !pendingSize && { color: "#64748B" }]}>{pendingSize ? "Apply text size" : "Applied"}</Text></Pressable></View>
          </View>
        </View>
        <Text variant="caption" style={s.sectionNote}>Naka-save para sa account ninyo sa device na ito. Sinusunod din ang accessibility text size ng phone.</Text>
        {text.error ? <Text accessibilityRole="alert" style={s.error}>{text.error}</Text> : null}
      </View>

      <View style={s.section}>
        <Text accessibilityRole="header" variant="section" style={s.sectionTitle}>Notifications</Text>
        <View style={s.card}>
          <PreferenceRow icon="notifications-outline" title="Mga abiso sa app" description="Unread badge at notification preview sa Home." value={preferences.notificationsEnabled} disabled={!loaded} onChange={notificationsEnabled => updateAppPreferences({ notificationsEnabled })} />
          <View style={s.cardNote}><Text variant="caption" style={s.cardNoteText}>Mabubuksan pa rin ang inbox kapag naka-off. In-app notifications lamang ito.</Text></View>
        </View>
      </View>

      <View style={s.section}>
        <Text accessibilityRole="header" variant="section" style={s.sectionTitle}>Barangay Bot</Text>
        <View style={s.card}>
          <PreferenceRow icon="chatbubble-ellipses-outline" title="Floating chatbot" description="Ipakita ang Bot button na puwedeng ilipat." value={preferences.showBot} disabled={!loaded} onChange={showBot => updateAppPreferences({ showBot })} />
          <View style={s.divider} />
          <PreferenceRow icon="contrast-outline" title="Pahinain kapag idle" description="Bawasan ang opacity kapag hindi ginagamit." value={preferences.fadeBotWhenIdle} disabled={!loaded || !preferences.showBot} onChange={fadeBotWhenIdle => updateAppPreferences({ fadeBotWhenIdle })} />
          <View style={s.cardNote}><Text variant="caption" style={s.cardNoteText}>Available pa rin ang Bot sa Home kapag nakatago ang floating button.</Text></View>
        </View>
      </View>

      <View style={s.section}>
        <Text accessibilityRole="header" variant="section" style={s.sectionTitle}>Seguridad</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(resident)/change-password")} style={s.securityCard}><View style={homeStyles.itemIcon}><Ionicons name="lock-closed-outline" size={20} color={colors.primary} /></View><View style={{ flex: 1 }}><Text variant="body" style={s.rowTitle}>Change password</Text><Text variant="caption" style={s.description}>Palitan ang password ng inyong account.</Text></View><Ionicons name="chevron-forward" size={17} color="#64748B" /></Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {!loaded && <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} />}
      <View style={s.resetCard}>
        <View style={s.resetHeading}><View style={s.resetIcon}><Ionicons name="refresh-outline" size={21} color={colors.primary} /></View><Text variant="body" style={s.resetTitle}>Default na preferences</Text></View>
        <Text variant="secondary" style={s.resetDescription}>Ibalik ang orihinal na notifications at Barangay Bot controls.</Text>
        <View style={s.resetDetail}><Ionicons name="text-outline" size={16} color="#64748B" /><Text variant="caption" style={s.resetNote}>Karaniwan ang ihahanda sa text preview. Apply pa rin ang kailangan.</Text></View>
        {resetDone && controlsDefault && !error && <View accessibilityLiveRegion="polite" style={s.resetFeedback}><Ionicons name="checkmark-circle-outline" size={17} color="#397354" /><Text variant="caption" style={{ flex: 1, color: "#397354" }}>Naibalik na ang default na app controls.</Text></View>}
        <Pressable accessibilityRole="button" accessibilityLabel="Ibalik sa default ang preferences" accessibilityState={{ disabled: !loaded || !text.loaded || allDefault }} disabled={!loaded || !text.loaded || allDefault} onPress={confirmReset} style={[s.reset, allDefault && s.resetDisabled]}><Text variant="label" style={[s.resetText, allDefault && { color: "#64748B" }]}>{allDefault ? "Naka-default na" : "Ibalik sa default"}</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
function PreferenceRow({ icon, title, description, value, disabled, onChange }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <View style={[s.row, disabled && { opacity: 0.5 }]}><View style={homeStyles.itemIcon}><Ionicons name={icon} size={21} color={colors.primary} /></View><View style={{ flex: 1, minWidth: 0 }}><Text variant="body" style={s.rowTitle}>{title}</Text><Text variant="caption" style={s.description}>{description}</Text></View><Switch accessibilityLabel={title} accessibilityHint={description} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: "#DCE2ED", true: "#C5D2F6" }} thumbColor={value ? colors.primary : "#FFFFFF"} /></View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" }, header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, back: { ...homeStyles.headerButton, width: 44, height: 44, borderRadius: 14 }, title: { flex: 1, fontSize: 26, lineHeight: 34, fontWeight: "600", color: "#14244B" }, body: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 128, backgroundColor: colors.residentBackground },
  section: { marginBottom: 28 }, sectionTitle: { ...homeStyles.sectionTitle, marginBottom: 12, paddingHorizontal: 2 }, card: { ...homeStyles.card, paddingHorizontal: 16, overflow: "hidden" }, row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 18 }, rowTitle: { fontWeight: "600", color: "#172033" }, description: { color: "#64748B", marginTop: 4 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E3E8F0" }, cardNote: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E3E8F0", paddingVertical: 14 }, cardNoteText: { color: "#64748B" }, sectionNote: { color: "#64748B", marginTop: 12, paddingHorizontal: 2 },
  typeCard: { ...homeStyles.card, padding: 18 }, typeHeader: { flexDirection: "row", alignItems: "center", gap: 12 }, typeIcon: { width: 44, minHeight: 44, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.residentTint, alignItems: "center", justifyContent: "center" }, currentSize: { color: "#64748B", marginTop: 4 }, typeDescription: { color: "#52617A", marginTop: 16, marginBottom: 16 }, sizeChoices: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, sizeChoice: { flexGrow: 1, flexBasis: "45%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 52, borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 13, padding: 12 }, sizeChoiceSelected: { borderColor: colors.residentAccentOutline, backgroundColor: colors.residentSelected }, sizeChoiceLabel: { flexShrink: 1, color: "#52617A", fontWeight: "500" }, typePreview: { marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: "#F7F9FD", borderWidth: 1, borderColor: "#E6EBF3" }, previewLabel: { color: "#64748B", fontWeight: "500", marginBottom: 16 },
  applyFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E3E8F0", marginTop: 18, paddingTop: 14 }, applyHint: { color: "#64748B", marginBottom: 12 }, applyActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 8 }, applyButton: { flexGrow: 1, flexBasis: 150, minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, backgroundColor: colors.primary }, applyButtonDisabled: { backgroundColor: "#EDF0F5" }, applyButtonText: { color: "#FFFFFF", fontWeight: "600" }, cancelSize: { minHeight: 50, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  securityCard: { ...homeStyles.card, flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }, error: { color: "#9B3E27", fontSize: 12, lineHeight: 20, marginTop: 12 }, resetCard: { ...homeStyles.card, padding: 18 }, resetHeading: { flexDirection: "row", alignItems: "center", gap: 11 }, resetIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F0F3FA", alignItems: "center", justifyContent: "center" }, resetTitle: { flex: 1, fontWeight: "600", color: "#172033" }, resetDescription: { color: "#64748B", marginTop: 12 }, resetDetail: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 }, resetNote: { flex: 1, color: "#64748B" }, resetFeedback: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }, reset: { minHeight: 48, alignItems: "center", justifyContent: "center", padding: 13, marginTop: 18, borderRadius: 13, borderWidth: 1, borderColor: "#D4DEF1", backgroundColor: "#F5F7FC" }, resetDisabled: { backgroundColor: "#F7F8FB", borderColor: "#E7EBF2" }, resetText: { fontWeight: "600", color: colors.primary },
});
