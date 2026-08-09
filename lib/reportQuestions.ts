// The pre-blotter capture config. Single source of truth for the chunk
// recordings, the tap-only detail fields, the review grouping, and the
// per-field Whisper tuning keys - so adding or moving a field is a one-file
// change and nothing drifts out of sync.
//
// Copy is Tagalog-only throughout - every label, question, guide, and
// option in this file, matching the rest of the app's resident-facing
// screens. No English subtitle underneath.
//
// STRUCTURE (see "Blotter Flow Redesign Plan.md")
// ──────────────────────────────────────────────
// The old flow asked 16 questions one at a time, roughly 9 of them as
// separate recordings. Two things were wrong with that:
//
//   1. Seven of the sixteen (the old "sino" chapter: name, address, age,
//      contact, gender, guardian) are profile data the app already collected
//      at signup. Re-asking them is pure friction with no upside.
//   2. It fragmented a story people tell in one breath. A resident saying
//      "kagabi po nag-iinuman si Mang Rudy sa tapat ng bahay namin" has
//      already given respondent, time, location and incident - and was then
//      asked for each of those again, separately.
//
// So fields are now classified into four groups by how they're actually
// obtained, not by what they mean:
//
//   profile    Prefilled from the resident's account. Never asked. Editable
//              on the review screen if the account is missing one.
//   narrative  The verbatim transcript of chunk 1. Legally authoritative -
//              this is the complainant's own statement and is never
//              rewritten, summarized, or LLM-touched.
//   extracted  Pulled out of the chunk transcripts by the LLM, then
//              confirmed by the resident. Degrades to a normal recording
//              prompt whenever extraction is unavailable.
//   details    Categorical decisions nobody narrates ("record only",
//              "summons"). Tapped on one consolidated screen.

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

/** How a field is obtained. Drives which screen (if any) asks for it. */
export type FieldGroup = "profile" | "narrative" | "extracted" | "details";

export type QuestionInputType = "voice" | "choice" | "checkbox";

/** A single option for a "choice" question. `value` is the stable machine
 *  value stored in the database; `label` is what's shown, Tagalog only.
 *  `description` is optional per-option decision support - one short line
 *  rendered directly under that option's own label (see FormChoiceField),
 *  for options whose label alone isn't enough to choose correctly (e.g.
 *  "Record Only" vs "Summons" - two words that don't explain themselves).
 *  Most options don't need one. */
export type QuestionOption = {
  value: string;
  label: string;
  description?: string;
};

export type ReportQuestion = {
  key: ReportFieldKey;
  group: FieldGroup;
  /** Which chunk recording can populate this, for `extracted` fields. Also
   *  used to pick the confirm-card grouping on chunks 2 and 3. */
  chunk?: ChunkKey;
  /** Ionicons glyph name. Paired with the text label, never a substitute for
   *  it - a color-only or icon-only status is an accessibility failure. This
   *  is a scanning aid for low-literacy users, not the primary communicator.
   *  Typed loosely (not against Ionicons' glyph map) to avoid coupling this
   *  config file to a specific icon library version. */
  icon: string;
  /** Short label used on confirm cards, the review screen, and the record. */
  label: string;
  /** The spoken prompt, Tagalog - used when this field falls back to being
   *  asked on its own (the repair path, or extraction unavailable). */
  question: string;
  /** Extra nudge shown under the question when the answer needs specifics. */
  hint?: string;
  /**
   * A complete field instruction, shown on the review screen: what to
   * enter, how specific to be, an example, and why the barangay needs it.
   * Tagalog, same as the rest of this file's resident-facing copy - not a
   * one-line reason but a full instruction someone could fill the field
   * from without needing `hint` or `question` alongside it. Written for
   * the resident reading it, not as research documentation - the
   * interview citations that justify each field live in the code comment
   * directly above its entry in REPORT_QUESTIONS instead, so the audit
   * trail exists without putting timestamps in front of someone filing a
   * complaint.
   */
  guide: string;
  /**
   * Required fields gate submission. The optional ones are genuinely
   * unknowable for many residents (you often don't know who else was
   * involved, or whether anyone witnessed it) - forcing an answer there
   * produces junk data, not better blotters.
   *
   * `guardianName` is deliberately `false` here even though it's required
   * *when shown* - its requiredness is conditional on `filedByGuardian`,
   * which this flat flag can't express. reportFlow.ts validates it.
   */
  required: boolean;
  inputType: QuestionInputType;
  /** Placeholder for the manual-entry / edit field. Only meaningful for
   *  "voice" fields. */
  placeholder?: string;
  /** Options for a "choice" field. */
  options?: QuestionOption[];
  /** Toggle label for a "checkbox" field (distinct from the question prompt
   *  itself - the prompt asks, this labels the toggle being flipped). */
  checkboxLabel?: string;
};

