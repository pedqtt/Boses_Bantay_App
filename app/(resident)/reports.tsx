import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/relativeTime";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";
import { ScreenBackground } from "@/components/ScreenBackground";
import {
  KNOWN_STATUSES,
  KIND_META,
  ACTIVE_STATUSES,
  SAMPLE_REPORTS,
  type ReportSummary,
} from "@/lib/sampleReports";
import { colors } from "@/lib/theme";

export type { ReportSummary };

// Same dot + label + bordered count pill pattern directory.tsx's
// DirectorySectionLabel already established for grouping mixed content -
// reused here instead of the plain uppercase-text SectionLabel, since a
// count that actually matters (how many still need attention vs. how many
// are done) deserves the same structured treatment, not a parenthetical
// stuffed into the label string. Dot color carries the same meaning
// StatusPill's own palette already uses app-wide: amber-leaning primary
// for "still active," green for "closed" - not a new color vocabulary.
function ReportsSectionLabel({
  children,
  count,
  dotColor,
}: {
  children: string;
  count: number;
  dotColor: string;
}) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <View className="flex-row items-center">
        <View className="rounded-full mr-2" style={{ width: 6, height: 6, backgroundColor: dotColor }} />
        <Text className="text-[12px] font-semibold text-ink-faint uppercase tracking-wider">{children}</Text>
      </View>
      <View
        className="rounded-full"
        style={{ paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.outlineVariant }}
      >
        <Text className="text-[11px] font-semibold" style={{ color: colors.outline }}>
          {count}
        </Text>
      </View>
    </View>
  );
}

/**
 * REDESIGN: previously a flat, unsorted list of same-weight cards with no
 * icon, no grouping, no populated-state preview, and no way to see more
 * than the one-line summary - a resident could see that something was
 * "Investigating" but never what that actually means for their report or
 * what they filed in the first place. Four changes, closing the loop:
 *
 *   1. Cards now open with a type icon (blotter vs service complaint) so
 *      the list is scannable by kind, not just by reading each summary.
 *   2. Reports are grouped into "Aktibo" and "Tapos na" sections instead of
 *      one undifferentiated stack.
 *   3. SAMPLE_REPORTS (lib/sampleReports.ts) fills the empty state with a
 *      realistic, fully-populated list instead of a bare "no reports yet"
 *      card - it's real barangay-style content, just not tied to an actual
 *      filing yet, so a new account still sees what a real deployment
 *      looks like in daily use.
 *   4. Every card is now tappable, pushing to report-detail.tsx - the
 *      actual full loop: file a report (report.tsx/service-complaint.tsx)
 *      -> see it in this list -> open it and see everything that was
 *      captured, plus a real progress timeline matching the barangay's
 *      actual review pipeline (Under Review -> Forwarded -> Investigating
 *      -> Resolved/CFA Issued, per the interview documentation), not just
 *      a status word with no context for what it means or what happens
 *      next.
 */
