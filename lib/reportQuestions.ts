// The guided pre-blotter interview. Single source of truth for the question
// set — the stepper UI, the review screen labels, and the per-field Whisper
// tuning all read from here, so adding or reordering a question is a one-file
// change and nothing can drift out of sync.
//
// Copy is Tagalog-first with an English subtitle underneath: the primary
// audience files in Filipino/Taglish, but the English line keeps the flow
// usable for residents who read English more comfortably, without making
// either group hunt for a language toggle. Bilingual labels are a stated
// requirement from the barangay field interviews this question set is
// based on ("Boses Bantay - Signup and Blotter Form Draft Plan.docx") —
// every field, including choice/checkbox options, carries both languages.

export type ReportFieldKey =
  | "complainantName"
  | "complainantAddress"
  | "complainantAge"
  | "complainantContact"
  | "complainantGender"
  | "filedByGuardian"
  | "guardianName"
  | "incidentAt"
  | "location"
  | "respondentName"
  | "description"
  | "witnesses"
  | "evidence"
  | "blotterType"
  | "incidentCategory"
  | "requestCctv";

/**
 * The questions read as one flat list to a non-technical resident, and a
 * flat "Tanong 3 ng 16" counter makes the task feel longer than it is (Hick's
 * Law: perceived effort scales with visible choice/step count, not actual
 * effort). Grouping into 3 chapters that map to how a barangay official
 * already thinks about a blotter entry — sino, kailan/saan, ano — turns "16
 * things to answer" into "3 parts," each small enough to not feel like a
 * commitment, without changing what's actually being asked.
 */
export type ChapterKey = "sino" | "kailanSaan" | "ano";

export type Chapter = {
  key: ChapterKey;
  label: string;
  labelEn: string;
  /** One icon representing the chapter as a whole, shown in
   *  ChapterProgressHeader. Per-question icons (below) still exist for the
   *  intro screen's question list, but a single step header can't use one
   *  of those — a chapter like "ano" spans several questions with different
   *  icons, so it needs its own representative glyph instead. */
  icon: string;
};

export const CHAPTERS: Chapter[] = [
  { key: "sino", label: "Sino Ka", labelEn: "Who you are", icon: "person-outline" },
  { key: "kailanSaan", label: "Kailan at Saan", labelEn: "When and where", icon: "calendar-outline" },
  { key: "ano", label: "Ano ang Nangyari", labelEn: "What happened", icon: "megaphone-outline" },
];

/** A single bilingual option for a "choice" question. `value` is the stable
 *  machine value stored in the database; `label`/`labelEn` are what's shown. */
export type QuestionOption = {
  value: string;
  label: string;
  labelEn: string;
};

export type QuestionInputType = "voice" | "choice" | "checkbox";

export type ReportQuestion = {
  key: ReportFieldKey;
  chapter: ChapterKey;
  /** Ionicons glyph name. Paired with the text label, never a substitute for
   *  it — a color-only or icon-only status is an accessibility failure. This
   *  is a scanning aid for low-literacy users, not the primary communicator.
   *  Typed loosely (not against Ionicons' glyph map) to avoid coupling this
   *  config file to a specific icon library version. */
  icon: string;
  /** Short label used on the review screen and in the submitted record. */
  label: string;
  /** The spoken prompt, Tagalog — this is the primary instruction. */
  question: string;
  /** English subtitle, secondary tier. */
  questionEn: string;
  /** Extra nudge shown under the question when the answer needs specifics. */
  hint?: string;
  /**
   * Required questions gate submission. The optional ones are genuinely
   * unknowable for many residents (you often don't know who else was
   * involved, or whether anyone witnessed it) — forcing an answer there
   * produces junk data, not better blotters.
   *
   * `guardianName` is deliberately `false` here even though it's required
   * *when shown* — its requiredness is conditional on `filedByGuardian`,
   * which this flat flag can't express. report.tsx validates it separately.
   */
  required: boolean;
  /**
   * How this question is answered. Defaults conceptually to "voice" (record
   * + auto-transcribe + editable text, today's whole flow) — "choice" and
   * "checkbox" questions are categorical and render pickers instead, since
   * nobody should have to narrate "record only" and hope transcription
   * catches it correctly.
   */
  inputType: QuestionInputType;
  /** Placeholder for the manual-entry / edit field. Only meaningful for
   *  "voice" questions. */
  placeholder?: string;
  /** Options for a "choice" question. */
  options?: QuestionOption[];
  /** Toggle label for a "checkbox" question (distinct from the question
   *  prompt itself — the prompt asks, this labels the toggle being flipped). */
  checkboxLabel?: string;
  checkboxLabelEn?: string;
};

