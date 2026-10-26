/** Speech and report helpers share the chatbot address when it is configured. */
export const isSpeechConfigured = Boolean(
  process.env.EXPO_PUBLIC_RAG_API_URL?.trim() || process.env.EXPO_PUBLIC_WHISPER_API_URL?.trim()
);

export function speechBackend(): { url: string; key: string } {
  const ragUrl = process.env.EXPO_PUBLIC_RAG_API_URL?.trim();
  const url = (ragUrl || process.env.EXPO_PUBLIC_WHISPER_API_URL?.trim() || "").replace(/\/+$/, "");
  const key = (ragUrl ? process.env.EXPO_PUBLIC_RAG_API_KEY : process.env.EXPO_PUBLIC_WHISPER_API_KEY)?.trim() || "";
  if (!url) throw new Error("Hindi naka-configure ang transcription server. Kontakin po ang admin ng app.");
  if (ragUrl && !key) throw new Error("Hindi naka-configure ang API key ng shared server. Kontakin po ang admin ng app.");
  return { url, key };
}
