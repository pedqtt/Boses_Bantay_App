import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/relativeTime";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";

export type ReportSummary = {
  id: string;
  referenceNo: string;
  category: string;
  summary: string;
  status: "Under Review" | "Investigating" | "Resolved";
  createdAt: string;
};

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
              status:
                r.status === "Under Review" ||
                r.status === "Investigating" ||
                r.status === "Resolved"
                  ? r.status
                  : "Under Review",
              createdAt: r.created_at,
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

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-5 pt-3 pb-5">
        <Text className="text-[24px] font-semibold text-ink tracking-tight">
          My Reports
        </Text>
        <Text className="text-[13px] text-ink-faint mt-0.5">
          {reports.length} total
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        // Reserve room for floating action elements/tab bar at bottom
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {loading ? (
          <Card className="p-8 items-center justify-center mb-8">
            <ActivityIndicator color="#1D4ED8" size="large" />
            <Text className="text-[13px] text-ink-faint mt-3">
              Loading reports...
            </Text>
          </Card>
        ) : reports.length === 0 ? (
          <Card className="p-6 items-center justify-center mb-8">
            <Text className="text-[15px] font-semibold text-ink mb-1">
              No reports yet
            </Text>
            <Text className="text-[13px] text-ink-faint text-center">
              Anything you file will show up here along with real-time status updates.
            </Text>
          </Card>
        ) : (
          <View className="gap-3 pb-8">
            {reports.map((r) => (
              <Card key={r.id} className="p-4">
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="font-semibold text-ink text-[15px]">
                    {r.referenceNo}
                  </Text>
                  <StatusPill status={r.status} />
                </View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] text-ink-faint uppercase tracking-wide">
                    {r.category}
                  </Text>
                  <Text className="text-[11px] text-ink-faint">
                    {relativeTime(r.createdAt)}
                  </Text>
                </View>
                <Text className="text-[13px] text-ink-soft leading-5">
                  {r.summary}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}