export const REPORT_QUESTIONS: ReportQuestion[] = [
  // ── Sino Ka / Who you are ──────────────────────────────────────────
  {
    key: "complainantName",
    chapter: "sino",
    icon: "person-outline",
    label: "Buong pangalan",
    question: "Sabihin po ninyo ang inyong buong pangalan.",
    questionEn: "State your full name.",
    required: true,
    inputType: "voice",
    placeholder: "Buong pangalan",
  },
  {
    key: "complainantAddress",
    chapter: "sino",
    icon: "home-outline",
    label: "Tirahan",
    question: "Ano po ang inyong kumpletong tirahan o purok?",
    questionEn: "What is your complete address or purok?",
    required: true,
    inputType: "voice",
    placeholder: "Tirahan o purok",
  },
  {
    key: "complainantAge",
    chapter: "sino",
    icon: "calendar-number-outline",
    label: "Edad",
    question: "Ilang taon po kayo?",
    questionEn: "How old are you?",
    required: true,
    inputType: "voice",
    placeholder: "Edad",
  },
  {
    key: "complainantContact",
    chapter: "sino",
    icon: "call-outline",
    label: "Numero ng contact",
    question: "Ano po ang inyong numero ng contact?",
    questionEn: "What is your contact number?",
    required: true,
    inputType: "voice",
    placeholder: "Numero ng contact",
  },
  {
    key: "complainantGender",
    chapter: "sino",
    icon: "male-female-outline",
    label: "Kasarian",
    question: "Ano po ang inyong kasarian?",
    questionEn: "What is your gender?",
    required: true,
    inputType: "choice",
    options: [
      { value: "lalaki", label: "Lalaki", labelEn: "Male" },
      { value: "babae", label: "Babae", labelEn: "Female" },
      { value: "iba_pa", label: "Iba pa", labelEn: "Other" },
    ],
  },
  {
    key: "filedByGuardian",
    chapter: "sino",
    icon: "people-circle-outline",
    label: "Naghahain bilang",
    question: "Kayo mismo ba ang nagsasampa ng reklamong ito, o bilang magulang o tagapag-alaga kayo ng menor de edad?",
    questionEn: "Are you filing this yourself, or as a parent/guardian on behalf of a minor?",
    required: true,
    inputType: "choice",
    options: [
      { value: "self", label: "Ako mismo", labelEn: "Myself" },
      { value: "guardian", label: "Bilang magulang/tagapag-alaga", labelEn: "As parent/guardian" },
    ],
  },
  {
    key: "guardianName",
    chapter: "sino",
    icon: "person-add-outline",
    label: "Pangalan ng magulang/tagapag-alaga",
    question: "Ano po ang buong pangalan ng magulang o tagapag-alagang naghahain sa ngalan ng menor de edad?",
    questionEn: "What is the full name of the parent/guardian filing on the minor's behalf?",
    required: false,
    inputType: "voice",
    placeholder: "Buong pangalan ng magulang/tagapag-alaga",
  },

  // ── Kailan at Saan / When and where ────────────────────────────────
  {
    key: "incidentAt",
    chapter: "kailanSaan",
    icon: "time-outline",
    label: "Petsa at oras",
    question: "Kailan po at anong oras nangyari ang insidente?",
    questionEn: "When and what time did the incident happen?",
    hint: "Halimbawa: kagabi mga alas-onse, o noong Lunes ng umaga.",
    required: true,
    inputType: "voice",
    placeholder: "Petsa at oras ng insidente",
  },
  {
    key: "location",
    chapter: "kailanSaan",
    icon: "location-outline",
    label: "Lokasyon",
    question: "Saan po eksakto nangyari ang insidente?",
    questionEn: "Where exactly did the incident take place?",
    hint: "Maglagay po ng malapit na landmark kung maaari.",
    required: true,
    inputType: "voice",
    placeholder: "Eksaktong lokasyon",
  },

  // ── Ano ang Nangyari / What happened ───────────────────────────────
  {
    key: "respondentName",
    chapter: "ano",
    icon: "people-outline",
    label: "Sinusumbong",
    question: "Sino po ang inyong sinusumbong o ipinagsusumbong sa reklamong ito, kung kilala ninyo?",
    questionEn: "Who are you filing this complaint against, if known?",
    required: false,
    inputType: "voice",
    placeholder: "Pangalan ng sinusumbong, kung kilala",
  },
  {
    key: "description",
    chapter: "ano",
    icon: "megaphone-outline",
    label: "Ano ang nangyari",
    question: "Pakisabi po nang detalyado kung ano ang nangyari.",
    questionEn: "Please describe in detail what happened.",
    hint: "Ito po ang pinakamahalagang bahagi — maaari kayong magsalita nang mahaba.",
    required: true,
    inputType: "voice",
    placeholder: "Detalyadong paglalarawan ng insidente",
  },
  {
    key: "witnesses",
    chapter: "ano",
    icon: "eye-outline",
    label: "Mga saksi",
    question: "May mga saksi po ba sa insidente? Kung meron, sino po sila?",
    questionEn: "Are there any witnesses? If so, who?",
    required: false,
    inputType: "voice",
    placeholder: "Pangalan ng mga saksi",
  },
  {
    key: "evidence",
    chapter: "ano",
    icon: "camera-outline",
    label: "Ebidensya",
    question: "May larawan, video, o iba pang ebidensya po ba kayong madadala?",
    questionEn: "Do you have any photos, video, or other evidence you can bring?",
    required: false,
    inputType: "voice",
    placeholder: "Larawan, video, o iba pang ebidensya",
  },
  {
    key: "blotterType",
    chapter: "ano",
    icon: "document-text-outline",
    label: "Uri ng blotter",
    question: "Ano po ang uri ng blotter na gusto ninyong ihain?",
    questionEn: "What type of blotter entry would you like to file?",
    hint: "Ang 'Record Only' ay para lamang sa dokumentasyon. Ang 'Summons' ay hihiling na humarap ang kabilang partido.",
    required: true,
    inputType: "choice",
    options: [
      { value: "record_only", label: "Record Only lamang", labelEn: "Record only" },
      { value: "summons", label: "Summons", labelEn: "Summons" },
    ],
  },
  {
    key: "incidentCategory",
    chapter: "ano",
    icon: "list-outline",
    label: "Kategorya ng insidente",
    question: "Anong kategorya po ang pinakabagay sa insidenteng ito?",
    questionEn: "Which category best fits this incident?",
    required: true,
    inputType: "choice",
    options: [
      { value: "theft", label: "Pagnanakaw", labelEn: "Theft" },
      { value: "physical_abuse", label: "Pananakit", labelEn: "Physical abuse" },
      { value: "noise", label: "Ingay", labelEn: "Noise complaint" },
      { value: "property_damage", label: "Pagkasira ng ari-arian", labelEn: "Property damage" },
      { value: "threats_harassment", label: "Banta o panghaharas", labelEn: "Threats / harassment" },
      { value: "others", label: "Iba pa", labelEn: "Others" },
    ],
  },
  {
    key: "requestCctv",
    chapter: "ano",
    icon: "videocam-outline",
    label: "CCTV review",
    question: "Gusto niyo po bang humiling ng CCTV review para sa insidenteng ito?",
    questionEn: "Would you like to request a CCTV review for this incident?",
    required: false,
    inputType: "checkbox",
    checkboxLabel: "Oo, humiling ng CCTV review",
    checkboxLabelEn: "Yes, request a CCTV review",
  },
];

