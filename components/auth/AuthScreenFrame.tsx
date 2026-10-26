import { BackButton } from "@/components/BackButton";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { colors } from "@/lib/theme";

export function AuthScreenFrame({ children }: { children: ReactNode }) {
  return (
    <View style={authStyles.screen}>
      <View style={authStyles.brandHeader}>
        <View style={authStyles.brandContent}>
          <View style={authStyles.brandIcon} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={authStyles.brandSpeech}>
              <View style={[authStyles.brandVoiceBar, authStyles.brandVoiceShort]} />
              <View style={[authStyles.brandVoiceBar, authStyles.brandVoiceTall]} />
              <View style={[authStyles.brandVoiceBar, authStyles.brandVoiceMedium]} />
              <View style={[authStyles.brandVoiceBar, authStyles.brandVoiceShort]} />
            </View>
            <View style={authStyles.brandSpeechTail} />
          </View>
          <View style={authStyles.brandIdentity}>
            <Text variant="screenTitle" style={authStyles.brandName}>Boses Bantay</Text>
            <View style={authStyles.brandSubtitle}>
              <View style={authStyles.brandAccent} />
              <Text variant="secondary" style={authStyles.brandCaption}>Para sa mga residente</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
export function AuthFormCard({ children }: { children: ReactNode }) { return <View style={authStyles.formCard}>{children}</View>; }
export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return <BackButton onPress={onPress} />;
}
export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.residentBackground },
  brandHeader: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D8E0EE",
    paddingVertical: 22,
  },
  brandContent: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  brandIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    flexShrink: 0,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  brandSpeech: {
    width: 34,
    height: 28,
    marginTop: -3,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  brandSpeechTail: {
    position: "absolute",
    left: 15,
    top: 36,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: "#FFFFFF",
    borderRightWidth: 8,
    borderRightColor: "transparent",
  },
  brandVoiceBar: { width: 3, borderRadius: 2, backgroundColor: colors.primary },
  brandVoiceShort: { height: 7 },
  brandVoiceMedium: { height: 12 },
  brandVoiceTall: { height: 17 },
  brandIdentity: { flex: 1, minWidth: 0, gap: 5 },
  brandName: { color: "#14244B", fontWeight: "700", letterSpacing: -0.7 },
  brandSubtitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandAccent: { width: 15, height: 2, borderRadius: 1, backgroundColor: "#8EA4D0" },
  brandCaption: { flexShrink: 1, color: "#52627D", letterSpacing: 0.1 },
  formCard: { width: "100%", maxWidth: 520, alignSelf: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 22, padding: 20 }, inputBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, backgroundColor: "#FAFBFD" }, passwordEye: { width: 40, minHeight: 48, alignItems: "center", justifyContent: "center" }, pendingCard: { padding: 24, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DFE5EF", borderRadius: 22 }, pendingIcon: { width: 64, height: 64, borderRadius: 21, backgroundColor: "#FFF4DF", alignItems: "center", justifyContent: "center", marginBottom: 20 },
});
