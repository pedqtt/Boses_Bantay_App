import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";
import { CLOSING_COPY } from "@/lib/reportQuestions";
import { ScreenBackground } from "@/components/ScreenBackground";
import { AuthActionGroup } from "@/components/AuthActionGroup";
import { Card } from "@/components/Card";
import { DraftBadge } from "./DraftBadge";

type SubmittedScreenProps = {
  referenceNo: string;
  onViewReports: () => void;
  /** Leaves the flow entirely, back to Home - replaces the old
   *  "Mag-report muli" shortcut (see this file's top comment for why). */
  onGoHome: () => void;
};

/**
 * Confirmation screen - sets the expectation that this is a pre-blotter,
 * still pending barangay review, not a filed case.
 *
 * Status icon is green on purpose (per direct feedback, overriding an
 * earlier pass that swapped it to amber to match StatusPill's "Under
 * Review" - green here is read as "success/done with this step," not as a
 * claim about the report's review status, so it stays green) - but as a
 * ringed badge (soft green-50 ring behind the solid green-700 circle)
 * instead of one flat fill, the same "ring behind the meaningful dot"
 * language BahagiHeader's stepper already uses, so the two moments read as
 * the same app. The badge fades and scales in on mount (Reanimated,
 * ~350ms, ease-out, no bounce/overshoot) - the one genuinely celebratory
 * beat in the whole flow, kept restrained rather than playful since this
 * is still a civic form, not a game.
 *
 * FIXED: "Mag-report muli" (file another report) used to sit right here as
 * a one-tap shortcut, immediately after a resident just finished filing
 * one - low-friction enough that it read as an invitation to keep filing,
 * exactly the shape a spam problem starts as. Replaced with "Bumalik sa
 * Home," which still lets a resident leave this screen but no longer
 * dangles "file again" as the path of least resistance right after a
 * submission. Filing again is still possible from Home whenever they
 * actually mean to.
 *
 * NEW: "I-save sa Gallery" - captures the confirmation block (badge,
 * heading, reference card) as an image and saves it to the phone's photo
 * gallery via expo-media-library, so a resident without reliable data can
 * still show up at the barangay hall with proof of their reference number
 * even if they can't reopen the app or its reports list. `snapshotRef`
 * wraps only that block, not the buttons below it - a screenshot with
 * "Tingnan ang aking reports" baked into it wouldn't mean anything once
 * saved as an image.
 *
 * TRIED, then reverted: a second amber "Susunod na Hakbang" callout
 * pulling POST_BLOTTER_STEPS' "signature" step in under the ticket card,
 * to explicitly name the one thing still pending. Direct feedback: it
 * broke this screen's minimalist register - a colored box arguing for
 * attention right after the resident already finished the flow reads as
 * one more thing to deal with, not a clean stop. The reference card's own
 * caption line ("...kapag pumunta kayo sa barangay hall para pumirma...")
 * already carries that same fact in plain text, no box, which is enough -
 * this screen's job is confirmation and a clean exit, not a second
 * checklist.
 *
 * FIXED: the three actions were three stacked full-width blocks (filled,
 * bordered, plain text) reading as a flat list of equally-spaced options -
 * three decisions in a row instead of one clear choice with two lighter
 * alternatives. Rebuilt on AuthActionGroup, the same primary-button +
 * hairline-rule + secondary-slot structure every auth screen already uses,
 * so this screen's bottom actions read as the same pattern instead of its
 * own one-off. The two lighter actions now share that one secondary slot
 * as a single row, split by the same thin vertical rule BahagiHeader and
 * PhoneInput already use to separate two related controls - "save a copy"
 * and "leave" are both "I'm done here, in one way or another," so they
 * read as a pair, not two more decisions stacked under the real one.
 */
