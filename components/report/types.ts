// Shared runtime types for the guided report flow. Kept separate from
// lib/reportQuestions.ts on purpose: that file is static configuration (the
// chunks, the fields, their copy) and has no business knowing about
// UI/runtime concerns like "is this answer still transcribing." This file is
// the reverse - it's about the state a screen holds while a resident is
// actually filling the form out, and it imports the config types it needs.
import type { ReportFieldKey, ChunkKey } from "@/lib/reportQuestions";

export type AnswerStatus = "empty" | "transcribing" | "extracting" | "done" | "error";

/**
 * Where a value came from. This is not cosmetic:
 *
 *   - it drives the provenance badge on the review screen, so a resident can
 *     tell at a glance what they said themselves versus what the app filled
 *     in for them and they merely agreed to;
 *   - it's the only way to measure extraction quality during ISO 25010
 *     testing (what fraction of fields came back "extracted" and survived to
 *     submission unedited);
 *   - the merge rule in reportFlow.ts reads it to decide whether a later
 *     chunk may overwrite an earlier chunk's value.
 */
export type FieldSource =
  /** Prefilled from the resident's account. Never asked. */
  | "profile"
  /** Verbatim transcript of a chunk recording - the resident's own words. */
  | "spoken"
  /** Lifted from a transcript by the LLM, not yet touched by the resident. */
  | "extracted"
  /** The resident typed or corrected it by hand. */
  | "typed"
  /** Selected from chips/toggles on the details screen. */
  | "tap";

/** One answer's state. Transcription and extraction run in the background
 *  (see report.tsx), so an answer can still be working while the resident is
 *  already on a later screen - every screen that reads this needs to
 *  distinguish "still working" from "failed" from "done". */
export type AnswerState = {
  /** What's shown/edited on screen. For voice fields this is the transcript;
   *  for choice/checkbox fields this is the selected option's display label,
   *  so logic that reads `.text` to check "is there an answer" works
   *  unchanged for both kinds. */
  text: string;
  status: AnswerStatus;
  source: FieldSource;
  error?: string;
  /** Kept so a failed answer can be retried, or replayed, without
   *  re-recording. Only ever set for spoken answers. */
  uri?: string;
  /** The stable machine value for a choice/checkbox answer (e.g.
   *  "record_only"), separate from the display label in `text`. */
  value?: string;
  /** Which chunk produced this, for extracted/spoken values. Lets the merge
   *  rule tell "chunk 1 guessed this" apart from "the resident re-recorded
   *  it on chunk 2". */
  chunk?: ChunkKey;
  /** True once the resident has explicitly seen and accepted an extracted
   *  value (tapped "Tama po"). An extracted-but-unconfirmed value is still
   *  shown, but the review screen flags it differently. */
  confirmed?: boolean;
};

export type AnswersMap = Record<ReportFieldKey, AnswerState>;

export const EMPTY_ANSWER: AnswerState = { text: "", status: "empty", source: "typed" };

/** One chunk's recording state. The transcript is kept separately from the
 *  fields it produced, because the raw transcript is the legally
 *  authoritative layer and must survive any later edit to an extracted
 *  field - see the three-layer record model in the redesign plan. */
export type ChunkState = {
  key: ChunkKey;
  transcript: string;
  uri?: string;
  status: AnswerStatus;
  error?: string;
  /** True once this chunk has been recorded or explicitly confirmed, so the
   *  flow knows it can move on. */
  done: boolean;
};

export type ChunksMap = Record<ChunkKey, ChunkState>;
