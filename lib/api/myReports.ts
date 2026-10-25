import type { SupabaseClient } from "@supabase/supabase-js";
import { mapAccountReport, type AccountReport, type ReportSource } from "@/lib/myReports";
export function scopeAccountQuery(query: any, source: ReportSource, userId: string) {
  // Only UUIDs from the authenticated session may be interpolated into PostgREST filters.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw Error("Invalid report account");
  return source === "service_complaints" ? query.or(`user_id.eq.${userId},assigned_to.eq.${userId}`) : query.eq("user_id", userId);
}
export async function fetchAccountReports(client: SupabaseClient, userId: string): Promise<{ reports: AccountReport[]; warnings: string[] }> {
  const sources: ReportSource[] = ["reports", "service_complaints", "pre_blotters"];
  const results = await Promise.allSettled(sources.map(async source => {
    const { data, error } = await scopeAccountQuery(client.from(source).select("*"), source, userId)
      .order(source === "pre_blotters" ? "submitted_at" : "created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => mapAccountReport(row, source, userId)).filter((row: AccountReport | null): row is AccountReport => row !== null);
  }));
  const reports: AccountReport[] = [], warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") reports.push(...result.value);
    else { warnings.push(sources[index]); console.warn("[my-reports] source unavailable", { source: sources[index], code: result.reason?.code }); }
  });
  if (warnings.length === sources.length) throw Error("Hindi ma-load ang mga report. Pakisubukan muli.");
  return { reports: reports.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)), warnings };
}