// ── Chunks ───────────────────────────────────────────────────────────────

export type ChunkKey = "ano" | "kailanSaan" | "sino";

export type Chunk = {
  key: ChunkKey;
  label: string;
  icon: string;
  /** The record prompt for this chunk. */
  question: string;
  /** One-line intro sitting above the checklist in the "Gabay" box, e.g.
   *  "Isama sa salaysay ang mga sumusunod:" - names what the list below is,
   *  it isn't itself the instruction. */
  hint?: string;
  /**
   * The actual instruction, as a short numbered checklist rather than one
   * dense paragraph - each item is a scannable phrase (2-6 words), not a
   * full sentence, so a resident can see everything to mention at a glance
   * instead of re-reading a run-on clause to find the third thing it asked
   * for. Rendered as numbered chips in the Gabay box (ChunkRecordScreen).
   */
  hintItems?: string[];
  /** Optional worked example shown under the checklist, in its own quieter
   *  line - concrete enough to model the phrasing without being one more
   *  thing competing with the checklist for attention. */
  example?: string;
  /** Fields this chunk's transcript can populate through extraction. Chunk 1
   *  carries the wide list because the story may contain any of it; chunks 2
   *  and 3 are deliberately narrow, since fewer target fields means less
   *  cross-contamination from a small extraction model. */
  extracts: ReportFieldKey[];
  /** Set on chunk 1 only: the field that stores the raw transcript verbatim,
   *  as the complainant's own statement. */
  verbatimField?: ReportFieldKey;
};

/**
 * Three chunks, always shown in this order, so the flow is predictable and
 * learnable - a flow that changes shape run to run is harder to teach an
 * elderly resident than one that doesn't.
 *
 * But chunks 2 and 3 arrive pre-filled from chunk 1's extraction whenever it
 * succeeded, rendering as confirm cards rather than record prompts. That's
 * what makes always-three cheap: the structure gives the reliability, the
 * prefill removes the cost.
 *
 *   Best case   1 recording  + 2 confirmations
 *   Typical     2 recordings + 1 confirmation
 *   Worst case  3 recordings
 */
export const CHUNKS: Chunk[] = [
  {
    key: "ano",
    label: "Ano ang nangyari",
    icon: "megaphone-outline",
    question: "Ikwento niyo po nang detalyado ang buong pangyayari.",
    // Load-bearing, not decoration. Priming the resident to include
    // who/when/where up front is what makes chunk 1 usually capture
    // everything - which is what turns chunks 2 and 3 into taps instead of
    // two more recordings. A four-item checklist, not a run-on sentence
    // listing the same four things - a resident narrating from a scannable
    // list is far more likely to actually say all four than one parsing a
    // single dense clause for them.
    hint: "Isama sa salaysay ang mga sumusunod:",
    hintItems: [
      "Ano mismo ang nangyari",
      "Sino ang inyong sinusumbong",
      "Kailan at saan ito nangyari",
      "May nakakita ba o may ebidensya",
    ],
    extracts: [
      "incidentAt",
      "location",
      "respondentName",
      "witnesses",
      "evidence",
      "incidentCategory",
    ],
    verbatimField: "description",
  },
  {
    key: "kailanSaan",
    label: "Kailan at saan",
    icon: "calendar-outline",
    question: "Kailan at saan po eksakto nangyari ang insidente?",
    hint: "Isama ang mga sumusunod:",
    hintItems: ["Petsa o araw", "Humigit-kumulang na oras", "Eksaktong lugar at malapit na landmark"],
    example: "Halimbawa: \"kagabi, mga alas-onse ng gabi, sa tapat ng bahay namin sa Purok 5.\"",
    extracts: ["incidentAt", "location"],
  },
  {
    key: "sino",
    label: "Sino ang sangkot",
    icon: "people-outline",
    question: "Sino po ang mga sangkot sa insidenteng ito?",
    hint: "Isama ang mga sumusunod:",
    hintItems: [
      "Buong pangalan ng inyong sinusumbong",
      "May nakakita o makakapagpatunay ba, at ang kanilang pangalan kung alam",
    ],
    extracts: ["respondentName", "witnesses"],
  },
];

