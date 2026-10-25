import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

/** Photos remain private; obtain short-lived links using the resident's session. */
export function SavedComplaintPhotos({ paths }: { paths: string[] }) {
  const [photos, setPhotos] = useState<{ path: string; signedUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const key = JSON.stringify(paths);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    void (async () => {
      try {
        if (!supabase) throw Error("Not configured");
        const { data, error: lookupError } = await supabase.storage.from("report_evidence").createSignedUrls(JSON.parse(key), 300);
        if (lookupError || !data || data.some(item => item.error || !item.signedUrl)) throw Error("Photo lookup failed");
        if (!cancelled) setPhotos(data.map(item => ({ path: item.path ?? "", signedUrl: item.signedUrl! })));
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [key, attempt]);
  return <View className="mt-4">
    <Text className="text-[13px] text-ink-soft mb-3">Mga larawan ({paths.length})</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} className="py-3"><Text className="text-brand text-[14px]">Hindi mabuksan ang larawan. Pindutin para subukang muli.</Text></Pressable> : <View className="flex-row flex-wrap" style={{ gap: 10 }}>{photos.map((photo, index) => <Pressable key={photo.path} accessibilityRole="button" accessibilityLabel={`Tingnan ang larawan ${index + 1}`} onPress={() => setPreview(photo.signedUrl)}><Image source={{ uri: photo.signedUrl }} onError={() => setError(true)} style={{ width: 88, height: 88, borderRadius: 14 }} resizeMethod="resize" /></Pressable>)}</View>}
    {preview && <Modal visible onRequestClose={() => setPreview(null)} animationType="fade"><SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F19" }}><Pressable accessibilityRole="button" accessibilityLabel="Isara ang larawan" onPress={() => setPreview(null)} style={{ alignSelf: "flex-end", padding: 18 }}><Ionicons name="close" size={26} color="white" /></Pressable><Image source={{ uri: preview }} style={{ flex: 1, width: "100%" }} resizeMode="contain" resizeMethod="resize" /></SafeAreaView></Modal>}
  </View>;
}
