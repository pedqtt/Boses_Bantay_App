// Pure logic for the pre-blotter flow: how answers merge, what counts as
// complete, and what the next screen is. Deliberately free of React and of
// any UI import, so the rules that decide whether a legal document is
// complete are readable (and testable) on their own, rather than being
// scattered through a component's event handlers.

import {
  CHUNKS,
  REPORT_QUESTIONS,
  getQuestion,
  type ChunkKey,
  type ReportFieldKey,
} from "@/lib/reportQuestions";
import {
  EMPTY_ANSWER,
  type AnswersMap,
  type AnswerState,
  type ChunksMap,
  type FieldSource,
} from "@/components/report/types";
import { getAgeError } from "@/lib/validation";

// ── Stages ───────────────────────────────────────────────────────────────
//
// "confirmYou" is Bahagi 1 (see reportQuestions.ts REVIEW_SECTIONS) made
// into an actual screen the resident sees first, rather than something
// that only shows up retroactively at the top of the final review screen.
// Profile fields are prefilled before this stage renders (applyProfile in
// report.tsx) - this is a confirm-and-correct step, not a re-ask.

export type Stage = "intro" | "confirmYou" | "chunk" | "details" | "review" | "submitted";

export function makeEmptyAnswers(): AnswersMap {
  return REPORT_QUESTIONS.reduce(
    (acc, q) => ({ ...acc, [q.key]: { ...EMPTY_ANSWER } }),
    {} as AnswersMap
  );
}

export function makeEmptyChunks(): ChunksMap {
  return CHUNKS.reduce(
    (acc, c) => ({
      ...acc,
      [c.key]: { key: c.key, transcript: "", status: "empty", done: false },
    }),
    {} as ChunksMap
  );
}

// ── Merge rules ──────────────────────────────────────────────────────────

/**
 * Whether an incoming extracted value may overwrite what's already there.
 *
 * The governing rule, from the redesign plan: **never silently overwrite a
 * value the resident has already seen and confirmed.** Chunk 1 fills what it
 * can; chunks 2 and 3 only win if the resident actually re-recorded on that
 * screen, which is an explicit act.
 *
 *   | existing            | incoming  | result            |
 *   | empty               | extracted | take it           |
 *   | extracted, unseen   | extracted | take it (fresher) |
 *   | extracted, confirmed| extracted | KEEP existing     |
 *   | typed / spoken      | extracted | KEEP existing     |
 *   | tap / profile       | extracted | KEEP existing     |
 *
 * The last three matter most: an LLM guess must never clobber something a
 * person deliberately entered.
 */
export function canOverwrite(existing: AnswerState): boolean {
  if (!existing.text.trim()) return true;
  if (existing.source !== "extracted") return false;
  return !existing.confirmed;
}

/** Applies an extraction result to the answers map, honoring canOverwrite.
 *  `null`/empty values in the payload are ignored rather than written as
 *  blanks - "the model found nothing" must not erase what a person typed. */
export function mergeExtraction(
  answers: AnswersMap,
  extracted: Partial<Record<ReportFieldKey, string | null>>,
  chunk: ChunkKey
): AnswersMap {
  const next = { ...answers };

  for (const [rawKey, rawValue] of Object.entries(extracted)) {
    const key = rawKey as ReportFieldKey;
    const value = (rawValue ?? "").trim();
    if (!value) continue;
    if (!next[key]) continue;
    if (!canOverwrite(next[key])) continue;

    const question = getQuestion(key);

    // A choice field (incidentCategory) can be suggested by extraction, but
    // only if the model returned one of the real option values - never a
    // free-text label it invented. An unmatched suggestion is dropped
    // silently rather than shown as a bogus selected chip.
    if (question.inputType === "choice") {
      const match = question.options?.find((o) => o.value === value);
      if (!match) continue;
      next[key] = {
        ...next[key],
        text: match.label,
        value: match.value,
        status: "done",
        source: "extracted",
        chunk,
        confirmed: false,
      };
      continue;
    }

    next[key] = {
      ...next[key],
      text: value,
      status: "done",
      source: "extracted",
      chunk,
      confirmed: false,
    };
  }

  return next;
}

/** Marks every extracted field belonging to a chunk as seen-and-accepted.
 *  This is what "Tama po" does, and it's what locks those values against
 *  being overwritten by a later chunk's extraction. */
export function confirmChunkFields(answers: AnswersMap, chunk: ChunkKey): AnswersMap {
  const fields = CHUNKS.find((c) => c.key === chunk)?.extracts ?? [];
  const next = { ...answers };
  for (const key of fields) {
    if (!next[key]?.text.trim()) continue;
    if (next[key].source !== "extracted") continue;
    next[key] = { ...next[key], confirmed: true };
  }
  return next;
}

