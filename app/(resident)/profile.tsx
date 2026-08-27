import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { signOut } from "@/lib/api/auth";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors } from "@/lib/theme";

// Keys must match ResidentProfile["barangayIdStatus"] exactly (lib/api/auth.ts)
// — this previously used "pending"/"verified", which don't exist in that
// type, so the row always rendered blank for every real status value.
const ID_STATUS_META: Record<string, { label: string; tone: "muted" | "progress" | "done" }> = {
  unverified: { label: "Hindi pa verified", tone: "muted" },
  secretary_verified: { label: "Halos tapos na", tone: "progress" },
  pb_authorized: { label: "Verified na", tone: "done" },
};

const ID_STATUS_COLORS: Record<"muted" | "progress" | "done", { bg: string; text: string }> = {
  muted: { bg: colors.outlineVariant, text: colors.onSurfaceVariant },
  progress: { bg: "#FDECC8", text: "#92600C" },
  done: { bg: colors.primaryContainer, text: colors.primary },
};

/**
 * Complete redesign, not a styling pass on the old layout - the previous
 * screen was a plain identity block plus a flat list of five rows with no
 * distinction between "info," "action," and "not built yet." Two things
 * were actually wrong, not just plain-looking:
 *
 *   1. Barangay ID status was a bare word ("Verified"/"Almost there") with
 *      no visual weight - the one piece of state on this whole screen that
 *      actually matters (can this resident's reports be trusted as coming
 *      from a verified identity?) read the same as a static label.
 *   2. Notifications and Help & support rendered as normal tappable rows
 *      with a chevron - full affordance for two features that don't do
 *      anything yet (empty onPress). That's a broken promise, not a
 *      minor omission - tapping a row with a chevron and having nothing
 *      happen is worse than not having the row at all.
 *
 * Fixed here: a real status pill (colored by state, not just text) on the
 * hero card, and Notifications/Help & support demoted to a disabled,
 * visibly inactive state with a "Malapit na" (Coming soon) tag instead of
 * a chevron - so the screen stops advertising affordance it can't deliver.
 */

function IdStatusPill({ status }: { status: string }) {
  const meta = ID_STATUS_META[status] ?? ID_STATUS_META.unverified;
  const c = ID_STATUS_COLORS[meta.tone];
  return (
    <View
      className="flex-row items-center rounded-full px-3 py-1.5"
      style={{ backgroundColor: c.bg }}
    >
      {meta.tone === "done" && (
        <Ionicons name="checkmark-circle" size={13} color={c.text} style={{ marginRight: 4 }} />
      )}
      <Text className="text-[12px] font-semibold" style={{ color: c.text }}>
        {meta.label}
      </Text>
    </View>
  );
}

