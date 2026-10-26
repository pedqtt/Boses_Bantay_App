import { Text } from "@/components/AppText";
import { View, Pressable, Image } from "react-native";
import { Ionicons } from "@/components/AppIcon";
import { GuideCard } from "./GuideCard";
import { ReportCard } from "./ReportCard";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import type { ComplaintStep } from "@/lib/serviceComplaintFlow";

export function ServiceComplaintIntro() {
  const steps = ["Piliin ang uri ng problema", "Ilagay ang lokasyon at paglalarawan", "Magdagdag ng larawan kung mayroon", "Suriin bago ipasa"];
  return <View>
    <Text className="text-[27px] leading-9 font-semibold text-ink mb-3">Ipaalam ang problema sa inyong komunidad.</Text>
    <Text className={`${REPORT_TYPE.subtitle} mb-6`}>Para sa mga concern sa serbisyo, kalinisan, at kagamitan sa barangay.</Text>
    <GuideCard title="4 na hakbang" icon="list-outline" neutral>
      {steps.map((text, index) => <View key={text} className="flex-row items-start" style={{ marginTop: index ? 18 : 0 }}>
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: colors.residentTint, marginRight: 12, alignItems: "center", justifyContent: "center" }}><Text className="font-semibold text-brand">{index + 1}</Text></View>
        <Text className="text-[16px] leading-6 text-ink flex-1">{text}</Text>
      </View>)}
    </GuideCard>
  </View>;
}

export function ServiceComplaintReview({ category, location, description, images, onEdit, onPhoto }: {
  category: string; location: string; description: string; images: string[];
  onEdit: (step: ComplaintStep) => void; onPhoto: (index: number) => void;
}) {
  const rows: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; step: ComplaintStep }[] = [
    { label: "Uri ng problema", value: category, icon: "construct-outline", step: "category" },
    { label: "Lokasyon", value: location, icon: "location-outline", step: "details" },
    { label: "Paglalarawan", value: description, icon: "document-text-outline", step: "details" },
  ];
  return <View>
    {rows.map(row => <ReportCard key={row.label} className="p-4 mb-4">
      <View className="flex-row items-center mb-3">
        <Ionicons name={row.icon} size={17} color={colors.primary} style={{ marginRight: 8 }} />
        <Text className={`${REPORT_TYPE.fieldLabel} flex-1`}>{row.label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Baguhin: ${row.label}`} onPress={() => onEdit(row.step)} className="bg-brand-50 rounded-xl px-3 py-2 ml-2 active:opacity-70"><Text className="text-[13px] font-semibold text-brand">Baguhin</Text></Pressable>
      </View>
      <Text className={REPORT_TYPE.body} style={{ lineHeight: 27 }}>{row.value}</Text>
    </ReportCard>)}
    <ReportCard className="p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ flex: 1, marginRight: 8 }} className={REPORT_TYPE.fieldLabel}>Mga larawan ({images.length}/5)</Text>
        <Pressable accessibilityRole="button" onPress={() => onEdit("photos")} className="bg-brand-50 rounded-xl px-3 py-2 active:opacity-70"><Text className="text-[13px] font-semibold text-brand">Baguhin</Text></Pressable>
      </View>
      {images.length ? <View className="flex-row flex-wrap" style={{ gap: 8 }}>{images.map((uri, index) => <Pressable key={`${uri}-${index}`} accessibilityRole="button" accessibilityLabel={`Tingnan ang larawan ${index + 1}`} onPress={() => onPhoto(index)}><Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 12 }} resizeMethod="resize" /></Pressable>)}</View> : <Text className={REPORT_TYPE.helper}>Walang inilakip na larawan. Opsyonal po ito.</Text>}

    </ReportCard>
  </View>;
}
