import { KNOWN_STATUSES, type ReportKind, type ReportStatus } from "@/lib/sampleReports";
export type ReportSource = "reports" | "service_complaints" | "pre_blotters" | "notifications";
export type AccountReport = {
  id: string; source: ReportSource; referenceNo: string; category: string; summary: string;
  status: string; createdAt: string; updatedAt: string | null; location: string;
  kind: ReportKind; createdByMe: boolean; assignedToMe: boolean; photoCount: number;
  hearingDate: string | null; hearingCompleted: boolean; noticeMessage?: string; noticeType?: string; noticeTarget?: string; noticeLevel?: string; noticeSender?: string;
};
export function isKnownReportStatus(status: string): status is ReportStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(status);
}
export function isClosedReport(status: string): boolean {
  return ["resolved", "cfa issued", "closed", "completed", "cancelled", "canceled", "rejected"].includes(status.toLowerCase());
}
type Row = Record<string, any>;
export function mapAccountReport(row: Row, source: ReportSource, userId: string): AccountReport | null {
  const createdByMe = row.user_id === userId;
  const assignedToMe = source === "service_complaints" && row.assigned_to === userId;
  if (!userId || (!createdByMe && !assignedToMe)) return null;
  const details = row.full_details && typeof row.full_details === "object" ? row.full_details : {};
  const kind: ReportKind = source === "service_complaints" || details.type === "service_complaint" ? "service_complaint" : "blotter";
  const recordId = source === "service_complaints" ? row.complaint_id : source === "pre_blotters" ? row.blotter_id : row.id;
  if (recordId === null || recordId === undefined) return null;
  return {
    id: String(recordId), source, referenceNo: row.reference_no || "Walang reference number",
    category: details.categoryLabel || row.category || row.incident_type || (kind === "blotter" ? "Blotter report" : "Serbisyo / Kagamitan"),
    summary: row.summary || row.description || details.description || row.remarks || "Buksan upang makita ang detalye.",
    status: typeof row.status === "string" && row.status.trim() ? row.status : "Walang status",
    createdAt: row.created_at || row.submitted_at || "", updatedAt: row.updated_at || null,
    location: row.location || row.location_address || details.location || "", kind, createdByMe, assignedToMe,
    photoCount: Array.isArray(details.photoPaths) ? details.photoPaths.length : row.image_url ? 1 : 0,
    hearingDate: row.hearing_date || null, hearingCompleted: row.hearing_completed === true,
  };
}
export function reportNextStep(report: AccountReport): string {
  if (report.hearingDate && !report.hearingCompleted && !isClosedReport(report.status)) return "May nakatalang hearing. Buksan ang report para sa iskedyul.";
  if (report.assignedToMe && !isClosedReport(report.status)) return "Nakatalaga sa iyo. Buksan upang suriin ang concern.";
  switch (report.status) {
    case "Under Review": return "Nasa pagsusuri. Subaybayan dito ang susunod na status.";
    case "Forwarded": return "Naipasa sa kinauukulan. Hintayin ang susunod na update.";
    case "Investigating": return "Kasalukuyang iniimbestigahan o inaaksyunan.";
    case "Resolved": return "Naresolba na. Buksan para makita ang naitalang detalye.";
    case "CFA Issued": return "Naitala ang CFA Issued. Kumpirmahin sa barangay ang susunod na hakbang.";
    default: return "Buksan ang report para sa detalye at kumpirmahin sa barangay kung may kailangang gawin.";
  }
}
export function reportDate(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Hindi nakatala";
  return date.toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
