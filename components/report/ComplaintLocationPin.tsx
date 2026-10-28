import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Linking, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Text } from "@/components/AppText";
import { Ionicons } from "@/components/AppIcon";
import { BackButton } from "@/components/BackButton";
import { colors } from "@/lib/theme";
import { isWithinMilagrosa } from "@/lib/service-area";
import { nearestStreetAddress, pinCoordinates, pinMapUrl, type LocationPin } from "@/lib/map-location";
import { OsmPickerMap } from "./OsmPickerMap";

export function PinnedLocationLink({ pin }: { pin: LocationPin }) {
  return <Pressable accessibilityRole="link" accessibilityLabel="Tingnan ang napiling lokasyon sa OpenStreetMap" onPress={() => { void Linking.openURL(pinMapUrl(pin)).catch(() => Alert.alert("Hindi mabuksan ang mapa", "Pakisubukan muli.")); }} style={s.savedPin}>
    <Ionicons name="location-outline" size={18} color={colors.primary} /><View style={{ flex: 1, minWidth: 0 }}><Text style={s.pinTitle}>Naka-pin sa mapa</Text>{pin.address && <Text style={s.help}>{pin.address}</Text>}<Text style={s.coordinates}>{pinCoordinates(pin)}</Text></View><Ionicons name="open-outline" size={17} color={colors.primary} />
  </Pressable>;
}
export function ComplaintLocationPin({ value, onChange }: { value: LocationPin | null; onChange: (pin: LocationPin | null) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={s.field}>
    <Pressable accessibilityRole="button" accessibilityLabel={value ? "Baguhin ang pin sa OpenStreetMap" : "Pumili ng lokasyon sa OpenStreetMap"} onPress={() => { Keyboard.dismiss(); setOpen(true); }} style={s.choose}>
      <Ionicons name="map-outline" size={21} color={colors.primary} /><View style={{ flex: 1, minWidth: 0 }}><Text style={s.pinTitle}>{value ? "Baguhin ang pin sa mapa" : "Piliin sa mapa"}</Text><Text style={s.help}>{value ? (value.address ?? pinCoordinates(value)) : "Opsyonal · Barangay Milagrosa"}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.primary} />
    </Pressable>
    {value && !isWithinMilagrosa(value) && <Text accessibilityRole="alert" style={s.boundaryWarning}>Ang pin ay nasa labas ng Barangay Milagrosa. Baguhin po ito.</Text>}
    {value && <Pressable accessibilityRole="button" accessibilityLabel="Alisin ang pin sa mapa" onPress={() => onChange(null)} style={s.remove}><Text style={s.removeText}>Alisin ang pin</Text></Pressable>}
    {open && <Picker initialPin={value} onCancel={() => setOpen(false)} onConfirm={pin => { onChange(pin); setOpen(false); }} />}
  </View>;
}
function Picker({ initialPin, onCancel, onConfirm }: { initialPin: LocationPin | null; onCancel: () => void; onConfirm: (pin: LocationPin) => void }) {
  const [pin, setPin] = useState<LocationPin | null>(() => isWithinMilagrosa(initialPin) ? initialPin : null);
  const [focusPin, setFocusPin] = useState<LocationPin | null>(null);
  const [locating, setLocating] = useState(false);
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current++; }, []);
  const useCurrentLocation = async () => {
    if (locating) return;
    const request = ++locationRequest.current;
    setLocating(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { Alert.alert("Kailangan ng pahintulot", "Payagan ang Location sa settings o i-tap na lang ang lugar sa mapa."); return; }
      if (!await Location.hasServicesEnabledAsync()) { Alert.alert("Naka-off ang Location", "I-on ang Location/GPS ng inyong phone o manu-manong pumili sa mapa."); return; }
      const current = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Location timeout")), 15000); }),
      ]);
      if (request !== locationRequest.current) return;
      const point = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      if (!isWithinMilagrosa(point)) { Alert.alert("Nasa labas ng Barangay Milagrosa", "Hindi binago ang pin. Piliin ang mismong lugar ng problema sa loob ng asul na hangganan."); return; }
      const selected = { ...point, address: nearestStreetAddress(point) };
      setPin(selected); setFocusPin(selected); setBoundaryWarning(false);
      if (current.coords.accuracy && current.coords.accuracy > 80) Alert.alert("Tinatayang lokasyon", "Hindi pa eksakto ang GPS. I-drag ang pin sa tamang lugar at kumpirmahin ang address.");
      try {
        const results = await Location.reverseGeocodeAsync(point);
        if (request !== locationRequest.current) return;
        const a = results[0];
        if (a) {
          const parts = [[a.streetNumber, a.street].filter(Boolean).join(" "), a.district, a.city, a.region, a.postalCode].filter((v): v is string => Boolean(v));
          const address = [...new Set(parts)].join(", ");
          if (address) setPin(previous => previous?.latitude === point.latitude && previous.longitude === point.longitude ? { ...previous, address } : previous);
        }
      } catch { /* Keep the offline street label and exact coordinates. */ }
    } catch { if (request === locationRequest.current) Alert.alert("Hindi makuha ang lokasyon", "Pakisubukan muli sa lugar na may GPS signal, o i-tap ang lokasyon sa mapa."); }
    finally { if (timer) clearTimeout(timer); if (request === locationRequest.current) setLocating(false); }
  };
  const [boundaryWarning, setBoundaryWarning] = useState(false);
  const validPin = pin && isWithinMilagrosa(pin);
  const selectPin = useCallback((value: LocationPin) => { locationRequest.current++; setLocating(false); if (isWithinMilagrosa(value)) { setPin({ ...value, address: nearestStreetAddress(value) }); setBoundaryWarning(false); } }, []);
  const outside = useCallback(() => setBoundaryWarning(true), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const markReady = useCallback(() => { setReady(true); setError(false); }, []);
  const markError = useCallback(() => setError(true), []);
  useEffect(() => {
    if (ready || error) return;
    const timer = setTimeout(() => setError(true), 18000);
    return () => clearTimeout(timer);
  }, [attempt, ready, error]);
  return <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onCancel}>
    <SafeAreaProvider style={s.screen}>
    <SafeAreaView style={s.screen} edges={["top", "right", "bottom", "left"]}>
      <StatusBar style="dark" animated={false} />
      <View style={s.header}><BackButton onPress={onCancel} showLabel={false} /><Text style={s.title}>Piliin ang lokasyon</Text></View>
      <Text style={s.instruction}>Barangay Milagrosa, Quezon City · I-tap ang lugar sa loob ng asul na hangganan. Maaari ring i-drag ang pin.</Text>
      <View style={s.map}>
        <OsmPickerMap key={attempt} initialPin={initialPin} focusPin={focusPin} onPin={selectPin} onReady={markReady} onError={markError} onOutside={outside} />
        {boundaryWarning && !error && <View pointerEvents="none" style={s.mapNotice}><Text accessibilityRole="alert" style={s.mapNoticeText}>Sa loob lamang ng Barangay Milagrosa maaaring maglagay ng pin. Pumili po ng ibang lugar.</Text></View>}
        {!ready && !error && <View pointerEvents="none" style={s.mapLoading}><ActivityIndicator color={colors.primary} /><Text style={s.help}>Binubuksan ang mapa…</Text></View>}
        {error && <View style={s.mapError}><Text accessibilityRole="alert" style={s.errorText}>Hindi ma-load ang mapa. Tingnan ang internet connection o gamitin muna ang text na lokasyon.</Text><Pressable accessibilityRole="button" onPress={() => { setPin(isWithinMilagrosa(initialPin) ? initialPin : null); setBoundaryWarning(false); setReady(false); setError(false); setAttempt(value => value + 1); }} style={s.retry}><Text style={s.pinTitle}>Subukan muli</Text></Pressable></View>}
      </View>
      <View style={s.footer}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: locating || !ready || error, busy: locating }} disabled={locating || !ready || error} onPress={() => { void useCurrentLocation(); }} style={s.currentLocation}>
          {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate-outline" size={20} color={colors.primary} />}
          <Text style={s.pinTitle}>{locating ? "Kinukuha ang lokasyon�" : "Gamitin ang kasalukuyang lokasyon"}</Text>
        </Pressable>
        
        <Text style={s.pinTitle}>{pin ? "Napiling lokasyon" : "Wala pang napiling pin"}</Text>
        {pin && <TextInput accessibilityLabel="Address o palatandaan ng napiling pin" value={pin.address ?? ""} onChangeText={address => { locationRequest.current++; setLocating(false); setPin(previous => previous ? { ...previous, address } : previous); }} placeholder="House/building no., kalye, purok o landmark" multiline maxLength={300} style={s.addressInput} />}
        {pin && <Text style={s.help}>Kumpirmahin ang address; maaaring tinatayang lokasyon lamang.</Text>}
        <Text accessibilityLiveRegion="polite" style={s.help}>{pin ? pinCoordinates(pin) : "I-tap muna ang lugar bago kumpirmahin."}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !validPin || !ready || error }} disabled={!validPin || !ready || error} onPress={() => { if (pin && validPin) onConfirm(pin); }} style={[s.confirm, (!validPin || !ready || error) && s.disabled]}><Text style={s.confirmText}>Gamitin ang lokasyong ito</Text></Pressable>
      </View>
    </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}