export function setAnswerValue(
  answers: AnswersMap,
  key: ReportFieldKey,
  patch: Partial<AnswerState>,
  source?: FieldSource
): AnswersMap {
  return {
    ...answers,
    [key]: {
      ...answers[key],
      ...patch,
      ...(source ? { source } : {}),
    },
  };
}

// ── Chunk screen mode ────────────────────────────────────────────────────

/**
 * Chunk 1 always records. Chunks 2 and 3 render as a confirmation card if
 * extraction already produced at least one of their fields, and fall back to
 * a plain record prompt otherwise.
 *
 * That fallback is the whole reason the LLM can be treated as an accelerator
 * rather than a dependency: if the extraction server is unreachable, every
 * chunk simply becomes a recording and the flow still completes.
 */
export type ChunkMode = "record" | "confirm";

export function chunkMode(chunkKey: ChunkKey, answers: AnswersMap, chunks: ChunksMap): ChunkMode {
  const chunk = CHUNKS.find((c) => c.key === chunkKey);
  if (!chunk) return "record";
  // The narrative chunk is never a confirmation - its whole purpose is
  // capturing the resident's own statement in their own voice.
  if (chunk.verbatimField) return "record";
  // If the resident already recorded this chunk themselves, keep showing the
  // record view so they can hear it back and redo it.
  if (chunks[chunkKey]?.uri) return "record";

  const hasPrefill = chunk.extracts.some((key) => answers[key]?.text.trim());
  return hasPrefill ? "confirm" : "record";
}

// ── Validation ───────────────────────────────────────────────────────────

export type ValidationResult = {
  missing: ReportFieldKey[];
  busy: boolean;
  canSubmit: boolean;
};

/** `guardianName` is required only when filing on a minor's behalf, which
 *  the static `required` flag can't express - hence its own check here. */
export function isFieldApplicable(key: ReportFieldKey, answers: AnswersMap): boolean {
  if (key !== "guardianName") return true;
  return answers.filedByGuardian?.value === "guardian";
}

export function validate(answers: AnswersMap): ValidationResult {
  const missing = REPORT_QUESTIONS.filter((q) => {
    if (!isFieldApplicable(q.key, answers)) return false;
    const isRequired =
      q.required || (q.key === "guardianName" && answers.filedByGuardian?.value === "guardian");
    if (!isRequired) return false;
    return !answers[q.key]?.text.trim();
  }).map((q) => q.key);

  const busy = REPORT_QUESTIONS.some(
    (q) => answers[q.key]?.status === "transcribing" || answers[q.key]?.status === "extracting"
  );

  // Present but out-of-range (a typo'd age, not an empty one) is a
  // different failure than `missing` above and gets its own check rather
  // than being folded into that list - `missing` means "nothing was
  // typed," this means "something was typed and it's wrong," and those
  // deserve different messages upstream. Still has to block submission the
  // same way, though - a legal document shouldn't go through with "999" as
  // someone's age just because ConfirmYouScreen's own gate got bypassed
  // (e.g. an edit made later, on Review).
  const ageText = answers.complainantAge?.text ?? "";
  const ageInvalid = Boolean(ageText.trim()) && Boolean(getAgeError(ageText));

  return { missing, busy, canSubmit: missing.length === 0 && !busy && !ageInvalid };
}

// ── Submission shape ─────────────────────────────────────────────────────

/**
 * The three-layer record, assembled at submit time.
 *
 *   raw         the verbatim transcripts + the narrative. Legally
 *               authoritative, never AI-altered.
 *   structured  the flat field map, for search / GIS / DILG rollups.
 *   brief       the officer-facing summary. Added by the caller after the
 *               /summarize round trip, and left null if that fails - a
 *               failed summary must never block a filing.
 */
export type ReportPayload = {
  raw: {
    narrative: string;
    transcripts: { chunk: ChunkKey; text: string }[];
  };
  structured: Record<string, string>;
  machineValues: Record<string, string | null>;
};

export function buildPayload(answers: AnswersMap, chunks: ChunksMap): ReportPayload {
  const structured = REPORT_QUESTIONS.reduce(
    (acc, q) => ({ ...acc, [q.key]: answers[q.key]?.text.trim() ?? "" }),
    {} as Record<string, string>
  );

  const machineValues = REPORT_QUESTIONS.filter((q) => q.inputType !== "voice").reduce(
    (acc, q) => ({ ...acc, [q.key]: answers[q.key]?.value ?? null }),
    {} as Record<string, string | null>
  );

  return {
    raw: {
      // The narrative is the complainant's own statement. It comes from the
      // answer (not the chunk transcript) so a correction the resident typed
      // themselves is preserved - but it is never replaced by a summary.
      narrative: answers.description?.text.trim() ?? "",
      transcripts: CHUNKS.filter((c) => chunks[c.key]?.transcript.trim()).map((c) => ({
        chunk: c.key,
        text: chunks[c.key].transcript.trim(),
      })),
    },
    structured,
    machineValues,
  };
}