export const TOTAL_CHUNKS = CHUNKS.length;

/**
 * Total number of "Bahagi" screens in the live flow, in the order the
 * resident actually sees them: ConfirmYouScreen (identity), the three chunk
 * recordings, then DetailsScreen (the categorical decisions). All five
 * share one "Bahagi N ng TOTAL_BAHAGI" header, computed from this constant
 * rather than each screen hardcoding its own count, so none of them can
 * drift out of sync with each other (e.g. a fourth chunk added later
 * automatically becomes "Bahagi 6 ng 6" everywhere without a separate edit
 * per screen). ReviewScreen isn't part of this count - it's a recap of
 * everything already filled in on Bahagi 1-5, not another "part" being
 * filled in for the first time, the same reason most multi-step forms have
 * a final review page that isn't itself numbered as a step.
 */
export const TOTAL_BAHAGI = CHUNKS.length + 2;

export function getChunk(key: ChunkKey): Chunk {
  const chunk = CHUNKS.find((c) => c.key === key);
  if (!chunk) throw new Error(`Unknown chunk: ${key}`);
  return chunk;
}

// ── Field registry ───────────────────────────────────────────────────────

export const REPORT_QUESTIONS: ReportQuestion[] = [
  // ── profile: prefilled from the account, never asked in the flow ──────
  // "Stated identically in both interviews (Q10; 03:32)."
  {
    key: "complainantName",
    group: "profile",
    icon: "person-outline",
    label: "Buong pangalan",
    question: "Sabihin po ninyo ang inyong buong pangalan.",
    guide:
      "Buong legal na pangalan, hindi palayaw (hal. 'Juan Dela Cruz', hindi 'Jun'). Dapat itong tumugma sa ID na dadalhin ninyo pagpirma sa barangay hall.",
    required: true,
    inputType: "voice",
    placeholder: "Buong pangalan",
  },
  // "Stated identically in both interviews (Q10; 03:32)."
  {
    key: "complainantAddress",
    group: "profile",
    icon: "home-outline",
    label: "Tirahan",
    question: "Ano po ang inyong kumpletong tirahan o purok?",
    guide:
      "Buong tirahan - purok/sitio at kalye kung meron (hal. 'Purok 3, Kalye Mabini'). Ito ang gagamitin ng barangay kung kailangan kayong maabot.",
    required: true,
    inputType: "voice",
    placeholder: "Tirahan o purok",
  },
  // "Stated identically in both interviews (Q10; 03:32)."
  {
    key: "complainantAge",
    group: "profile",
    icon: "calendar-number-outline",
    label: "Edad",
    question: "Ilang taon po kayo?",
    guide:
      "Kasalukuyang edad, bilang numero (hal. '34'). Ginagamit para malaman kung menor de edad kayo - kung oo, ang magulang o tagapag-alaga ang maghahain at pipirma sa halip ninyo.",
    required: true,
    inputType: "voice",
    placeholder: "Edad",
  },
  // "Stated identically in both interviews (Q10; 03:32)."
  {
    key: "complainantContact",
    group: "profile",
    icon: "call-outline",
    label: "Numero ng contact",
    question: "Ano po ang inyong numero ng contact?",
    guide:
      "Numero ng cellphone kung saan kayo maaabot (hal. '0917 123 4567'). Dito kayo tatawagan o tetextin ng barangay para sa mga update sa kaso.",
    required: true,
    inputType: "voice",
    placeholder: "Numero ng contact",
  },
  // "Added specifically in the June interview (03:32)."
  {
    key: "complainantGender",
    group: "profile",
    icon: "male-female-outline",
    label: "Kasarian",
    question: "Ano po ang inyong kasarian?",
    guide:
      "Bahagi ito ng opisyal ninyong profile, kasama ang pangalan at tirahan - hinihingi ng kasalukuyang blotter form ng barangay.",
    required: true,
    inputType: "choice",
    options: [
      { value: "lalaki", label: "Lalaki" },
      { value: "babae", label: "Babae" },
      { value: "iba_pa", label: "Iba pa" },
    ],
  },
  // "If the complainant is a minor, the parent or guardian will write on
  // their behalf" (22:30).
  {
    key: "filedByGuardian",
    group: "details",
    icon: "people-circle-outline",
    label: "Naghahain kung menor de edad",
    question: "Kayo mismo ba ang nagsasampa, o bilang magulang o tagapag-alaga ng menor de edad?",
    guide:
      "Piliin 'Ako mismo' kung kayo mismo ang nagrereklamo. Piliin 'Bilang magulang/tagapag-alaga' kung menor de edad ang tunay na nagrereklamo at kayo ang maghahain at pipirma sa halip nila.",
    required: true,
    inputType: "choice",
    options: [
      { value: "self", label: "Ako mismo" },
      { value: "guardian", label: "Bilang magulang/tagapag-alaga" },
    ],
  },
  {
    key: "guardianName",
    group: "details",
    icon: "person-add-outline",
    label: "Pangalan ng magulang/tagapag-alaga",
    question: "Ano po ang buong pangalan ng magulang o tagapag-alagang naghahain?",
    guide:
      "Kailangan lang kung pinili ninyong 'Bilang magulang/tagapag-alaga'. Buong pangalan ng magulang/tagapag-alagang maghahain at pipirma - hindi ang pangalan ng menor de edad.",
    required: false,
    inputType: "voice",
    placeholder: "Buong pangalan ng magulang/tagapag-alaga",
  },

  // ── narrative: chunk 1 verbatim, the legally authoritative statement ──
  // "...explaining what happened, why they are complaining about the
  // person, who they are complaining against" (07:09-07:33) - this is the
  // field BosesBantay's voice pre-fill targets.
  {
    key: "description",
    group: "narrative",
    chunk: "ano",
    icon: "megaphone-outline",
    label: "Salaysay ng pangyayari",
    question: "Pakisabi po nang detalyado kung ano ang nangyari.",
    hint: "Ito po ang pinakamahalagang bahagi - maaari kayong magsalita nang mahaba.",
    guide:
      "Pinakamahalagang bahagi ng report. Ilarawan kung ano ang nangyari, kailan, at sino ang sangkot - sa sarili ninyong mga salita. Hindi ito binabago o binubuod ng AI. Mas kumpleto ito, mas kaunti pang kakailanganin ninyong punan sa ibaba.",
    required: true,
    inputType: "voice",
    placeholder: "Detalyadong paglalarawan ng insidente",
  },

  // ── extracted: pulled from the chunk transcripts, then confirmed ──────
  // FIXED: incidentAt and location were `required: true` while nothing in
  // the live flow ever actually gated on them - chunk 2 ("kailanSaan") has
  // no verbatimField, so ChunkRecordScreen's canAdvance never blocks on it
  // the way chunk 1 blocks on an empty transcript, and neither of these two
  // is re-shown as its own fillable field on Review (the "paper format"
  // pass folded them into the raw chunk 2 paragraph instead of
  // re-decomposing it - see ReviewScreen's top comment). If extraction
  // simply missed a date or exact location in that paragraph, both stayed
  // permanently blank with no screen anywhere that would let a resident
  // fill them in - which meant canSubmit could get stuck false forever,
  // Ipasa ang report staying disabled with nothing left on Review reading
  // as incomplete. They're `required: false` now, same as their sibling
  // extracted fields (respondentName, witnesses, evidence) just below -
  // useful for search/GIS/DILG rollups when present, but the raw narrative
  // (chunk 1's `description`, still required and still gated) is what's
  // legally authoritative, so a report shouldn't be unsubmittable over a
  // date extraction missed.
  {
    key: "incidentAt",
    group: "extracted",
    chunk: "kailanSaan",
    icon: "time-outline",
    label: "Petsa at oras",
    question: "Kailan po at anong oras nangyari ang insidente?",
    hint: "Halimbawa: kagabi mga alas-onse, o noong Lunes ng umaga.",
    guide:
      "Petsa at humigit-kumulang na oras ng insidente (hal. 'Agosto 5, mga alas-onse ng gabi'). Makakatulong ito kung kakailanganing itugma sa ibang report o CCTV footage.",
    required: false,
    inputType: "voice",
    placeholder: "Petsa at oras ng insidente",
  },
  // Supports GIS hotspot mapping (26:56-27:20).
  {
    key: "location",
    group: "extracted",
    chunk: "kailanSaan",
    icon: "location-outline",
    label: "Lugar ng pangyayari",
    question: "Saan po eksakto nangyari ang insidente?",
    hint: "Maglagay po ng malapit na landmark kung maaari.",
    guide:
      "Eksaktong lugar ng insidente - isama ang landmark o purok kung maaari (hal. 'Purok 5, malapit sa sari-sari store'). Tumutulong ito sa pagpaplano ng patrol ng barangay.",
    required: false,
    inputType: "voice",
    placeholder: "Eksaktong lokasyon",
  },
  // Part of the narrative in the paper process; broken out as its own
  // field here for search/reporting (07:09-07:33).
  {
    key: "respondentName",
    group: "extracted",
    chunk: "sino",
    icon: "person-remove-outline",
    label: "Ipinagsusumbong",
    question: "Sino po ang inyong sinusumbong sa reklamong ito, kung kilala ninyo?",
    guide:
      "Pangalan ng inyong sinusumbong, o kung paano ninyo sila tinatawag (hal. 'Jayson, anak ni Mang Tonio'). Iwanang blangko kung hindi alam.",
    required: false,
    inputType: "voice",
    placeholder: "Pangalan ng sinusumbong, kung kilala",
  },
  {
    key: "witnesses",
    group: "extracted",
    chunk: "sino",
    icon: "eye-outline",
    label: "Mga saksi",
    question: "May mga saksi po ba sa insidente? Kung meron, sino po sila?",
    guide:
      "Pangalan ng sinumang nakakita o makakapagpatunay (hal. 'Kuya Jomar, kapitbahay namin'). Opsyonal - okay lang kung wala.",
    required: false,
    inputType: "voice",
    placeholder: "Pangalan ng mga saksi",
  },
  {
    key: "evidence",
    group: "extracted",
    chunk: "sino",
    icon: "camera-outline",
    label: "Ebidensya",
    question: "May larawan, video, o iba pang ebidensya po ba kayong madadala?",
    guide:
      "Anong larawan, video, CCTV, o ibang patunay ang meron (hal. 'CCTV mula sa sari-sari store'). Hindi kailangang i-upload dito - ilarawan lang. Opsyonal.",
    required: false,
    inputType: "voice",
    placeholder: "Larawan, video, o iba pang ebidensya",
  },

  // ── details: categorical decisions, tapped on one screen ─────────────
  // "Our blotter has two types. There is one for record only and another
  // for summons" (04:35).
  {
    key: "blotterType",
    group: "details",
    icon: "document-text-outline",
    label: "Uri ng blotter",
    question: "Ano po ang uri ng blotter na gusto ninyong ihain?",
    // Shortened to just the reassurance - what each option actually means
    // now lives on the option itself (see `description` below), read right
    // next to the label it explains instead of one paragraph above both
    // options that a resident had to cross-reference back and forth to
    // apply. This line is the one thing that still belongs above the
    // choices: it isn't about either option, it's permission to not
    // overthink the pick.
    hint: "Puwede munang piliin ang 'Record Only' - puwede pa ring humiling ng summons mamaya.",
    guide:
      "'Record Only' kung gusto lang itala ang insidente nang walang aksyon sa ngayon. 'Summons' kung gusto ipatawag ng barangay ang kabilang partido. Puwede munang piliin ang 'Record Only' at humiling ng summons mamaya.",
    required: true,
    inputType: "choice",
    options: [
      {
        value: "record_only",
        label: "Record Only lamang",
        description: "Para sa dokumentasyon lamang - walang aksyon sa ngayon.",
      },
      {
        value: "summons",
        label: "Summons",
        description: "Hihilingin sa barangay na patawagin ang kabilang partido.",
      },
    ],
  },
  // Needed for DILG/BDRRMC compliance rollups (29:20-31:18).
  {
    key: "incidentCategory",
    group: "details",
    icon: "list-outline",
    label: "Kategorya ng insidente",
    question: "Anong kategorya po ang pinakabagay sa insidenteng ito?",
    guide:
      "Piliin ang pinakabagay na kategorya. Ginagamit ito ng barangay para sa mga ulat sa DILG at BDRRMC, kaya mahalagang tama ito.",
    required: true,
    inputType: "choice",
    options: [
      { value: "theft", label: "Pagnanakaw" },
      { value: "physical_abuse", label: "Pananakit" },
      { value: "noise", label: "Ingay" },
      { value: "property_damage", label: "Pagkasira ng ari-arian" },
      { value: "threats_harassment", label: "Banta o panghaharas" },
      { value: "others", label: "Iba pa" },
    ],
  },
  // "...they may also request a CCTV review... as long as they indicate it
  // in the blotter book" (04:25-04:34).
  {
    key: "requestCctv",
    group: "details",
    icon: "videocam-outline",
    label: "Hiling na i-review ang CCTV",
    question: "Gusto niyo po bang humiling ng CCTV review para sa insidenteng ito?",
    guide:
      "I-check kung gusto ninyong suriin ng barangay ang CCTV footage na may kinalaman dito. Hindi ito awtomatikong susuriin maliban kung nakatala sa blotter.",
    required: false,
    inputType: "checkbox",
    checkboxLabel: "Oo, humiling ng CCTV review",
  },
];

