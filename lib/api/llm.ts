// Extraction + officer-brief calls against the barangay's own server.
// Same mock/real pattern as transcribe.ts and auth.ts: screens never call
// fetch() directly, so pointing this at a live server later is a one-file
// change.
//
// EVERYTHING HERE IS OPTIONAL BY DESIGN.
// ──────────────────────────────────────
// The LLM is an accelerator, not a dependency. Every function below returns
// an empty result rather than throwing when the server is unreachable or
// misbehaving, because a resident must always be able to file a report even
// if the AI side is completely down. The flow degrades to plain recordings
// (see chunkMode in lib/reportFlow.ts) and the officer simply gets the raw
// statement, which is exactly today's paper experience - no worse.

import type { ReportFieldKey, ChunkKey } from "@/lib/reportQuestions";

const LLM_API_URL = process.env.EXPO_PUBLIC_WHISPER_API_URL ?? "";
const LLM_API_KEY = process.env.EXPO_PUBLIC_WHISPER_API_KEY ?? "";

export const isLlmConfigured = Boolean(LLM_API_URL);

/** Extraction should feel instant relative to the transcription that just
 *  finished. If it doesn't come back quickly, the resident is better served
 *  by a plain record prompt than by a spinner. */
const EXTRACT_TIMEOUT_MS = 30_000;
/** The brief runs while the resident is already on a submit spinner, so it
 *  can afford longer - but not unbounded. */
const SUMMARIZE_TIMEOUT_MS = 45_000;

export type ExtractionResult = Partial<Record<ReportFieldKey, string | null>>;

export type OfficerBrief = {
  text: string;
  completenessFlags: string[];
  signalFlags: string[];
  requestedActions: string[];
  generatedBy: string;
  generatedAt: string;
};

function authHeaders(): Record<string, string> {
  return LLM_API_KEY ? { "X-API-Key": LLM_API_KEY } : {};
}

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T | null> {
  if (!isLlmConfigured) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${LLM_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[llm] ${path} returned ${res.status}; continuing without it.`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    // Deliberately swallowed. See the header comment: a failure here must
    // never surface to the resident as an error, because nothing they were
    // trying to do has actually failed.
    console.warn(`[llm] ${path} unavailable (${err?.name ?? "error"}); continuing without it.`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pulls structured fields out of one chunk's transcript.
 *
 * Returns `{}` on any failure, which the caller treats identically to "the
 * model found nothing" - both mean the chunk falls back to a record prompt.
 */
export async function extractFromTranscript(
  transcript: string,
  chunk: ChunkKey
): Promise<ExtractionResult> {
  if (!transcript.trim()) return {};
  const result = await postJson<ExtractionResult>(
    "/extract",
    { transcript, chunk },
    EXTRACT_TIMEOUT_MS
  );
  return result ?? {};
}

/**
 * Generates the receiving officer's triage brief.
 *
 * This is the one place the model writes prose rather than lifting spans,
 * which is exactly why the result is stored as a clearly-labelled, non
 * authoritative layer alongside the raw statement rather than replacing it.
 * Returns null on failure; the report still submits.
 */
export async function summarizeForOfficer(
  narrative: string,
  structured: Record<string, string>
): Promise<OfficerBrief | null> {
  if (!narrative.trim()) return null;
  return postJson<OfficerBrief>(
    "/summarize",
    { narrative, structured },
    SUMMARIZE_TIMEOUT_MS
  );
}
