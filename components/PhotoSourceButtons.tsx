import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

type Props = {
  onTakePhoto: () => void;
  onPickImage: () => void;
};

// Two full-width rows, not side-by-side columns — splitting the row in
// half leaves too little width for a Tagalog label next to an icon on
// small screens. Camera is filled/primary since it gives the resident
// direct control over framing the ID inside the guide box; gallery is
// the lighter-weight fallback for a photo they already took earlier.
//
// Reference implementation for two app-wide conventions:
//
// 1. Button anatomy — the app has two intentional CTA shapes, not one:
//    plain centered-text (bg-brand rounded-2xl py-4 items-center, used by
//    every simple form-submit button) for a single obvious next step, and
//    this icon-circle + label/sublabel + chevron shape for when the
//    resident is choosing between 2+ options that each need a one-line
//    "what this does." Use this shape only when that choice/explanation
//    need is real, not as a default for every button.
//
// 2. Button "weight" — three fill tiers, all already used elsewhere in the
//    app, pick whichever matches the action's importance instead of
//    inventing a fourth: filled-solid (bg-brand/bg-alert, white content —
//    primary actions, urgent contacts) like the camera button below;
//    filled-tint (bg-brand-50, brand-colored content — secondary actions)
//    like the gallery button below; flat/opacity-only (no fill,
//    active:opacity-60/70 — low-emphasis rows/links, see profile.tsx's
//    Row or BackButton.tsx) for anything lighter than these two.
export function PhotoSourceButtons({ onTakePhoto, onPickImage }: Props) {
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        onPress={onTakePhoto}
        className="flex-row items-center bg-brand rounded-2xl overflow-hidden active:opacity-85"
        style={{ paddingVertical: 14, paddingHorizontal: 14, gap: 12 }}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 38, height: 38, backgroundColor: "rgba(255,255,255,0.18)" }}
        >
          <Ionicons name="camera" size={20} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text className="text-white font-semibold text-[16px]">Kumuha ng Larawan</Text>
          <Text className="text-white/70 text-[12.5px] mt-0.5">Direktang kunan gamit ang camera</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
      </Pressable>

      <Pressable
        onPress={onPickImage}
        className="flex-row items-center bg-brand-50 rounded-2xl overflow-hidden active:opacity-70"
        style={{ paddingVertical: 14, paddingHorizontal: 14, gap: 12 }}
      >
        <View
          className="items-center justify-center rounded-full bg-white"
          style={{ width: 38, height: 38 }}
        >
          <Ionicons name="image-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text className="text-brand font-semibold text-[16px]">Piliin sa Gallery</Text>
          <Text className="text-brand/60 text-[12.5px] mt-0.5">Kung may naka-save nang larawan</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}