const QUESTION_BY_KEY = new Map(REPORT_QUESTIONS.map((q) => [q.key, q]));

export function getQuestion(key: ReportFieldKey): ReportQuestion {
  const q = QUESTION_BY_KEY.get(key);
  if (!q) throw new Error(`Unknown report field: ${key}`);
  return q;
}

export function fieldsInGroup(group: FieldGroup): ReportQuestion[] {
  return REPORT_QUESTIONS.filter((q) => q.group === group);
}

/**
 * Order the Details screen renders its controls in.
 *
 * FIXED: `filedByGuardian` (and its follow-up `guardianName`) used to be
 * listed here too, which meant a resident answered "kayo mismo ba ang
 * nagsasampa..." on Bahagi 1 (ConfirmYouScreen, which pulls its fields from
 * REVIEW_SECTIONS' "nagrereklamo" section - see reportQuestions.ts - and
 * that section has always included both) and then saw the exact same
 * question rendered again here, in a different visual style, on Huling
 * detalye. Both fields now live only on Bahagi 1, since that's where "who
 * is filing" belongs - Details is purely the categorical decisions nobody
 * narrates (blotter type, incident category, CCTV request), not identity.
 */
export const DETAILS_FIELD_ORDER: ReportFieldKey[] = [
  "blotterType",
  "incidentCategory",
  "requestCctv",
];

