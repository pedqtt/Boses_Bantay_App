import { BackButton } from "@/components/BackButton";
import { Text, TextInput } from "@/components/AppText";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";
import { homeStyles } from "@/components/home/homeStyles";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/api/auth";
import { changeAccountPassword } from "@/lib/api/changePassword";
import { getNewPasswordError, getConfirmPasswordError, PASSWORD_REQUIREMENTS_HINT } from "@/lib/validation";

export default function ChangePasswordScreen() {
  const { profile, signOut: clearSession } = useAuth();
  const navigation = useNavigation();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false), active = useRef(false);
  const ownerRef = useRef(profile?.id); ownerRef.current = profile?.id;
  useFocusEffect(useCallback(() => { active.current = true; navigation.setOptions({ tabBarStyle: { display: "none" } }); return () => { active.current = false; navigation.setOptions({ tabBarStyle: undefined }); setCurrent(""); setPassword(""); setConfirm(""); setError(""); }; }, [navigation]));
  const valid = Boolean(current) && !getNewPasswordError(password) && !getConfirmPasswordError(password, confirm) && current !== password;
  async function save() {
    if (pending.current || !profile?.id) return;
    const validation = !current ? "Ilagay ang kasalukuyang password." : getNewPasswordError(password) || getConfirmPasswordError(password, confirm) || (current === password ? "Dapat iba ang bagong password sa dati." : null);
    if (validation) { setError(validation); return; }
    const owner = profile.id;
    pending.current = true; setBusy(true); setError("");
    try {
      await changeAccountPassword(owner, current, password);
      if (ownerRef.current !== owner) return;
      setCurrent(""); setPassword(""); setConfirm("");
      await signOut(owner).catch(() => {});
      clearSession();
      router.replace("/(auth)/login");
      Alert.alert("Nabago ang password", "Mag-login muli gamit ang inyong bagong password.");
    } catch (err) { if (active.current && ownerRef.current === owner) setError(err instanceof Error ? err.message : "Hindi na-update ang password. Pakisubukan muli."); }
    finally { pending.current = false; if (active.current) setBusy(false); }
  }
  return <SafeAreaView edges={["top", "bottom"]} style={s.screen}>
    <View style={s.header}><BackButton showLabel={false} onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(resident)/settings"); }} disabled={busy} /><Text variant="screenTitle" accessibilityRole="header" style={s.title}>Change password</Text></View>
    <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" bottomOffset={24} style={s.content} contentContainerStyle={s.body}>
      <Text style={s.intro}>Ilagay ang kasalukuyang password at pumili ng bago.</Text>
      <View style={s.card}>
        <PasswordField label="Kasalukuyang password" value={current} onChange={setCurrent} disabled={busy} />
        <View style={{ height: 20 }} />
        <PasswordField label="Bagong password" value={password} onChange={setPassword} disabled={busy} />
        <Text style={s.hint}>{PASSWORD_REQUIREMENTS_HINT}</Text>
        <View style={{ height: 20 }} />
        <PasswordField label="Ulitin ang bagong password" value={confirm} onChange={setConfirm} disabled={busy} />
        {confirm && password !== confirm ? <Text style={s.error}>Hindi magkatugma ang password.</Text> : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !valid, busy }} disabled={busy || !valid} onPress={() => void save()} style={[s.save, (busy || !valid) && { opacity: 0.5 }]}>{busy ? <ActivityIndicator color="white" /> : <><Ionicons name="lock-closed-outline" size={18} color="white" /><Text style={s.saveText}>I-save ang bagong password</Text></>}</Pressable>
      <Text style={s.hint}>Pagkatapos mag-save, mag-login muli gamit ang bagong password.</Text>
    </KeyboardAwareScrollView>
  </SafeAreaView>;
}
function PasswordField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [visible, setVisible] = useState(false), [focused, setFocused] = useState(false);
  return <View><Text style={s.label}>{label}</Text><View style={[s.inputBox, focused && { borderColor: colors.primary }]}><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={label} placeholderTextColor="#64748B" style={s.input} /><Pressable accessibilityRole="button" accessibilityLabel={visible ? `Itago: ${label}` : `Ipakita: ${label}`} disabled={disabled} onPress={() => setVisible(value => !value)} style={s.eye}><Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={21} color="#64748B" /></Pressable></View></View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "white" }, header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }, title: { flex: 1, fontSize: 23, lineHeight: 31, fontWeight: "600", color: "#14244B" }, content: { flex: 1, backgroundColor: colors.residentBackground }, body: { padding: 20, paddingBottom: 40 }, intro: { fontSize: 14, lineHeight: 23, color: "#64748B", marginBottom: 20 }, card: { ...homeStyles.card, padding: 18 }, label: { fontSize: 12, lineHeight: 19, fontWeight: "500", color: "#52617A", marginBottom: 8 }, inputBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#DCE3EF", borderRadius: 13, backgroundColor: "#FAFBFD" }, input: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, lineHeight: 23, color: "#172033" }, eye: { width: 44, height: 48, alignItems: "center", justifyContent: "center" }, hint: { fontSize: 11, lineHeight: 19, color: "#64748B", marginTop: 10 }, error: { fontSize: 12, lineHeight: 20, color: "#AC293B", marginTop: 12 }, save: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 52, gap: 10, padding: 14, borderRadius: 15, backgroundColor: colors.primary, marginTop: 22 }, saveText: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: "white" },
});
