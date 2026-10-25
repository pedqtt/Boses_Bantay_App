import { useAuth } from "@/lib/auth-context";
import { scopeAccountQuery } from "@/lib/api/myReports";
import { isKnownReportStatus, reportDate, type ReportSource } from "@/lib/myReports";
import { ReportStatusBadge } from "@/components/reports/ReportStatusBadge";
import { SavedComplaintPhotos } from "@/components/report/SavedComplaintPhotos";
import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/relativeTime";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { StatusPill } from "@/components/StatusPill";
import { ScreenBackground } from "@/components/ScreenBackground";
import { BahagiHeader } from "@/components/report/BahagiHeader";
import { DraftBadge } from "@/components/report/DraftBadge";
import { REVIEW_SECTIONS, getQuestion } from "@/lib/reportQuestions";
import {
  KIND_META,
  STATUS_STEP_INDEX,
  type ReportKind,
  type ReportStatus,
} from "@/lib/sampleReports";
import { colors } from "@/lib/theme";

type ReportDetailData = {
  id: string;
  referenceNo: string;
  status: string;
  category: string;
  kind: ReportKind;
  createdAt: string;
  finalizedAt: string | null;
  isSample: boolean;
  fields: Record<string, string>;
  photoPaths: string[];
  ownerId: string;
  assignedToMe: boolean;
  createdByMe: boolean;
};

// The real barangay pipeline, per the interview documentation - same source
// STATUS_STEP_INDEX (lib/sampleReports.ts) is built from. "Naisumite" is
// always step 0 and always done: a report exists in this list at all only
// because it already has a reference number, which is minted at
// submission, not after any staff action (see report.tsx/service-complaint
// .tsx's handleSubmit - refNo is generated before the insert, matching how
// the paper process issues a ticket the moment something is filed).
//
// `includeSummons` inserts the Katarungang Pambarangay confrontation step
// (RA 7160 - both parties are called before the Lupon/Pangkat Tagapagkasundo
// for mediation) between Investigating and the closing step. This only
// applies to blotter reports where the resident explicitly asked for
// "Summons" as the blotter type (blotterType, reportQuestions.ts) - a
// "Record Only" blotter has no other party being summoned, and a service
// complaint was never a dispute between two people to begin with, so
// neither of those flows should show a step that didn't happen.
function buildSteps(status: ReportStatus, includeSummons: boolean) {
  const closedLabel = status === "CFA Issued" ? "CFA Naisyu" : "Naresolba";
  const closedDesc =
    status === "CFA Issued"
      ? "Hindi nagkasundo sa harapan ng Lupon - nag-isyu ang barangay ng Certificate to File Action (CFA), maaari na itong dalhin sa korte kung kailangan."
      : includeSummons
        ? "Nagkasundo ang dalawang panig sa harapan ng barangay - nalutas na ang inyong report."
        : "Nalutas na ang inyong report. Makikita rin ito sa listahan bilang tapos na.";

  return [
    {
      key: "submitted",
      label: "Naisumite",
      desc: "Natanggap ang inyong report at nabigyan ng reference number.",
    },
    {
      key: "review",
      label: "Sinusuri ng Barangay",
      desc: "Sinusuri ng barangay staff ang detalye bago ito kilalanin bilang opisyal.",
    },
    {
      key: "forwarded",
      label: "Ipinasa sa Kinauukulan",
      desc: "Ipinasa na ang report sa opisyal o tanggapang mangangasiwa nito.",
    },
    {
      key: "investigating",
      label: "Iniimbestigahan",
      desc: "Aktibong iniimbestigahan o inaaksyunan na ang inyong report.",
    },
    ...(includeSummons
      ? [
          {
            key: "summons",
            label: "Pagkikita ng Dalawang Panig",
            desc: "Ipinatawag ang inyong panig at ang kabilang partido para sa usapan/mediation sa harap ng Lupon Tagapamayapa.",
          },
        ]
      : []),
    { key: "closed", label: closedLabel, desc: closedDesc },
  ];
}

