// Fake data for the resident dashboard until the real API exists.
// Swap the functions here for real fetch()/supabase calls later —
// screens only ever import from lib/api/*, never touch this shape directly.

export type ReportSummary = {
  id: string;
  referenceNo: string;
  category: "Dispute" | "Incident" | "Service Complaint";
  status: "Under Review" | "Investigating" | "Resolved";
  createdAt: string;
  summary: string;
};

export type EmergencyContact = {
  id: string;
  name: string;
  role: string;
  phone: string;
  // True life/limb emergencies (fire, police) surface first and get the
  // reserved alert accent. Everything else (barangay hall, health center,
  // tanod) is routine business and stays neutral, even though it's still
  // useful to have on hand.
  urgent: boolean;
};

export type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MOCK_REPORTS: ReportSummary[] = [
  {
    id: "r1",
    referenceNo: "BB-2026-0142",
    category: "Dispute",
    status: "Investigating",
    createdAt: "2026-07-24T10:12:00Z",
    summary: "Noise complaint against neighbor, Purok 3",
  },
  {
    id: "r2",
    referenceNo: "BB-2026-0119",
    category: "Incident",
    status: "Resolved",
    createdAt: "2026-07-18T08:30:00Z",
    summary: "Fallen electric post near basketball court",
  },
  {
    id: "r3",
    referenceNo: "BB-2026-0098",
    category: "Service Complaint",
    status: "Under Review",
    createdAt: "2026-07-10T14:05:00Z",
    summary: "Delayed response on drainage cleaning request",
  },
];

const MOCK_CONTACTS: EmergencyContact[] = [
  { id: "c3", name: "BFP Milagrosa", role: "Fire emergency", phone: "911", urgent: true },
  { id: "c5", name: "PNP Station 5", role: "Police emergency", phone: "117", urgent: true },
  { id: "c1", name: "Barangay Hall", role: "General assistance", phone: "(02) 8123 4567", urgent: false },
  { id: "c2", name: "Barangay Tanod", role: "Peace and order", phone: "0917 123 4567", urgent: false },
  { id: "c4", name: "Barangay Health Center", role: "Medical assistance", phone: "0918 765 4321", urgent: false },
];

// Investigating (needs attention) surfaces first, then Under Review
// (queued), Resolved (done) last — regardless of how the array happens to
// be ordered. Within the same status, most recent first.
const STATUS_PRIORITY: Record<ReportSummary["status"], number> = {
  Investigating: 0,
  "Under Review": 1,
  Resolved: 2,
};

export async function getMyReports(): Promise<ReportSummary[]> {
  await delay(400);
  return [...MOCK_REPORTS].sort((a, b) => {
    const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (byStatus !== 0) return byStatus;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function getDashboardStats() {
  await delay(200);
  return {
    activeReports: MOCK_REPORTS.filter((r) => r.status !== "Resolved").length,
    resolvedReports: MOCK_REPORTS.filter((r) => r.status === "Resolved").length,
  };
}

export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  await delay(300);
  return MOCK_CONTACTS;
}

export async function sendBotMessage(text: string): Promise<ChatMessage> {
  await delay(600);
  return {
    id: `bot-${Date.now()}`,
    from: "bot",
    text: `(Mock reply) I'll be able to answer "${text}" once connected to the barangay knowledge base.`,
  };
}

// The structured pre-blotter record produced by the guided interview. Keys
// match ReportFieldKey in lib/reportQuestions.ts — kept as a plain shape
// here so mockData has no import cycle with the questions config.
export type ReportDraft = {
  reporter: string;
  incidentAt: string;
  location: string;
  otherParties: string;
  description: string;
  witnesses: string;
  evidence: string;
};

// Submits a completed guided report. Real version will POST the full
// structured record to the Node API once it exists; for now it mints a fake
// reference number so the flow has a real end state to land on.
//
// Takes the whole draft rather than one summary string — the barangay needs
// the answers kept in separate fields (a blotter entry has distinct slots for
// reporter, date/time, location, narrative), and collapsing them into one
// blob here would throw away exactly the structure the guided interview
// exists to capture.
export async function submitReport(draft: ReportDraft): Promise<{ referenceNo: string }> {
  await delay(600);
  const referenceNo = `BB-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  // The list views only have room for one line, so derive a short summary
  // from the narrative — but the full draft is what would be persisted.
  const summary = draft.description.trim() || "Voice report";

  MOCK_REPORTS.unshift({
    id: `r-${Date.now()}`,
    referenceNo,
    category: "Dispute",
    status: "Under Review",
    createdAt: new Date().toISOString(),
    summary: summary.length > 80 ? `${summary.slice(0, 80)}…` : summary,
  });

  console.log("[mock] Submitted report", referenceNo, draft);
  return { referenceNo };
}
