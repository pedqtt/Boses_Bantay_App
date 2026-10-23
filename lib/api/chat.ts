export type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
  citations?: { id?: number; documentTitle: string; section: string; excerpt?: string; revision?: number }[];
  suggestions?: string[];
  status?: string;
  retryable?: boolean;
  retryQuery?: string;
};

export async function sendBotMessage(text: string, history: ChatMessage[] = []): Promise<ChatMessage> {
  const baseUrl = (process.env.EXPO_PUBLIC_CHAT_API_URL?.trim() || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("Hindi naka-configure ang Barangay-Bot server.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const key = process.env.EXPO_PUBLIC_CHAT_API_KEY || "";
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "X-API-Key": key } : {}),
      },
      body: JSON.stringify({
        query: text.trim(),
        history: history.filter((message) => message.id !== "welcome" && !message.retryable).slice(-6).map((message) => ({
          role: message.from === "user" ? "user" : "assistant",
          content: ((message.suggestions?.length ? "Suggested questions:\n" + message.suggestions.map((question, index) => `${index + 1}. ${question}`).join("\n") + "\n" : "") + message.text).slice(0, 1200),
        })),
      }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok && !(response.status === 503 && typeof body?.answer === "string")) {
      if (response.status === 401) throw new Error("Hindi tinanggap ng Barangay-Bot server ang API key.");
      if (response.status === 404) throw new Error("Hindi available ang chat endpoint. Pakisuri ang server URL at i-restart ang updated server.");
      throw new Error("Hindi available ang Barangay-Bot server ngayon. Subukan muli mamaya.");
    }
    if (typeof body?.answer !== "string" || !body.answer.trim()) {
      throw new Error("Walang valid na sagot mula sa Barangay-Bot server. Subukan muli.");
    }
    const sourceList = body.sources ?? body.citations;
    const citations = Array.isArray(sourceList) ? sourceList.filter(
      (item: any) => typeof item?.documentTitle === "string" && typeof item?.section === "string"
    ) : [];
    const suggestions: string[] = Array.isArray(body.suggestions) ? [...new Set<string>(body.suggestions.filter(
      (question: unknown): question is string => typeof question === "string" && question.trim().length > 0 && question.length <= 160
    ))].slice(0, 3) : [];
    const replyText = suggestions.length && typeof body.displayAnswer === "string" && body.displayAnswer.trim() ? body.displayAnswer : body.answer;
    return { id: `bot-${Date.now()}`, from: "bot", text: replyText, citations, suggestions,
      status: body.status, retryable: body.retryable === true,
      retryQuery: body.retryable === true ? text : undefined };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Matagal sumagot ang Barangay-Bot. Subukan muli.");
    if (error instanceof TypeError) throw new Error("Hindi makakonekta sa Barangay-Bot. Pakisuri ang internet at server.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
