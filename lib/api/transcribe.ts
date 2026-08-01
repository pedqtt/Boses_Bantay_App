// Voice-report transcription. Same mock/real pattern as lib/api/auth.ts —
// this function is the ONLY thing screens call, never fetch() directly, so
// wiring up the real Whisper server later is a one-file change.

import type { ReportFieldKey } from "@/lib/reportQuestions";

const WHISPER_API_URL = process.env.EXPO_PUBLIC_WHISPER_API_URL ?? "";
// Only needed once the server is reachable from the open internet (see
// whisper-server/README.md's tunnel setup) — empty is fine for same-Wi-Fi
// local dev, where the server has no WHISPER_API_KEY set either.
const WHISPER_API_KEY = process.env.EXPO_PUBLIC_WHISPER_API_KEY ?? "";

// True once EXPO_PUBLIC_WHISPER_API_URL points at a running server (see
// ../../whisper-server). Until then, transcribeVoiceReport() returns a fake
// transcript after a short delay so the recording flow is fully clickable
// with zero backend — same idea as mock auth mode.
export const isWhisperConfigured = Boolean(WHISPER_API_URL);

// A silent fallback to fake transcripts is exactly the kind of bug that
// looks like "the app is broken" instead of "the app is unconfigured" —
// this makes the distinction loud and impossible to miss in logs, instead
// of only being discoverable by reading this file's source.
if (!isWhisperConfigured) {
  console.warn(
    "[transcribe] EXPO_PUBLIC_WHISPER_API_URL is not set in this build — " +
      "every voice answer will return a canned mock transcript instead of a real one. " +
      "If this is an installed APK, the .env values weren't present when it was built " +
      "(EAS Build does not read a gitignored .env by default — set the vars with " +
      "`eas env:create` instead, then rebuild)."
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Per-field mock answers so the guided flow is realistic to click through
// without a server — each one is a plausible answer to that specific
// question, not a generic blob, which makes the review screen actually
// useful to design and test against.
const MOCK_ANSWERS: Record<ReportFieldKey, string> = {
  reporter: "Ako po si Maria Santos, taga-Purok 3, Blok 7 Lote 12, dito po sa barangay.",
  incidentAt: "Kagabi po, mga alas-onse ng gabi hanggang madaling araw.",
  location: "Sa tapat po ng bahay namin sa Purok 3, malapit sa sari-sari store ni Aling Nena.",
  otherParties: "Si Mang Rudy po, yung kapitbahay namin sa katabing bahay.",
  description:
    "Sobrang lakas po ng videoke nila kagabi, hindi po kami makatulog. Pangatlong beses na po ito ngayong buwan. Nakiusap na po ako noong isang linggo pero hindi po nila pinansin. Yung mga bata po namin, may klase pa kinabukasan at hindi po nakatulog nang maayos.",
  witnesses: "Meron po, si Aling Nena at yung pamilya po sa kabilang bahay, nakarinig din po sila.",
  evidence: "May video po ako sa cellphone ko na kinunan ko kagabi, madadala ko po.",
};

const GENERIC_MOCK =
  "Gusto ko po sanang i-report ang nangyari kagabi sa amin dito sa Purok 3.";

export type TranscribeResult = { text: string };

/**
 * Transcribes one recorded answer.
 *
 * `field` tells the server which of the 7 interview questions this clip
 * answers, so it can prime Whisper with vocabulary specific to that answer
 * type (names for the identity question, dates/times for the when question,
 * and so on). Omitting it still works — the server falls back to generic
 * Taglish tuning.
 */
export async function transcribeVoiceReport(
  audioUri: string,
  field?: ReportFieldKey
): Promise<TranscribeResult> {
  if (!isWhisperConfigured) {
    await delay(1200);
    const text = field ? MOCK_ANSWERS[field] : GENERIC_MOCK;
    console.log(`[mock] "Transcribed" ${field ?? "report"} -> ${text.slice(0, 40)}...`);
    return { text };
  }

  const formData = new FormData();
  // React Native's fetch/FormData accepts this shape for file uploads —
  // not a real Blob, just { uri, name, type }.
  formData.append("file", {
    uri: audioUri,
    name: "voice-report.m4a",
    type: "audio/m4a",
  } as unknown as Blob);
  if (field) formData.append("field", field);

  // Long recordings take real time to transcribe on the server (large-v3 is
  // not instant), and the app has no way to know if the request is just slow
  // or truly stuck — so give it a generous ceiling and fail loudly rather
  // than hang forever with the spinner never resolving.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min

  let res: Response;
  try {
    res = await fetch(`${WHISPER_API_URL}/transcribe`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      // NOTE: do NOT set Content-Type manually here. fetch/FormData needs to
      // generate its own header with the multipart boundary included — a
      // hardcoded "multipart/form-data" (no boundary) means the server can't
      // parse the body at all and silently fails on every real (non-mock)
      // request.
      headers: WHISPER_API_KEY ? { "X-API-Key": WHISPER_API_KEY } : undefined,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(
        "Masyadong matagal ang pag-transcribe. Subukan pong mag-record ng mas maikli."
      );
    }
    throw new Error(
      "Hindi maabot ang server. Tiyakin pong may internet ang telepono at gumagana ang server."
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // 401 specifically means the app and server disagree on the API key —
    // a config problem, not a transient network/server issue, so it gets
    // its own message instead of the generic "(status) + raw body" dump,
    // which would otherwise show a resident a JSON error blob.
    if (res.status === 401) {
      throw new Error(
        "Hindi tugma ang API key ng server. Kontakin po ang admin ng app."
      );
    }
    if (res.status >= 500) {
      throw new Error(
        "Nagka-problema ang transcription server. Subukan po muli pagkalipas ng ilang saglit."
      );
    }
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Hindi na-transcribe (${res.status}). ${detail.slice(0, 120) || "Tingnan po kung tumatakbo pa ang server."}`
    );
  }

  const data = await res.json();
  const text = String(data.text ?? "").trim();

  // A successful request that comes back empty means Whisper heard nothing
  // usable — silence, or the mic caught only background noise. That's a
  // different failure from a network/server error and needs different
  // recovery copy, so surface it distinctly instead of setting an empty
  // answer and letting the resident think it worked.
  if (!text) {
    throw new Error("Walang narinig na sagot. Subukan po muling mag-record.");
  }

  return { text };
}
