import { Text } from "@/components/AppText";
import { useState } from "react";
import { View, Pressable, Image, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@/components/AppIcon";
import { colors } from "@/lib/theme";
import { MAX_COMPLAINT_PHOTOS } from "@/lib/complaintAttachments";

function PhotoTile({ uri, index, disabled, onPreview, onRemove }: {
  uri: string; index: number; disabled: boolean; onPreview: () => void; onRemove: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return <View style={styles.tile}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Palakihin ang larawan ${index + 1}`}
      disabled={disabled} onPress={onPreview} className="active:opacity-85" style={styles.preview}>
      {failed ? <View style={styles.imageFallback}>
        <Ionicons name="image-outline" size={26} color={colors.onSurfaceVariant} />
        <Text style={styles.fallbackText}>Hindi mabuksan ang larawan</Text>
      </View> : <Image source={{ uri }} style={styles.image} resizeMode="cover" resizeMethod="resize" onError={() => setFailed(true)} />}
      {!failed && <View pointerEvents="none" style={styles.expandBadge}><Ionicons name="expand-outline" size={14} color="white" /></View>}
    </Pressable>
    <View style={styles.tileFooter}>
      <Text style={styles.tileLabel}>Larawan {index + 1}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Alisin ang larawan ${index + 1}`}
        disabled={disabled} onPress={onRemove} className="active:opacity-60" style={styles.remove}>
        <Ionicons name="trash-outline" size={17} color={colors.error} />
      </Pressable>
    </View>
  </View>;
}

export function ComplaintAttachments({ images, busy, onCamera, onGallery, onPhoto, onRemovePhoto }: {
  images: string[]; busy: boolean; onCamera: () => void; onGallery: () => void;
  onPhoto: (index: number) => void; onRemovePhoto: (uri: string) => void;
}) {
  const full = images.length >= MAX_COMPLAINT_PHOTOS;
  const disabled = busy || full;
  return <View>
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>Mga larawan ng problema</Text>
        <Text style={styles.supporting}>Pindutin ang larawan para palakihin.</Text>
      </View>
      <View style={styles.countBadge}><Text style={styles.count}>{images.length} / {MAX_COMPLAINT_PHOTOS}</Text></View>
    </View>
    <View style={styles.capacity} accessible accessibilityLabel={`${images.length} sa ${MAX_COMPLAINT_PHOTOS} larawan`}>
      {Array.from({ length: MAX_COMPLAINT_PHOTOS }, (_, index) => <View key={index} style={[styles.capacitySegment, { backgroundColor: index < images.length ? colors.primary : "#E5EAF5" }]} />)}
    </View>

    {images.length ? <View style={styles.grid}>
      {images.map((uri, index) => <PhotoTile key={uri} uri={uri} index={index} disabled={busy}
        onPreview={() => onPhoto(index)} onRemove={() => onRemovePhoto(uri)} />)}
    </View> : <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name="images-outline" size={30} color={colors.primary} /></View>
      <Text style={styles.emptyTitle}>Ipakita ang inyong concern</Text>
      <Text style={styles.emptyBody}>Kumuha ng larawan o pumili mula sa gallery upang mas madaling makita ang problema.</Text>
      <View style={styles.optionalBadge}><Text style={styles.optionalText}>Opsyonal · hanggang 5 larawan</Text></View>
    </View>}

    {!full ? <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Kumuha ng larawan gamit ang camera"
        accessibilityState={{ disabled }} disabled={disabled} onPress={onCamera}
        className="active:opacity-80" style={[styles.action, styles.cameraAction, disabled && styles.disabled]}>
        <View style={styles.cameraIcon}><Ionicons name="camera-outline" size={23} color="white" /></View>
        <Text style={styles.cameraTitle}>Kumuha ng larawan</Text>
        <Text style={styles.cameraSubtitle}>Gamit ang camera</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Pumili ng larawan mula sa gallery"
        accessibilityState={{ disabled }} disabled={disabled} onPress={onGallery}
        className="active:opacity-70" style={[styles.action, styles.galleryAction, disabled && styles.disabled]}>
        <View style={styles.galleryIcon}><Ionicons name="image-outline" size={23} color={colors.primary} /></View>
        <Text style={styles.galleryTitle}>Pumili ng larawan</Text>
        <Text style={styles.gallerySubtitle}>Mula sa gallery</Text>
      </Pressable>
    </View> : <View style={styles.fullNotice}>
      <Ionicons name="images-outline" size={18} color={colors.primary} style={{ marginRight: 9 }} />
      <Text style={styles.fullText}>Naabot na ang 5 larawan. Alisin ang isa kung nais magdagdag ng iba.</Text>
    </View>}

    {busy ? <View style={styles.processing} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={colors.primary} /><Text style={styles.processingText}>Inihahanda ang larawan...</Text>
    </View> : <View style={styles.tip}>
      <Ionicons name="bulb-outline" size={18} color={colors.primary} style={{ marginRight: 10, marginTop: 2 }} />
      <Text style={styles.tipText}>Isang malapit na kuha ng problema at isang kuha ng paligid ay makatutulong para matukoy ang lokasyon.</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, lineHeight: 23, fontWeight: "600", color: colors.onSurface },
  supporting: { fontSize: 13, lineHeight: 20, color: colors.onSurfaceVariant, marginTop: 3 },
  countBadge: { backgroundColor: "#E9EDF9", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 12 },
  count: { color: colors.primary, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  capacity: { flexDirection: "row", gap: 6, marginBottom: 20 },
  capacitySegment: { flex: 1, height: 3, borderRadius: 3 },
  empty: { backgroundColor: "#F5F7FD", borderColor: "#DDE4F3", borderWidth: 1, borderRadius: 22, alignItems: "center", paddingHorizontal: 22, paddingVertical: 28, marginBottom: 16 },
  emptyIcon: { width: 64, height: 64, borderRadius: 21, backgroundColor: "#E7ECFA", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { color: colors.onSurface, fontSize: 18, lineHeight: 25, fontWeight: "600", textAlign: "center" },
  emptyBody: { color: colors.onSurfaceVariant, fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 8, maxWidth: 290 },
  optionalBadge: { marginTop: 16, backgroundColor: "#FFFFFF", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  optionalText: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, fontWeight: "500" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginBottom: 18 },
  tile: { width: "48%", backgroundColor: "white", borderWidth: 1, borderColor: "#DDE3EE", borderRadius: 17, overflow: "hidden" },
  preview: { width: "100%", aspectRatio: 1.15, backgroundColor: "#EDF0F7" },
  image: { width: "100%", height: "100%" },
  imageFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12 },
  fallbackText: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 8 },
  expandBadge: { position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: 9, backgroundColor: "#0B163C80", alignItems: "center", justifyContent: "center" },
  tileFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 12, paddingRight: 2, minHeight: 46 },
  tileLabel: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant, fontWeight: "500" },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1, borderRadius: 18, padding: 15, minHeight: 144, justifyContent: "center", alignItems: "flex-start" },
  cameraAction: { backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
  galleryAction: { backgroundColor: "white", borderWidth: 1, borderColor: "#DDE3EE" },
  cameraIcon: { backgroundColor: "#FFFFFF18", width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  galleryIcon: { backgroundColor: colors.residentTint, width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cameraTitle: { color: "white", fontSize: 14, lineHeight: 20, fontWeight: "600" },
  galleryTitle: { color: colors.primary, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  cameraSubtitle: { color: "#E4E9FF", fontSize: 12, lineHeight: 18, marginTop: 4 },
  gallerySubtitle: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, marginTop: 4 },
  disabled: { opacity: 0.45 },
  fullNotice: { backgroundColor: colors.residentTint, padding: 14, borderRadius: 15, flexDirection: "row", alignItems: "center" },
  fullText: { flex: 1, color: colors.onPrimaryContainer, fontSize: 13, lineHeight: 21 },
  tip: { flexDirection: "row", paddingTop: 20, paddingBottom: 4 },
  tipText: { flex: 1, color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 21 },
  processing: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  processingText: { color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 20, marginLeft: 9 },
});
