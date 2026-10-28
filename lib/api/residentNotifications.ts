import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountReport } from "@/lib/myReports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX = /^\[([^|]+)\|([^\]]+)\]\s*/;
const RESIDENT_TARGETS = new Set(["Lahat ng Residente", "System-wide Broadcast"]);

export async function fetchResidentNotices(client: SupabaseClient, userId: string): Promise<AccountReport[]> {
  if (!UUID.test(userId)) throw new Error("Invalid notification account");
  const query = (columns: string) => client.from("notifications")
    .select(columns)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);
  let { data, error } = await query("id,user_id,title,message,notification_type,created_at,sender:users!sent_by(first_name,last_name)");
  if (error) {
    // Sender profiles may be hidden by RLS. Keep the notice and label its sender as unknown.
    const fallback = await query("id,user_id,title,message,notification_type,created_at");
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: number; user_id: string | null; title: string; message: string;
    notification_type: string | null; created_at: string | null;
    sender?: { first_name?: string | null; last_name?: string | null } | Array<{ first_name?: string | null; last_name?: string | null }> | null;
  }>;
  return rows.flatMap((row): AccountReport[] => {
    const match = typeof row.title === "string" ? row.title.match(PREFIX) : null;
    const target = match?.[1]?.trim();
    // The admin portal stores broadcast targeting in the title until the DB has a target column.
    if (row.user_id !== userId && (!target || !RESIDENT_TARGETS.has(target))) return [];
    const title = (match ? row.title.replace(PREFIX, "") : row.title)?.trim() || "Abiso ng barangay";
    const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
    const senderName = [sender?.first_name, sender?.last_name].filter(Boolean).join(" ").trim();
    return [{
      id: String(row.id), source: "notifications", referenceNo: "", category: title,
      summary: row.message, noticeMessage: row.message, noticeType: row.notification_type || "Hindi nakatala",
      noticeTarget: target || (row.user_id === userId ? "Para sa iyo" : "Hindi nakatala"),
      noticeLevel: match?.[2]?.trim() || "Hindi nakatala", noticeSender: senderName || "Hindi nakatala",
      status: "", createdAt: row.created_at || "", updatedAt: null, location: "",
      kind: "blotter", createdByMe: false, assignedToMe: false, photoCount: 0,
      hearingDate: null, hearingCompleted: false,
    }];
  });
}