export function SubmittedScreen({ referenceNo, onViewReports, onGoHome }: SubmittedScreenProps) {
  // Single mount-in animation driving both the ring's fade and its scale -
  // one shared value, not two, since they move together (there's no
  // moment where one should lag the other). Starts at 0.6 rather than 0 so
  // the badge settles into place instead of growing from nothing, which
  // reads as a pop, not a materialization.
  const badgeIn = useSharedValue(0);
  useEffect(() => {
    badgeIn.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [badgeIn]);
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeIn.value,
    transform: [{ scale: 0.6 + 0.4 * badgeIn.value }],
  }));

  const snapshotRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);

  async function handleSaveSnapshot() {
    if (saving) return;
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Kailangan ang access sa Photos",
          "Maaari po itong i-enable sa Settings para ma-save ang reference number sa gallery."
        );
        return;
      }
      const uri = await captureRef(snapshotRef, { format: "png", quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Na-save po", "Na-save na ang inyong reference number sa Photos.");
    } catch (err: any) {
      Alert.alert("Hindi na-save", err?.message ?? "Subukan po muli.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: colors.surface }}>
      <ScreenBackground>
        <View className="flex-1 items-center justify-center px-8">
          <View ref={snapshotRef} collapsable={false} className="w-full items-center">
            <Animated.View
              style={badgeStyle}
              className="w-20 h-20 rounded-full bg-green-50 items-center justify-center mb-6"
            >
              <View className="w-14 h-14 rounded-full bg-green-700 items-center justify-center">
                <Ionicons name="checkmark" size={26} color="white" />
              </View>
            </Animated.View>

            <Text className={`${REPORT_TYPE.heroTitle} text-center mb-2`}>
              {CLOSING_COPY.thanks} Naipasa na ang report.
            </Text>
            <Text className={`${REPORT_TYPE.subtitle} text-center max-w-[290px] mb-8`}>
              {CLOSING_COPY.body}
            </Text>

            <Card className="w-full px-5 py-5 mb-8">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <Ionicons
                    name="bookmark-outline"
                    size={14}
                    color={colors.onSurfaceVariant}
                    style={{ marginRight: 5 }}
                  />
                  <Text className={REPORT_TYPE.fieldLabel}>Reference Number</Text>
                </View>
                <DraftBadge compact />
              </View>
              <Text className="text-[28px] font-bold text-brand" style={{ letterSpacing: 2 }}>
                {referenceNo}
              </Text>

              <View className="h-px bg-gray-100 my-4" />

              <Text className={REPORT_TYPE.caption}>
                Gamitin ang numerong ito kapag pumunta kayo sa barangay hall para pumirma, o para
                mag-follow up sa inyong report.
              </Text>
            </Card>
          </View>

          <View className="w-full">
            <AuthActionGroup
              secondary={
                <View className="flex-row items-center justify-center">
                  <Pressable
                    onPress={handleSaveSnapshot}
                    disabled={saving}
                    className="flex-row items-center py-1 active:opacity-70"
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.onSurfaceVariant} />
                    ) : (
                      <>
                        <Ionicons
                          name="download-outline"
                          size={16}
                          color={colors.onSurfaceVariant}
                          style={{ marginRight: 5 }}
                        />
                        <Text className="text-[15px] font-medium text-ink-soft">
                          I-save sa Gallery
                        </Text>
                      </>
                    )}
                  </Pressable>

                  {/* Same thin-rule-as-separator pattern BahagiHeader and
                      PhoneInput use - two related, lighter actions sharing
                      one row instead of two more full-width blocks. */}
                  <View className="w-px h-4 bg-gray-300 mx-3" />

                  <Pressable onPress={onGoHome} className="py-1 active:opacity-70">
                    <Text className="text-[15px] font-medium text-ink-soft">Bumalik sa Home</Text>
                  </Pressable>
                </View>
              }
            >
              <Pressable
                onPress={onViewReports}
                className="bg-brand rounded-2xl py-4 items-center overflow-hidden active:opacity-85"
              >
                <Text className={REPORT_TYPE.buttonPrimary}>Tingnan ang aking reports</Text>
              </Pressable>
            </AuthActionGroup>
          </View>
        </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}
