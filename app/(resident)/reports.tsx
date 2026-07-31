import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMyReports, type ReportSummary } from "@/lib/api/mockData";
import { relativeTime } from "@/lib/relativeTime";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";

export default function ReportsScreen() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setReports(await getMyReports());
      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-5 pt-3 pb-5">
        <Text className="text-[24px] font-semibold text-ink tracking-tight">My Reports</Text>
        <Text className="text-[13px] text-ink-faint mt-0.5">{reports.length} total</Text>
      </View>
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
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
          <View className="gap-3 pb-8">
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