// ── Review grouping ──────────────────────────────────────────────────────
//
// Three parts, matching how the barangay interview described the paper
// process itself: first establish who is complaining, then capture the
// incident, then - separately, and not editable in-app - what happens once
// the resident brings this to the barangay hall in person. Parts 1 and 2
// are real AnswersMap sections rendered from REVIEW_SECTIONS below; part 3
// is informational only (POST_BLOTTER_STEPS, further down) because those
// fields don't exist in this app's data model - they're written by hall
// staff onto the physical blotter after signing, not by the resident here.

export type ReviewSection = {
  key: string;
  label: string;
  /** Short noun-phrase version of `label`, without the "Bahagi N ng Y ·"
   *  prefix baked in - used by ConfirmYouScreen's live header, which
   *  computes its own "Bahagi 1 ng TOTAL_BAHAGI" eyebrow the same way the
   *  chunk screens compute theirs, rather than parsing it back out of the
   *  combined string used on the Review recap. */
  shortLabel: string;
  /** One or two sentences introducing the section, shown under its header
   *  when expanded - the "ipakilala muna kung sino ang nagrereklamo" framing
   *  the section exists to set up, stated once instead of implied per field.
   *  Tagalog, matching `guide` on ReportQuestion above. */
  guide: string;
  fields: ReportFieldKey[];
  /** Profile data is correct-by-default and collapsing it keeps the review
   *  screen focused on what the resident actually just said. */
  collapsedByDefault?: boolean;
};