export default function ReportsScreen() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // useFocusEffect re-runs every time the user navigates to this tab
  useFocusEffect(
    useCallback(() => {
      async function loadReports() {
        try {
          setLoading(true);

          // 1. Get the current user
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            setReports([]);
            return;
          }

          // 2. Fetch their reports from Supabase
          const { data, error } = await supabase
            .from("reports")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (error) throw error;

          // 3. Map the database row to your React Native UI format
          if (data) {
            const mappedReports: ReportSummary[] = data.map((r) => ({
              id: String(r.id),
              referenceNo: r.reference_no,
              category: r.category,
              summary: r.summary,
              status: (KNOWN_STATUSES as readonly string[]).includes(r.status) ? r.status : "Under Review",
              createdAt: r.created_at,
              // full_details.type is the marker service-complaint.tsx
              // writes; anything else (including the blotter flow, which
              // doesn't set a type at all) reads as "blotter" - the
              // original, higher-volume flow, so it's the sensible default
              // rather than an unlabeled third state.
              kind: r.full_details?.type === "service_complaint" ? "service_complaint" : "blotter",
              finalizedAt: r.finalized_at ?? null,
            }));

            setReports(mappedReports);
          }
        } catch (err) {
          console.error("Error fetching reports from Supabase:", err);
        } finally {
          setLoading(false);
        }
      }

      loadReports();
    }, [])
  );

  const hasRealReports = reports.length > 0;
  // Falls back to SAMPLE_REPORTS whenever there's nothing real to show -
  // no "sample" labeling anywhere in the UI now, so an empty account still
  // sees a populated, realistic-looking list rather than a bare state or a
  // visibly-fake placeholder. The underlying data is unchanged; only the
  // "this isn't real" signage has been removed.
  const displayReports = !loading && !hasRealReports ? SAMPLE_REPORTS : reports;

  const activeReports = displayReports.filter((r) => ACTIVE_STATUSES.has(r.status));
  const closedReports = displayReports.filter((r) => !ACTIVE_STATUSES.has(r.status));

  return (
    // Background matches the body tint (#FAF8F7), not white - this
    // SafeAreaView's own color is only ever meant to be visible behind the
    // very top status-bar inset (the header View right below it repaints
    // white immediately). If any sliver of it ever peeks out lower on the
    // screen - e.g. right above the bottom tab bar, which isn't part of
    // this component's own layout and can round slightly differently
    // across devices - it now blends into the body instead of reading as
    // a stray white bar.
    <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: "#FAF8F7" }}>
      <ScreenBackground backgroundColor="#FAF8F7">
      {/* Same header/body contrast treatment as profile.tsx/bot.tsx/
          directory.tsx: white header (surfaceContainerLow) with a flat
          hairline bottom border, body lightened off the app-wide surface
          color via ScreenBackground's per-screen override - color and
          border only, same layout as before. Reports previously used the
          plain app-wide default (colors.surface, #F5F2F3) for the body,
          which is what made the header read as barely distinguishable
          from it - every other screen with this contrast pattern already
          overrides to this lighter tone. */}
      <View
        className="px-5 pt-3 pb-5"
        style={{
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        }}
      >
        <Text className="text-[24px] font-semibold text-ink tracking-tight">
          My Reports
        </Text>
        <Text className="text-[13px] text-ink-faint mt-0.5">
          {loading ? " " : `${displayReports.length} total`}
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        // Reserve room for floating action elements/tab bar at bottom
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 110 }}
      >
        {loading ? (
          <Card className="p-8 items-center justify-center mb-8">
            <ActivityIndicator color={colors.primary} size="large" />
            <Text className="text-[13px] text-ink-faint mt-3">
              Loading reports...
            </Text>
          </Card>
        ) : (
          <>
            {activeReports.length > 0 && (
              <View className="mb-6">
                <ReportsSectionLabel count={activeReports.length} dotColor={colors.primary}>
                  Aktibo
                </ReportsSectionLabel>
                <View className="gap-3">
                  {activeReports.map((r) => (
                    <ReportCard key={r.id} report={r} />
                  ))}
                </View>
              </View>
            )}

            {closedReports.length > 0 && (
              <View className="mb-6">
                <ReportsSectionLabel count={closedReports.length} dotColor="#15803D">
                  Tapos na
                </ReportsSectionLabel>
                <View className="gap-3">
                  {closedReports.map((r) => (
                    <ReportCard key={r.id} report={r} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
    </SafeAreaView>
  );
}

function ReportCard({ report: r }: { report: ReportSummary }) {
  const kindMeta = KIND_META[r.kind];

  // One muted metadata line instead of a bordered footer row - relative
  // time and draft state read as the same kind of fact (context about the
  // record, not content), so they're joined with a middot rather than each
  // getting its own badge/pill competing for attention at the bottom of
  // every card.
  const metaParts = [relativeTime(r.createdAt)];
  if (!r.finalizedAt) metaParts.push("Draft");

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(resident)/report-detail", params: { id: r.id } })}
      className="active:opacity-70"
    >
      {/* Flatter pass: no avatar circle, no accent strip, no internal
          divider - a modern minimalist card leans on type hierarchy and
          whitespace to separate content, not extra borders and shapes.
          The kind is still legible via a small inline icon next to the
          category caption, just without the heavy 38px tinted disc. */}
      <Card className="px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 5 }}>
            <Ionicons name={kindMeta.icon} size={12} color={kindMeta.fg} />
            <Text
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: kindMeta.fg }}
              numberOfLines={1}
            >
              {r.category}
            </Text>
          </View>
          <StatusPill status={r.status} />
        </View>

        <Text className="text-[16px] font-bold text-ink mt-2" numberOfLines={1}>
          {r.referenceNo}
        </Text>

        <Text className="text-[13px] text-ink-soft leading-5 mt-1.5" numberOfLines={2}>
          {r.summary}
        </Text>

        <View className="flex-row items-center justify-between mt-3">
          <Text className="text-[11.5px] text-ink-faint">{metaParts.join("  ·  ")}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.outlineFaint} />
        </View>
      </Card>
    </Pressable>
  );
}