function AccountRow({
  icon,
  label,
  onPress,
  comingSoon,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  comingSoon?: boolean;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || comingSoon}
      className="active:opacity-60"
    >
      <View
        className={`flex-row items-center py-4 ${isLast ? "" : "border-b"}`}
        style={{ borderColor: colors.outlineVariant, opacity: comingSoon ? 0.5 : 1 }}
      >
        {/* Bare icon, no tinted disc behind it - the icon-in-a-circle
            treatment reads as "this is a distinct interactive object" the
            way it's used on cards elsewhere; a plain settings-style list
            like this one is quieter without five identical circles down
            the left edge. */}
        <Ionicons name={icon} size={18} color={colors.outline} style={{ width: 28 }} />
        <Text className="flex-1 text-[15px] text-ink">{label}</Text>

        {comingSoon ? (
          <Text className="text-[12px] font-medium" style={{ color: colors.outline }}>
            Malapit na
          </Text>
        ) : (
          onPress && <Ionicons name="chevron-forward" size={18} color={colors.outlineFaint} />
        )}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { profile, signOut: clearSession } = useAuth();

  async function handleLogout() {
    await signOut(profile?.id);
    clearSession();
    router.replace("/(auth)/login");
  }

  const idStatus = profile?.barangayIdStatus ?? "unverified";

  return (
    <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: colors.surfaceContainerLow }}>
      {/* Same header/body contrast treatment as bot.tsx and directory.tsx:
          white header with a hairline bottom border, body lightened off
          the app-wide surface color via ScreenBackground's per-screen
          override. */}
      <ScreenBackground backgroundColor="#FAF8F7">
        <View
          className="px-5 pt-3 pb-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
          }}
        >
          <Text className="text-[24px] font-semibold text-ink tracking-tight">Profile</Text>
        </View>

        {/* Wrapped in a real ScrollView now - the old layout had none at
            all, meaning content taller than one screen would have simply
            been clipped with no way to reach it (e.g. on smaller devices
            or with a longer name/address). */}
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 110 }}
        >
          {/* ORGANIZATION FIX, not a restyle: identity data was split
              across two cards - name and phone up here, but "Purok /
              address" orphaned down in a settings list next to
              Notifications and Help & support, which aren't identity at
              all. All three facts about WHO this resident is now live in
              one card; the list below is purely settings.

              Zone structure (per the component-hierarchy discipline):
                Top    - avatar + name (primary) + verification status
                         (the one label/badge on this screen)
                Middle - the supporting facts, as label/value rows:
                         phone, purok
                Bottom - the single action, and only when it's actually
                         actionable (hidden entirely once verified, so a
                         verified resident isn't shown a CTA for something
                         already done)

              Deliberately NOT highlighted: phone and purok are plain
              label/value text. Only verification status gets a badge -
              per the rule that if more than two things are highlighted,
              nothing is. */}
          <Card className="px-5 pt-6 pb-2 mb-6">
            <View className="flex-row items-center pb-6">
              <View
                className="rounded-full bg-brand items-center justify-center"
                style={{ width: 52, height: 52, marginRight: 14 }}
              >
                <Text className="text-white text-[18px] font-medium">
                  {(profile?.fullName ?? "R").charAt(0)}
                </Text>
              </View>
              <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="text-[18px] font-semibold text-ink" numberOfLines={1}>
                  {profile?.fullName ?? "Resident"}
                </Text>
                <Text className="text-[13px] text-ink-faint mt-1" numberOfLines={1}>
                  Resident
                </Text>
              </View>
              <IdStatusPill status={idStatus} />
            </View>

            {/* Two-column field grid instead of two stacked label/value
                rows - "Numero" and "Purok" were reading as a repeated
                list item pattern (same shape, same divider, twice) when
                they're really two short facts that belong side by side,
                the way a real ID's data fields are laid out. One hairline
                on top of the pair, not one per row. */}
            <View
              className="flex-row py-4"
              style={{ borderTopWidth: 1, borderTopColor: colors.outlineVariant }}
            >
              <View className="flex-1">
                <Text className="text-[11px] text-ink-faint uppercase" style={{ letterSpacing: 0.5 }}>
                  Numero
                </Text>
                <Text className="text-[14px] text-ink font-medium mt-1" numberOfLines={1}>
                  {profile?.phone || "—"}
                </Text>
              </View>
              <View className="w-px mx-4" style={{ backgroundColor: colors.outlineVariant }} />
              <View className="flex-1">
                <Text className="text-[11px] text-ink-faint uppercase" style={{ letterSpacing: 0.5 }}>
                  Purok / address
                </Text>
                <Text className="text-[14px] text-ink font-medium mt-1" numberOfLines={1}>
                  {profile?.purok || "—"}
                </Text>
              </View>
            </View>

            {idStatus !== "pb_authorized" && (
              <Pressable
                onPress={() => router.push("/(resident)/verify-id")}
                className="active:opacity-60"
              >
                <View
                  className="flex-row items-center justify-between py-4"
                  style={{ borderTopWidth: 1, borderTopColor: colors.outlineVariant }}
                >
                  <Text className="text-[14px] font-medium" style={{ color: colors.primary }}>
                    I-verify ang Barangay ID
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </View>
              </Pressable>
            )}
          </Card>

          <SectionLabel>Settings</SectionLabel>
          <Card className="px-5 mb-8">
            <AccountRow icon="notifications-outline" label="Notifications" comingSoon />
            <AccountRow icon="help-circle-outline" label="Help & support" comingSoon isLast />
          </Card>

          {/* Back to the native convention - iOS grouped Settings, Gmail,
              WhatsApp all put Sign Out as a full-width row in its own
              grouped section at the bottom, not a shrink-wrapped centered
              button. Full-width gives it a real touch target (Fitts's
              Law - a small centered pill was actually harder to hit
              reliably for a one-way, deliberate action), and keeping it
              in its own Card - separate from Settings, no SectionLabel
              needed since a lone red row is self-evident - still reads
              as visually distinct without switching UI patterns at the
              very end of the screen. */}
          <Card className="px-5 mb-6">
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center py-4 active:opacity-60"
            >
              <Ionicons name="log-out-outline" size={18} color={colors.error} style={{ width: 28 }} />
              <Text className="flex-1 text-[15px] font-medium" style={{ color: colors.error }}>
                Log out
              </Text>
            </Pressable>
          </Card>
        </ScrollView>
      </ScreenBackground>
    </SafeAreaView>
  );
}