export const TOTAL_STEPS = REPORT_QUESTIONS.length;

/** Return type of getChapterProgress, exported so components rendering
 *  chapter progress (ChapterProgressHeader) can type their props against it
 *  instead of inferring/duplicating the shape. */
export type ChapterProgress = {
  chapter: Chapter;
  chapterNumber: number;
  totalChapters: number;
  stepInChapter: number;
  stepsInChapter: number;
  isFirstInChapter: boolean;
};

/** Given a step index, returns which chapter it belongs to and the
 *  resident's position within that chapter — e.g. question 5 (index 4) is
 *  "Ano ang Nangyari, part 2 of 4". Derived rather than stored per-question
 *  so chapter boundaries stay a single source of truth. */
export function getChapterProgress(stepIndex: number): ChapterProgress {
  const q = REPORT_QUESTIONS[stepIndex];
  const chapterIndex = CHAPTERS.findIndex((c) => c.key === q.chapter);
  const stepsInChapter = REPORT_QUESTIONS.filter((x) => x.chapter === q.chapter);
  const indexInChapter = stepsInChapter.findIndex((x) => x.key === q.key);
  return {
    chapter: CHAPTERS[chapterIndex],
    chapterNumber: chapterIndex + 1,
    totalChapters: CHAPTERS.length,
    stepInChapter: indexInChapter + 1,
    stepsInChapter: stepsInChapter.length,
    isFirstInChapter: indexInChapter === 0,
  };
}

/** Copy shown before recording starts. */
export const INTRO_COPY = {
  title: "Gabay na pag-report",
  titleEn: "Guided report",
  body: "Sundan lang po ang mga tanong. Sagutin nang malinaw at isa-isa lang po.",
  bodyEn: "Just follow the questions below. Answer clearly, one at a time.",
};

/** Copy shown on the success screen — sets the expectation that this is a
 *  pre-blotter, not a filed case. */
export const CLOSING_COPY = {
  thanks: "Salamat po.",
  body: "Ang report na ito ay iri-review pa ng barangay para sa kumpirmasyon.",
  bodyEn: "This report will still be reviewed by the barangay for confirmation.",
};

/** Shown persistently through the flow and on the reports list, so a
 *  resident never mistakes a submitted pre-blotter for an official one —
 *  the interview was explicit that a blotter isn't official until printed
 *  and signed in person at the barangay hall. */
export const DRAFT_BADGE_COPY = {
  label: "Draft",
  labelFull: "Draft · Hindi pa Opisyal",
  labelFullEn: "Draft · Not yet official",
};
