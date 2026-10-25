export type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
  citations?: { id?: number; documentTitle: string; section: string; excerpt?: string; revision?: number }[];
  suggestions?: string[];
  status?: string;
  retryable?: boolean;
  retryQuery?: string;
  language?: "english" | "tagalog" | "taglish";
};

import menu from "@/services/chatbot/rag-bot/menu_kb.json";

export const CHAT_GREETING = menu.greeting;
export const CHAT_CLOSING = menu.closing.taglish;
export const CHAT_CATEGORIES = menu.categories.map((category) => ({
  id: category.id, label: category.name.english,
  example: category.example.english,
}));

function configuration() {
  const url = (process.env.EXPO_PUBLIC_RAG_API_URL?.trim() || "").replace(/\/+$/, "");
  const key = process.env.EXPO_PUBLIC_RAG_API_KEY?.trim() || "";
  if (!url || !key) throw new Error("Hindi naka-configure ang updated Barangay-Bot. Kailangan ang RAG API URL at key.");
  return { url, key };
}

async function request(path: string, payload: object, timeoutMs = 180_000): Promise<any> {
  const { url, key } = configuration();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": key },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new Error("Hindi tinanggap ang chat session o API key. Subukang mag-Bagong Chat.");
      if (response.status === 404) throw new Error("Hindi updated ang chatbot endpoint. Kailangan ang mobile RAG API.");
      throw new Error(typeof body?.answer === "string" ? body.answer : "Hindi available ang Barangay-Bot ngayon. Subukan muli.");
    }
    return body;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Matagal sumagot ang Barangay-Bot. Subukan muli.");
    if (error instanceof TypeError) throw new Error("Hindi makakonekta sa Barangay-Bot. Pakisuri ang koneksyon at chatbot server.");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function createBotSession(): Promise<string> {
  const body = await request("/api/session", {}, 15_000);
  if (typeof body?.session_id !== "string" || !/^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(body.session_id)) {
    throw new Error("Hindi makagawa ng chat session. Subukan muli.");
  }
  return body.session_id;
}

export async function sendBotMessage(text: string, sessionId: string): Promise<ChatMessage> {
  const body = await request("/api/chat", { query: text.trim(), session_id: sessionId });
  if (typeof body?.answer !== "string" || !body.answer.trim()) throw new Error("Walang valid na sagot mula sa Barangay-Bot. Subukan muli.");
  const citations = Array.isArray(body.sources) ? body.sources.filter(
    (item: any) => Number.isInteger(item?.id) && item.id > 0 && typeof item.documentTitle === "string" && typeof item.section === "string"
  ) : [];
  const suggestions: string[] = Array.isArray(body.suggestions) ? [...new Set<string>(body.suggestions.filter(
    (item: unknown): item is string => typeof item === "string" && item.trim().length > 0 && item.length <= 160
  ))].slice(0, 12) : [];
  return { id: `bot-${Date.now()}`, from: "bot", text: body.answer, citations, suggestions,
    language: ["english", "tagalog", "taglish"].includes(body.language) ? body.language : undefined,
    status: body.status, retryable: body.retryable === true, retryQuery: body.retryable === true ? text : undefined };
}