function ProgressTimeline({ status, includeSummons }: { status: ReportStatus; includeSummons: boolean }) {
  const steps = buildSteps(status, includeSummons);
  // The summons step is inserted after Investigating (step 3), so once a
  // report actually reaches the closed state, its position in the array
  // shifts one later than STATUS_STEP_INDEX's base pipeline accounts for -
  // Investigating itself stays at index 3 either way, only the final step
  // moves.
  const isClosed = status === "Resolved" || status === "CFA Issued";
  const currentIndex = STATUS_STEP_INDEX[status] + (includeSummons && isClosed ? 1 : 0);

  return (
    <Card className="p-4">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isLast = i === steps.length - 1;
        const dotColor = isDone || isCurrent ? colors.primary : colors.outlineVariant;

        return (
          <View key={step.key} className="flex-row">
            <View className="items-center" style={{ width: 22 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: isCurrent ? 16 : 12,
                  height: isCurrent ? 16 : 12,
                  borderRadius: 999,
                  backgroundColor: isDone ? colors.primary : isCurrent ? "white" : colors.outlineVariant,
                  borderWidth: isCurrent ? 3 : 0,
                  borderColor: colors.primary,
                }}
              >
                {isDone && <Ionicons name="checkmark" size={9} color="white" />}
              </View>
              {!isLast && (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 28,
                    marginTop: 2,
                    backgroundColor: isDone ? colors.primary : colors.outlineVariant,
                  }}
                />
              )}
            </View>
            <View className="flex-1 pb-5" style={{ marginLeft: 10 }}>
              <Text
                className="text-[14px]"
                style={{
                  fontWeight: isCurrent ? "700" : "600",
                  color: isDone || isCurrent ? colors.onSurface : colors.outline,
                }}
              >
                {step.label}
              </Text>
              {(isDone || isCurrent) && (
                <Text className="text-[12.5px] mt-0.5" style={{ color: colors.onSurfaceVariant, lineHeight: 17 }}>
                  {step.desc}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function FieldRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View
      className="py-3"
      style={!isLast ? { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant } : undefined}
    >
      <Text className="text-[11px] font-semibold uppercase text-ink-faint" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text className="text-[14.5px] text-ink mt-1" style={{ lineHeight: 20 }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * The other half of the loop: report.tsx and service-complaint.tsx capture
 * a report, reports.tsx lists it, and this screen is where a resident
 * actually sees what happens to it - every field they gave, plus a real
 * progress timeline instead of a single status word with no context. Two
 * data paths converge on the same rendering below:
 *
 *   Sample ids ("sample-*") resolve from lib/sampleReports.ts - no network
 *   call, so the populated preview in the list is fully explorable too.
 *
 *   Real ids fetch the actual row from `reports`, re-checking `user_id`
 *   against the signed-in resident so this screen can't be used to read
 *   someone else's report just by guessing an id in the URL params.
 *
 * Blotter fields render via REVIEW_SECTIONS/getQuestion from
 * reportQuestions.ts - the exact same field vocabulary and labels the
 * filing flow itself uses, so "what does this field mean" never has to be
 * answered twice in two different places.
 */
export default function ReportDetailScreen() {
  const { id, source: sourceParam } = useLocalSearchParams<{ id: string; source?: string }>();
  const { profile } = useAuth();
  const source: ReportSource = sourceParam === "service_complaints" || sourceParam === "pre_blotters" ? sourceParam : "reports";
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<ReportDetailData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      setData(null);

      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || user.id !== profile?.id) throw Error("Sign in required");
        const key = source === "service_complaints" ? "complaint_id" : source === "pre_blotters" ? "blotter_id" : "id";
        const { data: row, error } = await scopeAccountQuery(supabase.from(source).select("*"), source, user.id).eq(key, id).single();
        if (error || !row || (row.user_id !== user.id && !(source === "service_complaints" && row.assigned_to === user.id))) throw Error("Report not available to this account");
        const kind: ReportKind = source === "service_complaints" || row.full_details?.type === "service_complaint" ? "service_complaint" : "blotter";
        const fullDetails = row.full_details ?? {};
        const fields: Record<string, string> = kind === "service_complaint"
          ? { category: fullDetails.categoryLabel ?? row.category ?? "", location: fullDetails.location ?? row.location ?? row.location_address ?? "", description: fullDetails.description ?? row.description ?? row.summary ?? "" }
          : source === "pre_blotters"
            ? { ...row.complainant_details, ...row.respondent_details, description: row.remarks ?? "", location: row.location_address ?? "" }
            : fullDetails;
        if (!cancelled) {
          setData({
            id: String(row[key]),
            referenceNo: row.reference_no,
            status: row.status,
            category: row.category ?? row.incident_type ?? "Blotter report",
            kind,
            createdAt: row.created_at ?? row.submitted_at,
            finalizedAt: row.finalized_at ?? null,
            isSample: false,
            fields,
            photoPaths: Array.isArray(fullDetails.photoPaths) ? fullDetails.photoPaths : [],
            ownerId: user.id, createdByMe: row.user_id === user.id, assignedToMe: source === "service_complaints" && row.assigned_to === user.id,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error("[report-detail] failed to load report ->", err);
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, source, profile?.id]);

  const kindMeta = data ? KIND_META[data.kind] : null;

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: "#FFFFFF" }}>
      <ScreenBackground backgroundColor="#FAF8F7">
        <View style={{ flex: 1 }}>
          <BahagiHeader
            label={data?.referenceNo ?? "Detalye ng Report"}
            filledSegments={0}
            totalSegments={0}
            onBack={() => router.back()}
          />

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : notFound || !data || data.ownerId !== profile?.id || !kindMeta ? (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="alert-circle-outline" size={28} color={colors.outlineFaint} />
              <Text className="text-[14px] text-ink-faint mt-2 text-center">
                Hindi po namin nahanap ang report na ito.
              </Text>
            </View>
          ) : (
            <ScrollView
              className="flex-1 px-6"
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Hero - what this report is, at a glance. */}
              <Card className="p-4 mb-6">
                <View className="flex-row items-start">
                  <View
                    className="items-center justify-center rounded-full mr-3"
                    style={{ width: 44, height: 44, backgroundColor: kindMeta.bg }}
                  >
                    <Ionicons name={kindMeta.icon} size={20} color={kindMeta.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-[15.5px] font-bold text-ink">{data.category}</Text>
                    <Text className="text-[12px] text-ink-faint mt-0.5">{reportDate(data.createdAt)}</Text>
                  </View>
                  <ReportStatusBadge status={data.status} />
                </View>
                {data.kind === "blotter" && !data.finalizedAt && (
                  <View
                    className="flex-row items-center mt-3.5 pt-3.5"
                    style={{ borderTopWidth: 1, borderTopColor: colors.outlineVariant, gap: 8 }}
                  >
                    <DraftBadge />
                  </View>
                )}
              </Card>

              {/* Progress - the real barangay pipeline, not just a status
                  word with no context for what it means or what's next. */}
              <View className="flex-row flex-wrap mb-5" style={{ gap: 8 }}>
                {data.createdByMe && <Text className="text-brand text-[12px] bg-brand-50 rounded-full px-3 py-2">Ginawa ko</Text>}
                {data.assignedToMe && <Text className="text-brand text-[12px] bg-brand-50 rounded-full px-3 py-2">Nakatalaga sa akin</Text>}
              </View>
              <SectionLabel>Progress</SectionLabel>
              <View className="mb-6">
                {isKnownReportStatus(data.status) ? <ProgressTimeline
                  status={data.status}
                  includeSummons={data.kind === "blotter" && data.fields.blotterType === "Summons"}
                /> : <Card className="p-4"><Text className="text-[14px] text-ink-soft leading-6">Naitalang status: {data.status}. Kumpirmahin sa barangay ang susunod na hakbang.</Text></Card>}
              </View>

              {data.kind === "blotter" && !data.finalizedAt && (
                <View
                  className="flex-row items-start rounded-2xl px-4 py-3 mb-6"
                  style={{ backgroundColor: "#FDECC8" }}
                >
                  <Ionicons name="alert-circle-outline" size={15} color="#92600C" style={{ marginTop: 1 }} />
                  <Text className="text-[12.5px] flex-1 ml-2" style={{ color: "#5C4108", lineHeight: 17 }}>
                    Draft pa lang ito - opisyal lang po ito kapag pumirma kayo mismo sa barangay hall,
                    dala ang inyong ID.
                  </Text>
                </View>
              )}

              {/* Everything captured when this was filed - blotter fields
                  render through the same section/label vocabulary the
                  filing flow itself uses (REVIEW_SECTIONS/getQuestion), so
                  labels here never drift from what the resident actually
                  saw while filing. */}
              {data.kind === "blotter" ? (
                REVIEW_SECTIONS.map((section) => {
                  const rows = section.fields
                    .map((key) => ({ key, label: getQuestion(key).label, value: data.fields[key] }))
                    .filter((row) => row.value && row.value.trim().length > 0);
                  if (rows.length === 0) return null;
                  return (
                    <View key={section.key} className="mb-6">
                      <SectionLabel>{section.shortLabel}</SectionLabel>
                      <Card className="px-4">
                        {rows.map((row, i) => (
                          <FieldRow
                            key={row.key}
                            label={row.label}
                            value={row.value}
                            isLast={i === rows.length - 1}
                          />
                        ))}
                      </Card>
                    </View>
                  );
                })
              ) : (
                <View className="mb-6">
                  <SectionLabel>Detalye ng Reklamo</SectionLabel>
                  <Card className="px-4">
                    <FieldRow label="Uri ng problema" value={data.fields.category ?? ""} />
                    <FieldRow label="Lokasyon" value={data.fields.location ?? ""} />
                    <FieldRow label="Deskripsyon" value={data.fields.description ?? ""} isLast={data.photoPaths.length === 0} />
                  </Card>


                  {data.photoPaths.length > 0 && <SavedComplaintPhotos paths={data.photoPaths} />}
                </View>
              )}

              <Text className={`text-center text-[12px] text-ink-faint`} style={{ lineHeight: 17 }}>
                Gamitin ang {data.referenceNo} kapag pumunta kayo sa barangay hall para sa follow-up.
              </Text>
            </ScrollView>
          )}
        </View>
      </ScreenBackground>
    </SafeAreaView>
  );
}
