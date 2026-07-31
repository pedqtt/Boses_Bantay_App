// The guided pre-blotter interview. Single source of truth for the question
// set — the stepper UI, the review screen labels, and the per-field Whisper
// tuning all read from here, so adding or reordering a question is a one-file
// change and nothing can drift out of sync.
//
// Copy is Tagalog-first with an English subtitle underneath: the primary
// audience files in Filipino/Taglish, but the English line keeps the flow
// usable for residents who read English more comfortably, without making
// either group hunt for a language toggle.

export type ReportFieldKey =
  | "reporter"
  | "incidentAt"
  | "location"
  | "otherParties"
  | "description"
  | "witnesses"
  | "evidence";

/**
 * The 7 questions read as one flat list to a non-technical resident, and a
 * flat "Tanong 3 ng 7" counter makes the task feel longer than it is (Hick's
 * Law: perceived effort scales with visible choice/step count, not actual
 * effort). Grouping into 3 chapters that map to how a barangay official
 * already thinks about a blotter entry — sino, kailan/saan, ano — turns "7
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
   *  of those — a chapter like "ano" spans 4 questions with 4 different
   *  icons, so it needs its own representative glyph instead. */
  icon: string;
};

export const CHAPTERS: Chapter[] = [
  { key: "sino", label: "Sino Ka", labelEn: "Who you are", icon: "person-outline" },
  { key: "kailanSaan", label: "Kailan at Saan", labelEn: "When and where", icon: "calendar-outline" },
  { key: "ano", label: "Ano ang Nangyari", labelEn: "What happened", icon: "megaphone-outline" },
];

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
   */
  required: boolean;
  /** Placeholder for the manual-entry / edit field. */
  placeholder: string;
};

export const REPORT_QUESTIONS: ReportQuestion[] = [
  {
    key: "reporter",
    chapter: "sino",
    icon: "person-outline",
    label: "Pangalan at address",
    question: "Sabihin po ninyo ang inyong buong pangalan at address o purok.",
    questionEn: "State your full name and address or purok.",
    required: true,
    placeholder: "Buong pangalan, address o purok",
  },
  {
    key: "incidentAt",
    chapter: "kailanSaan",
    icon: "time-outline",
    label: "Petsa at oras",
    question: "Kailan po at anong oras nangyari ang insidente?",
    questionEn: "When and what time did the incident happen?",
    hint: "Halimbawa: kagabi mga alas-onse, o noong Lunes ng umaga.",
    required: true,
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
    placeholder: "Eksaktong lokasyon",
  },
  {
    key: "otherParties",
    chapter: "ano",
    icon: "people-outline",
    label: "Ibang partido",
    question: "Sino po ang kasangkot o ibang partido sa insidente, kung kilala ninyo?",
    questionEn: "Who else is involved, if known?",
    required: false,
    placeholder: "Pangalan ng ibang kasangkot",
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
    placeholder: "Larawan, video, o iba pang ebidensya",
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