export const REVIEW_SECTIONS: ReviewSection[] = [
  {
    key: "nagrereklamo",
    label: "Bahagi 1 ng 4 · Sino ang Nagrereklamo",
    shortLabel: "Nagrereklamo",
    guide:
      "Bago pag-usapan ang insidente, kumpirmahin muna kung sino kayo bilang nagrereklamo - para malaman ng barangay kung paano kayo maaabot. Kung naghahain kayo para sa menor de edad, piliin ito sa ibaba.",
    fields: [
      "complainantName",
      "complainantAddress",
      "complainantAge",
      "complainantContact",
      "complainantGender",
      "filedByGuardian",
      "guardianName",
    ],
    collapsedByDefault: true,
  },
  {
    key: "insidente",
    label: "Bahagi 2 ng 4 · Ang Insidente",
    shortLabel: "Ang Insidente",
    guide:
      "Ang puso ng report - ano ang nangyari, kailan at saan, sino ang sangkot, at anong aksyon ang gusto ninyo. Punan hangga't maaari; ang mga opsyonal na field (saksi, ebidensya) ay puwedeng iwanang blangko.",
    fields: [
      "respondentName",
      "witnesses",
      "evidence",
      "description",
      "incidentAt",
      "location",
      "blotterType",
      "incidentCategory",
      "requestCctv",
    ],
  },
];

