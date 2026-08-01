import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { getMyReports, getDashboardStats, type ReportSummary } from "@/lib/api/mockData";
import { relativeTime } from "@/lib/relativeTime";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";
import { SectionLabel } from "@/components/SectionLabel";
import { PressableScale } from "@/components/PressableScale";

export default function ResidentHome() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [stats, setStats] = useState({ activeReports: 0, resolvedReports: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, s] = await Promise.all([getMyReports(), getDashboardStats()]);
      setReports(r.slice(0, 3));
      setStats(s);
      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1 px-5 pt-3"
        showsVerticalScrollIndicator={false}
        // The floating Bot button lives outside this screen (rendered by
        // the tab layout as an absolute overlay), so nothing here knows
        // about it by default — without this, the last "Recent reports"
        // card can scroll to sit directly underneath it. Reserves enough
        // bottom space that content always ends above where the button
        // floats, instead of the button covering whatever happens to
        // scroll to the bottom.
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Orientation only — small and quiet so it doesn't compete with
            the primary action directly below it. */}
        <View className="mb-6">
          <Text className="text-[13px] text-ink-faint">Magandang araw,</Text>
          <Text className="text-[22px] font-semibold text-ink tracking-tight">
            {profile?.fullName ?? "Resident"}
          </Text>
        </View>

        {/* One control, one job: get the resident into the report flow.
            Icon + label + chevron in one row, one short caption below —
            still the only colored, filled surface on the screen, so it
            doesn't need size or a paragraph to win the eye. 44px icon
            badge matches the minimum touch target used elsewhere (e.g.
            the directory's call button). */}
        <PressableScale onPress={() => router.push("/(resident)/report")}>
          <View className="bg-brand rounded-2xl pl-4 pr-4 py-5 mb-8 flex-row items-center">
            <View className="w-11 h-11 rounded-full bg-white items-center justify-center">
              <Ionicons name="mic" size={19} color="#1D4ED8" />
            </View>
            <View className="flex-1 ml-3.5">
              <Text className="text-white font-semibold text-[16px] tracking-tight">
                File a report
              </Text>
              <Text className="text-white/70 text-[12px] mt-0.5">Voice recording, about 2 minutes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" style={{ marginLeft: 8 }} />
          </View>
        </PressableScale>

        {/* Quick access: three shortcuts, one datapoint each (icon +
            label, nothing more) — deliberately the lightest cards on the
            screen so they don't compete with the report cards below for
            attention. These were pulled off Home earlier for duplicating
            the tab bar; back now because they cover things the tab bar
            doesn't make obvious at a glance from Home (ask the bot,
            call for help, check ID status), not because they repeat it. */}
        <SectionLabel>Quick access</SectionLabel>
        <View className="flex-row gap-3 mb-8">
          <View className="flex-1">
            <PressableScale onPress={() => router.push("/(resident)/bot")}>
              <Card className="items-center py-4 px-2">
                <View className="w-11 h-11 rounded-full bg-brand items-center justify-center mb-2">
                  <Ionicons name="chatbubble-ellipses-outline" size={19} color="white" />
                </View>
                <Text className="text-[12px] font-medium text-ink text-center">Ask the Bot</Text>
              </Card>
            </PressableScale>
          </View>
          <View className="flex-1">
            <PressableScale onPress={() => router.push("/(resident)/directory")}>
              <Card className="items-center py-4 px-2">
                <View className="w-11 h-11 rounded-full bg-alert items-center justify-center mb-2">
                  <Ionicons name="call-outline" size={19} color="white" />
                </View>
                <Text className="text-[12px] font-medium text-ink text-center">Emergency</Text>
              </Card>
            </PressableScale>
          </View>
          <View className="flex-1">
            <PressableScale onPress={() => router.push("/(resident)/profile")}>
              <Card className="items-center py-4 px-2">
                <View className="w-11 h-11 rounded-full bg-brand items-center justify-center mb-2">
                  <Ionicons name="card-outline" size={19} color="white" />
                </View>
                <Text className="text-[12px] font-medium text-ink text-center">Barangay ID</Text>
              </Card>
            </PressableScale>
          </View>
        </View>

        {/* Numerals carry the hierarchy on their own — no icon badges. A
            gray circle next to every number is the one visual cliché this
            screen doesn't need twice (the quick access row above already
            owns that treatment). One data unit (report counts), one card
            with an internal rule — not two competing surfaces. */}
        <Card className="flex-row p-5 mb-8">
          <View className="flex-1">
            <Text
              className="text-[26px] font-bold text-ink leading-8 tracking-tight"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {stats.activeReports}
            </Text>
            <Text className="text-[12px] text-ink-faint mt-0.5">Active reports</Text>
          </View>
          <View className="w-px bg-gray-200" />
          <View className="flex-1 pl-5">
            <Text
              className="text-[26px] font-bold text-ink leading-8 tracking-tight"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {stats.resolvedReports}
            </Text>
            <Text className="text-[12px] text-ink-faint mt-0.5">Resolved</Text>
          </View>
        </Card>

        <View className="flex-row items-center justify-between mb-3">
          <SectionLabel>Recent reports</SectionLabel>
          <Pressable onPress={() => router.push("/(resident)/reports")} className="pb-3">
            <Text className="text-[13px] text-brand font-medium">See all</Text>
          </Pressable>
        </View>

        {/* All three states (loading / empty / populated) share the same
            Card framing so the screen doesn't visually jump depending on
            data state. */}
        {loading ? (
          <Card className="p-8 items-center mb-8">
            <ActivityIndicator color="#1D4ED8" />
          </Card>
        ) : reports.length === 0 ? (
          <Card className="p-5 items-center mb-8">
            <Text className="text-[14px] text-ink-faint text-center">
              No reports yet. Anything you file will show up here.
            </Text>
          </Card>
        ) : (
          // Top zone: reference no. (primary identifier) + status (label).
          // Middle zone: category (tertiary) + one-line summary (secondary).
          <View className="gap-3 mb-8">
            {reports.map((r) => (
              <Card key={r.id} className="p-4">
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="font-semibold text-ink text-[15px]">{r.referenceNo}</Text>
                  <StatusPill status={r.status} />
                </View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] text-ink-faint uppercase tracking-wide">{r.category}</Text>
                  <Text className="text-[11px] text-ink-faint">{relativeTime(r.createdAt)}</Text>
                </View>
                <Text className="text-[13px] text-ink-soft leading-5">{r.summary}</Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