const s = StyleSheet.create({
  currentLocation: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12, marginBottom: 12, backgroundColor: "#F2F5FC", borderRadius: 12 },
  addressInput: { fontSize: 14, lineHeight: 21, color: "#20304A", padding: 10, marginTop: 6, borderWidth: 1, borderColor: "#CFDAEF", borderRadius: 10, maxHeight: 88 },
  boundaryWarning: { fontSize: 12, lineHeight: 19, color: "#9A4F0A", marginVertical: 8 },
  field: { marginTop: -4, marginBottom: 22 },
  choose: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#CFDAEF", backgroundColor: "#F2F5FC" },
  pinTitle: { fontSize: 13, lineHeight: 20, fontWeight: "600", color: colors.primary },
  help: { fontSize: 12, lineHeight: 19, color: "#64748B", marginTop: 3 },
  coordinates: { fontSize: 11, lineHeight: 18, color: "#64748B", fontVariant: ["tabular-nums"] },
  remove: { minHeight: 40, alignSelf: "flex-end", justifyContent: "center", paddingHorizontal: 8 },
  removeText: { fontSize: 12, lineHeight: 18, color: "#64748B" },
  savedPin: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#F2F5FC", borderRadius: 12, marginTop: 12 },
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E1E7EF" },
  title: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: "700", color: "#20304A" },
  instruction: { flexShrink: 0, fontSize: 12, lineHeight: 19, color: "#52617A", paddingHorizontal: 20, paddingVertical: 12 },
  map: { flex: 1, minHeight: 220, backgroundColor: "#EDF1F7" },
  mapNotice: { position: "absolute", bottom: 16, left: 16, right: 76, padding: 12, borderRadius: 12, backgroundColor: "#FFF8EA", borderWidth: 1, borderColor: "#EBD6AE" },
  mapNoticeText: { fontSize: 12, lineHeight: 19, color: "#9A4F0A" },
  mapLoading: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#EDF1F7", alignItems: "center", justifyContent: "center", gap: 8 },
  mapError: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#F8FAFD", padding: 28, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 14, lineHeight: 22, color: "#52617A", textAlign: "center" },
  retry: { padding: 14, marginTop: 12 },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E1E7EF" },
  confirm: { minHeight: 50, marginTop: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", padding: 12 },
  confirmText: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: "#FFFFFF" },
  disabled: { backgroundColor: "#AEBBD4" },
});
