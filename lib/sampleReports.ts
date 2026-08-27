// Shared between reports.tsx (the list) and report-detail.tsx (the detail
// page) so a tap on a sample card in the list resolves to the exact same
// fake record in the detail screen - one source of truth instead of two
// screens quietly drifting out of sync with each other's fake data.
import type { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

export const KNOWN_STATUSES = ["Under Review", "Forwarded", "Investigating", "Resolved", "CFA Issued"] as const;
export type ReportStatus = (typeof KNOWN_STATUSES)[number];

// Which broad flow filed this - drives the icon/tint on each card so a
// resident scanning a mixed list can tell a neighbor dispute from a broken
// streetlight without reading the category text first. Same tint pairing
// ChooseReportTypeScreen already established (blue for blotter, the
// existing amber "in progress" tone for service complaints) - reused, not
// reinvented.
export type ReportKind = "blotter" | "service_complaint";

export const KIND_META: Record<ReportKind, { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> = {
  blotter: { icon: "people-outline", bg: colors.primaryContainer, fg: colors.primary },
  service_complaint: { icon: "construct-outline", bg: "#FDECC8", fg: "#92600C" },
};

// Under Review/Forwarded/Investigating still need the resident's attention
// or a barangay response; Resolved/CFA Issued are closed matters.
export const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["Under Review", "Forwarded", "Investigating"]);

// The real barangay pipeline a report actually moves through, per the
// interview documentation (Blotter Flow Redesign Plan.md, POST_BLOTTER_STEPS
// in reportQuestions.ts): submitted as a draft -> reviewed by barangay staff
// -> forwarded to whoever handles it -> actively investigated -> closed,
// either as Resolved or with a CFA (Certificate to File Action) issued if it
// escalates beyond what the barangay can settle. Five fixed stops, not an
// open-ended list - this is what report-detail.tsx's progress timeline
// walks a resident through.
export const STATUS_STEP_INDEX: Record<ReportStatus, number> = {
  "Under Review": 1,
  Forwarded: 2,
  Investigating: 3,
  Resolved: 4,
  "CFA Issued": 4,
};

export type ReportSummary = {
  id: string;
  referenceNo: string;
  category: string;
  summary: string;
  status: ReportStatus;
  createdAt: string;
  kind: ReportKind;
  /** Null/undefined until a staff member finalizes the printed, signed
   *  blotter — the resident-facing "Draft" badge stays up until then. This
   *  column doesn't exist in the DB yet (no staff-facing UI writes it), so
   *  every report reads as a draft by default, which is the correct state
   *  until that exists. */
  finalizedAt: string | null;
  /** Only ever true for SAMPLE_REPORTS below - never set from real data. */
  isSample?: boolean;
};

// Shown ONLY when a resident has zero real reports - a populated preview of
// what the list (and, on tap, the detail page) looks like in actual use,
// instead of a bare "no reports yet" state. Explicitly marked as sample on
// every card and in a banner up top so nobody mistakes fake entries for a
// real filing history.
export const SAMPLE_REPORTS: ReportSummary[] = [
  {
    id: "sample-1",
    referenceNo: "BGY-241087",
    category: "Ingay sa Paligid",
    summary: "Malakas na videoke tuwing gabi mula sa kapitbahay, halos hatinggabi na natatapos.",
    status: "Investigating",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    kind: "blotter",
    finalizedAt: null,
    isSample: true,
  },
  {
    id: "sample-2",
    referenceNo: "BGY-238812",
    category: "Sirang Ilaw sa Poste",
    summary: "Hindi na sumisindi ang ilaw sa poste malapit sa basketball court simula nung isang linggo.",
    status: "Forwarded",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    kind: "service_complaint",
    finalizedAt: null,
    isSample: true,
  },
  {
    id: "sample-3",
    referenceNo: "BGY-235544",
    category: "Bukas na Kanal / Manhole",
    summary: "Bukas na manhole sa tapat ng Blk 5, delikado lalo na sa gabi.",
    status: "Under Review",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    kind: "service_complaint",
    finalizedAt: null,
    isSample: true,
  },
  {
    id: "sample-4",
    referenceNo: "BGY-229901",
    category: "Away sa Kapitbahay",
    summary: "Sigalot tungkol sa hangganan ng bakod, humingi ng tulong para sa maayos na usapan.",
    status: "Resolved",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    kind: "blotter",
    finalizedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    isSample: true,
  },
];

// Full field breakdown per sample - what report-detail.tsx renders. Blotter
// entries use the same ReportFieldKey vocabulary (lib/reportQuestions.ts)
// the real flow writes into `full_details`, so the detail screen's
// field-label lookup (getQuestion(key).label) works identically on sample
// and real data instead of needing a separate rendering path.
export const SAMPLE_REPORT_DETAILS: Record<string, Record<string, string>> = {
  "sample-1": {
    complainantName: "Maria Santos",
    complainantAddress: "Blk 7 Lot 3, Purok 2",
    complainantContact: "0917 234 5678",
    respondentName: 'Rodrigo "Mang Rudy" Cruz',
    incidentAt: "Kagabi, mga alas-11:00 ng gabi",
    location: "Sa bahay ng kapitbahay, Purok 2",
    description:
      "Malakas na videoke tuwing gabi mula sa kapitbahay, halos hatinggabi na natatapos. Pangatlong beses na ito ngayong buwan kahit paulit-ulit nang pinakiusapan.",
    witnesses: "Ilang kapitbahay sa parehong kalye",
    evidence: "Video recording ng ingay mula sa cellphone",
    blotterType: "Record Only",
    incidentCategory: "Ingay / Disturbance",
    requestCctv: "Hindi",
  },
  "sample-2": {
    category: "Sirang Ilaw sa Poste",
    location: "Malapit sa basketball court, Purok 4",
    description:
      "Hindi na sumisindi ang ilaw sa poste malapit sa basketball court simula nung isang linggo. Madilim na sa gabi, delikado lalo na para sa mga naglalakad.",
  },
  "sample-3": {
    category: "Bukas na Kanal / Manhole",
    location: "Tapat ng Blk 5",
    description:
      "Bukas na manhole sa tapat ng Blk 5, delikado lalo na sa gabi. May mga batang naglalaro rin malapit dito.",
  },
  "sample-4": {
    complainantName: "Josefina Reyes",
    complainantAddress: "Blk 2 Lot 9, Purok 1",
    complainantContact: "0918 555 1234",
    respondentName: "Antonio Bautista",
    incidentAt: "2 linggo na ang nakalipas",
    location: "Hangganan ng bakod, Blk 2",
    description:
      "Sigalot tungkol sa hangganan ng bakod sa pagitan ng dalawang bahay. Humingi ng tulong ang nagreklamo para sa maayos na usapan sa halip na lalong lumaki ang gulo.",
    witnesses: "",
    evidence: "",
    blotterType: "Summons",
    incidentCategory: "Alitan sa Ari-arian",
    requestCctv: "Hindi",
  },
};
