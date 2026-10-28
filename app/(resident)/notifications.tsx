import { liveDataCache } from "@/lib/live-data-cache";
import { ReportNotifications } from "@/components/reports/ReportNotifications";
import { useAuth } from "@/lib/auth-context";
import type { AccountReport } from "@/lib/myReports";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { fetchAccountReports } from "@/lib/api/myReports";
import { fetchResidentNotices } from "@/lib/api/residentNotifications";

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const [dataOwner, setDataOwner] = useState(profile?.id ?? "");
  const [reports, setReports] = useState<AccountReport[]>(() => liveDataCache.accounts.get(profile?.id ?? "")?.reports ?? []);
  const [notices, setNotices] = useState<AccountReport[]>(() => liveDataCache.accounts.get(profile?.id ?? "")?.notices ?? []);
  const [loading, setLoading] = useState(!liveDataCache.accounts.has(profile?.id ?? ""));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const loadedOwner = useRef<string | null>(null);
  const load = useCallback(async (manual = false) => {
    setRefreshing(manual); if (!manual) setLoading(true); setError("");
    try {
      if (!isSupabaseConfigured || !supabase || !profile?.id) throw Error("Mag-sign in muli upang makita ang notifications.");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || user?.id !== profile.id) throw Error("Mag-sign in muli upang makita ang notifications.");
      const [reportResult, noticeResult] = await Promise.allSettled([fetchAccountReports(supabase, user.id), fetchResidentNotices(supabase, user.id)]);
      if (reportResult.status === "rejected" && noticeResult.status === "rejected") throw Error("Hindi ma-load ang notifications. Pakisubukan muli.");
      const nextReports = reportResult.status === "fulfilled" ? reportResult.value.reports : [];
      const nextNotices = noticeResult.status === "fulfilled" ? noticeResult.value : [];
      setDataOwner(user.id); setReports(nextReports); setNotices(nextNotices);
      liveDataCache.accounts.set(user.id, { reports: nextReports, notices: nextNotices, partial: reportResult.status === "rejected" || noticeResult.status === "rejected" });
      setPartial(reportResult.status === "rejected" || noticeResult.status === "rejected" || (reportResult.status === "fulfilled" && reportResult.value.warnings.length > 0));
    } catch (cause) { setReports([]); setNotices([]); setError(cause instanceof Error ? cause.message : "Hindi ma-load ang notifications."); }
    finally { loadedOwner.current = profile?.id ?? null; setLoading(false); setRefreshing(false); }
  }, [profile?.id]);
  useFocusEffect(useCallback(() => {
    if (loadedOwner.current !== profile?.id || !liveDataCache.accounts.has(profile?.id ?? "")) void load();
    if (!supabase || !profile?.id) return;
    const changed = () => { void load(); };
    const channel = supabase.channel(`notifications-live-${profile.id}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, changed).on("postgres_changes", { event: "*", schema: "public", table: "reports" }, changed).on("postgres_changes", { event: "*", schema: "public", table: "service_complaints" }, changed).on("postgres_changes", { event: "*", schema: "public", table: "pre_blotters" }, changed).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, profile?.id]));
  return <ReportNotifications page owner={profile?.id ?? ""} reports={dataOwner === profile?.id ? reports : []} notices={dataOwner === profile?.id ? notices : []} loading={loading} error={error} partial={partial} refreshing={refreshing} refresh={() => load(true)} />;
}
