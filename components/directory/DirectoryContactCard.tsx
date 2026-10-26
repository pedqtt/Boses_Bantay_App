import { Text } from "@/components/AppText";
import { useEffect, useRef, useState } from "react";
import { View, Pressable, Linking, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@/components/AppIcon";
import * as Clipboard from "expo-clipboard";
import { colors } from "@/lib/theme";
export type DirectoryContact = { id: string; name: string; role: string; phone: string; urgent: boolean };
/** Presentation only: keep the original number for dialing and copying. */
export function displayDirectoryPhone(phone: string): string {
  const digits = phone.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  if (/^\+639\d{9}$/.test(digits)) return `+63 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  return phone;
}
function contactIcon(contact: DirectoryContact): keyof typeof Ionicons.glyphMap {
  const text = `${contact.name} ${contact.role}`.toLowerCase();
  if (/fire|bfp/.test(text)) return "flame-outline";
  if (/police|pnp/.test(text)) return "shield-checkmark-outline";
  if (/health|clinic|hospital|rhu|medical/.test(text)) return "medkit-outline";
  if (/tanod|patrol/.test(text)) return "walk-outline";
  if (/barangay hall|captain|kagawad/.test(text)) return "business-outline";
  return contact.urgent ? "alert-circle-outline" : "call-outline";
}
async function callContact(contact: DirectoryContact) {
  const phone = contact.phone.replace(/[^0-9+]/g, "");
  if (!phone) return;
  try { await Linking.openURL(`tel:${phone}`); }
  catch { Alert.alert("Hindi mabuksan ang tawag", "Maaari mong kopyahin ang numero at gamitin ang dialer ng telepono."); }
}
function useCopyNumber(phone: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    if (!phone.trim()) return;
    try {
      await Clipboard.setStringAsync(phone); setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch { Alert.alert("Hindi makopya", "Pakisubukan muli."); }
  }
  return { copied, copy };
}
export function PrimaryDirectoryHotline({ contact }: { contact: DirectoryContact }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Tumawag sa ${contact.name}, ${contact.phone}`}
    onPress={() => { void callContact(contact); }} className="active:opacity-85" style={styles.hotline}>
    <View style={styles.hotlineIdentity}>
      <Text style={styles.hotlineNumber}>{contact.phone}</Text>
      <View style={styles.hotlineDetails}>
        <Text style={styles.hotlineLabel}>EMERGENCY</Text>
        <Text style={styles.hotlineName}>{contact.name}</Text>
      </View>
    </View>
    <View pointerEvents="none" style={styles.hotlineAction}><Ionicons name="call" size={18} color={colors.error} /><Text style={styles.hotlineCallText}>Tawag</Text></View>
  </Pressable>;
}
export function DirectoryContactCard({ contact }: { contact: DirectoryContact }) {
  const { copied, copy } = useCopyNumber(contact.phone);
  const hasPhone = Boolean(contact.phone.replace(/[^0-9+]/g, ""));
  const accent = contact.urgent ? colors.error : colors.primary;
  return <View style={styles.card}>
    <View style={styles.contactBody}>
      <View style={styles.identity}>
        <View style={[styles.categoryBadge, { backgroundColor: contact.urgent ? colors.errorContainer : colors.residentTint }]}><Ionicons name={contactIcon(contact)} size={18} color={accent} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{contact.name}</Text>
          {contact.role ? <Text style={styles.role}>{contact.role}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Tumawag sa ${contact.name}, ${contact.phone}`} disabled={!hasPhone}
            onPress={() => { void callContact(contact); }} className="active:opacity-70" style={styles.numberTarget}>
            <Text style={[styles.phone, { color: accent }, !hasPhone && styles.noPhone]}>{hasPhone ? displayDirectoryPhone(contact.phone) : "Walang nakatalang numero"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
    <View style={styles.actions}>
      {hasPhone && <Pressable accessibilityRole="button" accessibilityLabel={copied ? "Nakopya na" : `Kopyahin ang numero ng ${contact.name}`}
        android_ripple={{ color: "#021F9410" }} onPress={() => { void copy(); }} className="active:opacity-70"
        style={[styles.copy, { backgroundColor: copied ? "#EBF7F0" : contact.urgent ? "#FFF3F4" : "#F0F3FC", borderColor: copied ? "#D6EBDE" : contact.urgent ? "#F5E0E3" : "#E1E7F6" }]}>
        <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? "#16703F" : accent} />
        <Text style={[styles.callText, { color: copied ? "#16703F" : accent }]}>Copy</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Tumawag sa ${contact.name}`} accessibilityState={{ disabled: !hasPhone }} disabled={!hasPhone}
        android_ripple={{ color: "#FFFFFF30" }} onPress={() => { void callContact(contact); }} className="active:opacity-75"
        style={[styles.call, { backgroundColor: hasPhone ? accent : "#E5E7EB" }]}>
        <Ionicons name="call" size={18} color={hasPhone ? "white" : colors.outline} />
        <Text style={[styles.callText, !hasPhone && { color: colors.outline }]}>Tawag</Text>
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "white", borderWidth: 1, borderColor: "#E1E6EF", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, minHeight: 80,
    shadowColor: "#182858", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6 },
  contactBody: { flex: 1, minWidth: 0 },
  categoryBadge: { width: 30, minHeight: 36, alignSelf: "stretch", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  numberTarget: { alignSelf: "stretch", minHeight: 32, justifyContent: "center", marginTop: 3, paddingVertical: 3 },
  identity: { flexDirection: "row", alignItems: "stretch", gap: 9 },
  name: { fontSize: 15, lineHeight: 21, fontWeight: "600", color: colors.onSurface },
  role: { fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant, marginTop: 1 },
  phone: { fontSize: 15, lineHeight: 22, fontWeight: "600", color: colors.primary, fontVariant: ["tabular-nums"], letterSpacing: 0.1 },
  noPhone: { fontSize: 12, lineHeight: 18, fontWeight: "400", color: colors.onSurfaceVariant },
  actions: { flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#E8ECF3", paddingLeft: 8, minHeight: 48 },
  call: { width: 44, minHeight: 46, paddingVertical: 6, borderRadius: 13, borderWidth: 1, borderColor: "#FFFFFF26", overflow: "hidden", alignItems: "center", justifyContent: "center", gap: 2 },
  callText: { color: "white", fontSize: 11, lineHeight: 15, fontWeight: "600" },
  copy: { width: 44, minHeight: 46, paddingVertical: 6, borderRadius: 13, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", gap: 2 },
  hotline: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.error, borderWidth: 1, borderColor: colors.error, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 14 },
  hotlineIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  hotlineDetails: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: "#FFFFFF35", paddingLeft: 12 },
  hotlineNumber: { color: "white", fontSize: 34, lineHeight: 42, letterSpacing: -0.8, fontWeight: "700", fontVariant: ["tabular-nums"] },
  hotlineLabel: { color: "#FFECEF", fontSize: 10, lineHeight: 15, letterSpacing: 0.7, fontWeight: "600" },
  hotlineName: { color: "white", fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 3 },
  hotlineAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 46, paddingHorizontal: 12, borderRadius: 13, backgroundColor: "white", flexShrink: 0 },
  hotlineCallText: { color: colors.error, fontSize: 13, lineHeight: 20, fontWeight: "600" },
});
