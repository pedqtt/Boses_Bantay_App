import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/relativeTime";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";
import { SectionLabel } from "@/components/SectionLabel";
import { PressableScale } from "@/components/PressableScale";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors } from "@/lib/theme";

export type HomeReportSummary = {
  id: string;
  referenceNo: string;
  category: string;
  summary: string;
  status: string;
  createdAt: string;
};

export default function ResidentHome() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<HomeReportSummary[]>([]);
  const [stats, setStats] = useState({ activeReports: 0, resolvedReports: 0 });
  const [loading, setLoading] = useState(true);

  // useFocusEffect automatically fetches the latest data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      async function loadDashboardData() {
        try {
          setLoading(true);

          // 1. Get current logged-in user
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            setReports([]);
            setStats({ activeReports: 0, resolvedReports: 0 });
            return;
          }

          // 2. Fetch all user reports to compute stats & recent items
          const { data, error } = await supabase
            .from("reports")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (error) throw error;

          if (data) {
            // Compute stats dynamically from Supabase records
            const resolvedCount = data.filter((r) => r.status === "Nareselba" || r.status === "Resolved").length;
            const activeCount = data.length - resolvedCount;

            setStats({
              activeReports: activeCount,
              resolvedReports: resolvedCount,
            });

            // Map and get the 3 most recent reports
            const mapped: HomeReportSummary[] = data.slice(0, 3).map((r) => ({
              id: String(r.id),
              referenceNo: r.reference_no,
              category: r.category,
              summary: r.summary,
              status: r.status,
              createdAt: r.created_at,
            }));

            setReports(mapped);
          }
        } catch (err) {
          console.error("Error fetching home dashboard data from Supabase:", err);
        } finally {
          setLoading(false);
        }
      }

      loadDashboardData();
    }, [])
  );

  return (
    <SafeAreaView className="flex-1" edges={["top"]}>
      <ScreenBackground>
      <ScrollView
        className="flex-1 px-5 pt-3"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Greeting Header */}
        <View className="mb-6">
          <Text className="text-[13px] text-ink-faint">Magandang araw,</Text>
          <Text className="text-[28px] font-semibold text-ink tracking-tight">
            <Text className="text-[28px] font-semibold text-ink tracking-tight">
              {profile
                ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "Resident"
                : "Resident"}
            </Text>
          </Text>
        </View>

        {/* Action Button: File a report */}
        <PressableScale onPress={() => router.push("/(resident)/report")}>
          <View className="bg-brand rounded-2xl pl-4 pr-4 py-5 mb-8 flex-row items-center">
            <View className="w-11 h-11 rounded-full bg-white items-center justify-center">
              <Ionicons name="mic" size={20} color={colors.primary} />
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

        {/* Quick Access Shortcuts */}
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

        {/* Real-time Dashboard Stats Card */}
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

        {/* Recent Reports Header */}
        <View className="flex-row items-center justify-between mb-3">
          <SectionLabel>Recent reports</SectionLabel>
          <Pressable onPress={() => router.push("/(resident)/reports")} className="pb-3">
            <Text className="text-[13px] text-brand font-medium">See all</Text>
          </Pressable>
        </View>

        {/* Live Recent Reports Section */}
        {loading ? (
          <Card className="p-8 items-center mb-8">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-[13px] text-ink-faint mt-3">Naglo-load...</Text>
          </Card>
        ) : reports.length === 0 ? (
          <Card className="p-8 items-center mb-8">
            <Ionicons name="document-text-outline" size={32} color={colors.outlineFaint} />
            <Text className="text-[15px] font-semibold text-ink mt-2">Wala pang ulat</Text>
            <Text className="text-[12px] text-ink-faint text-center mt-1">
              Ang mga ulat na inyong isasampa ay lalabas dito.
            </Text>
          </Card>
        ) : (
          <View className="gap-3 mb-8">
            {reports.map((r) => (
              <Card key={r.id} className="p-4">
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="font-semibold text-ink text-[15px]">{r.referenceNo}</Text>
                  {/* FIX 1: Type cast status */}
                  <StatusPill status={r.status as any} />
                </View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] text-ink-faint uppercase tracking-wide">{r.category}</Text>
                  {/* FIX 2: Convert date string to Date object */}
                  <Text className="text-[11px] text-ink-faint">{relativeTime(r.createdAt)}</Text>
                </View>
                <Text className="text-[13px] text-ink-soft leading-5">{r.summary}</Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
    </SafeAreaView>
  );
}