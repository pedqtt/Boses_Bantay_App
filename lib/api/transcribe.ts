import type { ReportFieldKey } from "@/lib/reportQuestions";
import { File } from "expo-file-system";
import { isSpeechConfigured, speechBackend } from "@/lib/api/speechBackend";

export const isWhisperConfigured = isSpeechConfigured;
export type TranscribeResult = { text: string };

/** Upload the real recording to the same base URL/key as the chatbot. */
export async function transcribeVoiceReport(audioUri: string, field?: ReportFieldKey): Promise<TranscribeResult> {
  const { url, key } = speechBackend();
  const formData = new FormData();
  const audioFile = new File(audioUri);
  if (!audioFile.exists || audioFile.size <= 0) {
    throw new Error("Hindi makita o walang laman ang recording. Mag-record po muli; hindi na ma-retry ang nawawalang audio.");
  }
  // Expo File is a Blob; let fetch generate the multipart boundary itself.
  formData.append("file", audioFile, audioFile.name || "recording.m4a");
  if (field) formData.append("field", field);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  try {
    const response = await fetch(`${url}/transcribe`, {
      method: "POST", body: formData, signal: controller.signal,
      headers: key ? { "X-API-Key": key } : undefined,
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error("Hindi tugma ang API key ng server. Kontakin po ang admin ng app.");
      if (response.status === 404) throw new Error("Hindi updated ang transcription endpoint. Buksan muli ang Start Boses Bantay.");
      if (response.status === 413) throw new Error("Masyadong malaki ang recording. Subukan pong mag-record ng mas maikli.");
      if (response.status === 422 || response.status === 415 || response.status === 400) throw new Error("Hindi mabasa ang recording. Subukan pong mag-record muli.");
      if (response.status === 503) throw new Error("Hindi pa handa o may pinoproseso pa ang transcription service. Pakisubukan muli sandali.");
      throw new Error("Nagka-problema ang transcription server. Subukan po muli.");
    }
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new Error("Hindi wastong sagot ang natanggap mula sa transcription server. Subukan po muli."); }
    const text = typeof (data as { text?: unknown } | null)?.text === "string" ? (data as { text: string }).text.trim() : "";
    if (!text) throw new Error("Walang narinig na sagot. Subukan po muling mag-record.");
    return { text };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Masyadong matagal ang pag-transcribe. Subukan pong mag-record ng mas maikli.");
    if (error instanceof TypeError) throw new Error("Hindi maabot ang transcription server. Tiyaking naka-on ang backend at nasa parehong Wi-Fi ang telepono at laptop.");
    throw error;
  } finally { clearTimeout(timeout); }
}