// ── Part 3: what happens at the barangay hall ──────────────────────────
//
// Three facts, not five staff-process steps: this used to also list the
// receiving officer, case status, and remarks - accurate, but the review
// screen isn't the place to teach a resident the barangay's internal
// workflow, and burying the one legally load-bearing fact ("hindi pa ito
// legal") in step 1 of 5 risked it getting skimmed past. What's here now is
// exactly what "Blotter Form Draft Plan.docx" flags as non-negotiable:
// filing is a *draft submitted for review*, it becomes a *legal document
// only once signed in person* ("It cannot be filed by someone else on your
// behalf... the complainant must be present" - the interview, 10:47-11:02),
// and the system issues a *reference ticket* the moment it's submitted (see
// handleSubmit's refNo in report.tsx, generated at submission - not after
// signing - specifically so the barangay can pull up the resident's draft
// when they arrive). None of these belong in AnswersMap or REVIEW_SECTIONS
// above: showing them as fill-in-the-blank fields would misrepresent a
// mobile draft as something it isn't yet.

export type PostBlotterStep = {
  key: string;
  icon: string;
  label: string;
  body: string;
};

export const POST_BLOTTER_COPY = {
  // "Pumunta sa Barangay Hall" (Go to the Barangay Hall), not the flatter
  // "Sa Barangay Hall" (At the Barangay Hall) - a title that reads as an
  // instruction ("go do this") lands clearer than one that just names a
  // place, and this section is now always visible (no chevron to open it),
  // so the title alone has to carry that this is an action still pending,
  // not just background info.
  title: "Pumunta sa Barangay Hall",
  // One line, always shown (this section no longer collapses) - the single
  // fact that matters most: still a draft, only legal once signed in
  // person. Trimmed from the original two-clause version so it reads in
  // one breath instead of two.
  intro: "Draft pa lang ito - opisyal lang 'pag pumirma kayo mismo sa barangay hall.",
};

