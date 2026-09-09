import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/relativeTime";
import { Card } from "@/components/Card";
import { StatusPill } from "@/components/StatusPill";

export type ReportSummary = {
  id: string;
  referenceNo: string;
  category: string;
  summary: string;
  description?: string;
  location?: string;
  imageUrl?: string;
  extraDetails?: Record<string, any>;
  hearingNote?: string;
  outcome?: string;
  status: "Under Review" | "Investigating" | "Resolved";
  createdAt: string;
};

// Helper function to turn raw JSON keys into properly spaced label text
function formatFieldLabel(key: string): string {
  return key
    // Split camelCase (e.g. incidentAt -> incident At)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // Replace underscores and dashes with spaces
    .replace(/[_-]/g, " ")
    // Specific fixes for fused lowercase keys
    .replace(/incidentat/i, "Incident At")
    .replace(/otherparties/i, "Other Parties")
    .replace(/incidentdate/i, "Incident Date")
    .replace(/incidentlocation/i, "Incident Location")
    .trim();
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportSummary | null>(null);
  const isInitialLoad = useRef(true);

  useFocusEffect(
    useCallback(() => {
      async function loadReports() {
        try {
          setLoading(true);

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            setReports([]);
            return;
          }

          const { data, error } = await supabase
            .from("reports")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (error) throw error;

          if (data) {
            const mappedReports: ReportSummary[] = data.map((r) => {
              // Parse full_details JSONB
              let detailsObj: Record<string, any> = {};
              if (r.full_details) {
                if (typeof r.full_details === "string") {
                  try {
                    detailsObj = JSON.parse(r.full_details);
                  } catch {
                    detailsObj = { details: r.full_details };
                  }
                } else if (typeof r.full_details === "object") {
                  detailsObj = r.full_details;
                }
              }

              // Extract main description
              const extractedDescription =
                detailsObj.description ??
                detailsObj.details ??
                detailsObj.text ??
                detailsObj.incident_description ??
                detailsObj.transcript ??
                detailsObj.summary ??
                null;

              // Extract location
              const extractedLocation =
                detailsObj.location ??
                detailsObj.address ??
                detailsObj.purok ??
                detailsObj.landmark ??
                null;

              // Extract image URL
              const extractedImage =
                detailsObj.imageUrl ??
                detailsObj.image_url ??
                detailsObj.photo_url ??
                detailsObj.attachment_url ??
                null;

              // Determine card preview summary
              const rawSummary = r.summary ?? "";
              const displaySummary =
                extractedDescription ||
                (rawSummary !== "Details provided in full report" ? rawSummary : "Report filed");

              const cardSummarySnippet =
                displaySummary.length > 80
                  ? displaySummary.slice(0, 80) + "..."
                  : displaySummary;

              return {
                id: String(r.id),
                referenceNo: r.reference_no ?? `BGY-${r.id}`,
                category: r.category ?? "GENERAL",
                summary: cardSummarySnippet,
                description: extractedDescription || displaySummary,
                location: extractedLocation,
                imageUrl: extractedImage,
                extraDetails: detailsObj,
                hearingNote: r.hearing_note ?? null,
                outcome: r.outcome ?? null,
                status:
                  r.status === "Under Review" ||
                    r.status === "Investigating" ||
                    r.status === "Resolved"
                    ? r.status
                    : "Under Review",
                createdAt: r.created_at,
              };
            });

            setReports(mappedReports);
          }
        } catch (err) {
          console.error("Error fetching reports from Supabase:", err);
        } finally {
          setLoading(false);
          isInitialLoad.current = false;
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
              <Pressable
                key={r.id}
                onPress={() => setSelectedReport(r)}
                className="active:opacity-80"
              >
                <Card className="p-4">
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

                  <Text className="text-[13px] text-ink-soft leading-5" numberOfLines={2}>
                    {r.summary}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Report Details Modal Card */}
      <Modal
        visible={selectedReport !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReport(null)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center px-5"
          onPress={() => setSelectedReport(null)}
        >
          {selectedReport && (
            <Pressable
              className="w-full bg-white rounded-3xl p-6 shadow-xl max-h-[85%]"
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between pb-3 border-b border-gray-100">
                <View>
                  <Text className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                    Report Reference
                  </Text>
                  <Text className="text-[18px] font-bold text-ink mt-0.5">
                    {selectedReport.referenceNo}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedReport(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:opacity-70"
                >
                  <Ionicons name="close" size={18} color="#4B5563" />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                className="mt-4"
                contentContainerStyle={{ paddingBottom: 10 }}
              >
                {/* Category & Status Row */}
                <View className="flex-row items-center justify-between mb-4">
                  <View className="px-3 py-1 bg-gray-100 rounded-full">
                    <Text className="text-[11px] font-medium text-gray-700 uppercase tracking-wide">
                      {selectedReport.category}
                    </Text>
                  </View>
                  <StatusPill status={selectedReport.status} />
                </View>

                {/* Report Details */}
                <View className="mb-4">
                  <Text className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1">
                    Report Details
                  </Text>
                  <Text className="text-[14px] text-ink leading-5">
                    {selectedReport.description}
                  </Text>
                </View>

                {/* Location */}
                {selectedReport.location && (
                  <View className="mb-4 flex-row items-start gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <Ionicons name="location-outline" size={16} color="#4B5563" style={{ marginTop: 2 }} />
                    <View className="flex-1">
                      <Text className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                        Location / Address
                      </Text>
                      <Text className="text-[13px] text-ink font-medium mt-0.5">
                        {selectedReport.location}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Image Attachment */}
                {selectedReport.imageUrl && (
                  <View className="mb-4">
                    <Text className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1.5">
                      Attached Image
                    </Text>
                    <Image
                      source={{ uri: selectedReport.imageUrl }}
                      className="w-full h-44 rounded-xl border border-gray-200"
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* Dynamic Fields from full_details */}
                {selectedReport.extraDetails &&
                  Object.keys(selectedReport.extraDetails).length > 0 && (
                    <View className="mb-4 gap-2.5">
                      {Object.entries(selectedReport.extraDetails).map(([key, val]) => {
                        // Skip already rendered or empty keys
                        if (
                          [
                            "description",
                            "details",
                            "text",
                            "summary",
                            "location",
                            "address",
                            "imageUrl",
                            "image_url",
                          ].includes(key) ||
                          typeof val === "object" ||
                          !val
                        ) {
                          return null;
                        }

                        return (
                          <View
                            key={key}
                            className="bg-gray-50 p-3 rounded-xl border border-gray-100"
                          >
                            <Text className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                              {formatFieldLabel(key)}
                            </Text>
                            <Text className="text-[13px] text-ink font-medium mt-0.5">
                              {String(val)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                {/* Date & Time Filed */}
                <View className="mb-4 flex-row items-start gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <Ionicons name="time-outline" size={16} color="#4B5563" style={{ marginTop: 2 }} />
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                      Date & Time Filed
                    </Text>
                    <Text className="text-[13px] text-ink font-medium mt-0.5">
                      {new Date(selectedReport.createdAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>

                {/* Hearing Note / Barangay Response */}
                {(selectedReport.hearingNote || selectedReport.outcome) && (
                  <View className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 gap-1.5">
                    <View className="flex-row items-center gap-1.5 mb-0.5">
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color="#1D4ED8" />
                      <Text className="text-[11px] font-bold text-brand uppercase tracking-wider">
                        Barangay Response & Updates
                      </Text>
                    </View>
                    {selectedReport.hearingNote && (
                      <Text className="text-[13px] text-ink leading-5">
                        <Text className="font-semibold">Note: </Text>
                        {selectedReport.hearingNote}
                      </Text>
                    )}
                    {selectedReport.outcome && (
                      <Text className="text-[13px] text-ink leading-5">
                        <Text className="font-semibold">Outcome: </Text>
                        {selectedReport.outcome}
                      </Text>
                    )}
                  </View>
                )}
              </ScrollView>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}