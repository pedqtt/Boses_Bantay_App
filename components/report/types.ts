// Shared runtime types for the guided report flow. Kept separate from
// lib/reportQuestions.ts on purpose: that file is static configuration (the
// 7 questions, their copy, their grouping) and has no business knowing about
// UI/runtime concerns like "is this answer still transcribing." This file is
// the reverse — it's about the state a screen holds while a resident is
// actually filling the form out, and it imports the config types it needs.
import type { ReportFieldKey } from "@/lib/reportQuestions";

export type AnswerStatus = "empty" | "transcribing" | "done" | "error";

/** One answer's state. Transcription runs in the background (see
 *  report.tsx's transcribeInBackground), so an answer can be "pending" while
 *  the resident is already on a later question — every screen that reads
 *  this needs to distinguish "still working" from "failed" from "done". */
export type AnswerState = {
  text: string;
  status: AnswerStatus;
  error?: string;
  /** Kept so a failed answer can be retried, or replayed, without
   *  re-recording. */
  uri?: string;
};

export type AnswersMap = Record<ReportFieldKey, AnswerState>;

export const EMPTY_ANSWER: AnswerState = { text: "", status: "empty" };