export const POST_BLOTTER_STEPS: PostBlotterStep[] = [
  {
    key: "submitted",
    icon: "paper-plane-outline",
    label: "Ipapadala para suriin",
    body: "Draft lang ang ipapadala - susuriin ito ng barangay.",
  },
  // "...you really need to sign it. It cannot be filed by someone else on
  // your behalf... the complainant must be present" (10:47-11:02). Voice
  // filing is a draft only - the in-person signature is what makes it a
  // legal document, not the submission itself.
  {
    key: "signature",
    icon: "create-outline",
    label: "Personal na lagda ang gagawang legal",
    body: "Pumunta at pumirma mismo sa barangay hall, dala ang ID.",
  },
  // Digital equivalent of the paper blotter's tamper-evident page
  // numbering (17:50-18:30) - generated at submission (report.tsx's refNo),
  // so the barangay has something to pull the draft up by before the
  // resident even arrives to sign.
  {
    key: "referenceNo",
    icon: "bookmark-outline",
    label: "Ticket / reference number",
    body: "Ibibigay ito para ma-follow up ninyo ang draft.",
  },
];

// ── Copy ─────────────────────────────────────────────────────────────────

/** Copy shown before recording starts. */
export const INTRO_COPY = {
  title: "Gabay na pag-report",
  body: "Kumpirmahin muna ang inyong impormasyon, pagkatapos ay tatlong tanong lang po. Sagutin nang malinaw at hindi po kayo mamadaliin.",
};

/** Copy shown on the success screen - sets the expectation that this is a
 *  pre-blotter, not a filed case. */
export const CLOSING_COPY = {
  thanks: "Salamat po.",
  body: "Ang report na ito ay iri-review pa ng barangay para sa kumpirmasyon.",
};

/** Shown persistently through the flow and on the reports list, so a
 *  resident never mistakes a submitted pre-blotter for an official one -
 *  the interview was explicit that a blotter isn't official until printed
 *  and signed in person at the barangay hall. */
export const DRAFT_BADGE_COPY = {
  label: "Draft",
  labelFull: "Draft · Hindi pa Opisyal",
};

/** Confirm-card copy for chunks 2 and 3 when extraction pre-filled them. */
export const CONFIRM_COPY = {
  heading: "Ito po ba ang tama?",
  body: "Narinig namin ito sa inyong salaysay. Maaari po ninyong itama.",
  confirm: "Tama po",
  reRecord: "I-record ulit",
  edit: "Baguhin",
  notHeard: "Hindi po namin ito narinig",
};

/** Confirm-card copy for Bahagi 1 (ConfirmYouScreen). Same pattern as
 *  CONFIRM_COPY above - a one-line heading instead of a guide paragraph
 *  under every field, because these values already came from the account,
 *  not from something the resident just said. Glance, tap "Baguhin" only on
 *  what's actually wrong. */
export const IDENTITY_CONFIRM_COPY = {
  heading: "Kayo po ba ito?",
  body: "Mula ito sa inyong account. Tignan lang po at itama kung mali.",
  confirm: "Tama po, magpatuloy",
  edit: "Baguhin",
};
