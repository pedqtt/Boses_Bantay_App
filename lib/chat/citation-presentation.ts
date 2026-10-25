/** Presentation only: preserve source identity and factual content. */
export type DisplayCitation = {
  id?: number;
  documentTitle: string;
  section: string;
  excerpt?: string;
};

export function unwrapExcerpt(text: string): string {
  // PDF extraction often inserts a line break after every word/visual line.
  // Keep paragraph breaks and explicit list entries, but join prose with spaces.
  const paragraphs = text.replace(/\r\n?/g, "\n").replace(/\u2028/g, "\n").replace(/\u2029/g, "\n\n").split(/\n[ \t]*\n+/).map((paragraph) =>
    paragraph.trim().split("\n").map((line) => line.trim()).filter(Boolean)
      .reduce((result, line) => result + (result ? (/^(?:[-*•]|\d+[.)])\s/.test(line) ? "\n" : " ") : "") + line, "")
  ).filter(Boolean);
  const result: string[] = [];
  const isolatedWord = (paragraph: string) => /^\S+$/.test(paragraph) && !/^(?:[-*•]|\d+[.)])$/.test(paragraph);
  for (let index = 0; index < paragraphs.length;) {
    let end = index;
    while (end < paragraphs.length && isolatedWord(paragraphs[end])) end++;
    // Some PDF extractors put blank lines between EVERY word. Three or more
    // isolated-word blocks form an extraction run, not useful paragraph breaks.
    // Leave ordinary paragraph boundaries and explicit list entries intact.
    if (end - index >= 3) {
      result.push(paragraphs.slice(index, end).join(" "));
      index = end;
    } else {
      result.push(paragraphs[index]);
      index++;
    }
  }
  return result.join("\n\n");
}

function literal(text: string): string {
  return text.replace(/\\([\\`*_{}\[\]<>#|])/g, "$1").replace(/\s+/g, " ").trim();
}

export function answerWithoutSourceList(text: string, citations: DisplayCitation[]): string {
  if (!citations.length) return text;
  const match = /(?:^|\n)[ \t]*(?:Sources|Pinagmulan):[ \t]*\n([\s\S]*)$/i.exec(text);
  if (!match) return text;
  const rows = match[1].split("\n").map((line) => line.trim()).filter(Boolean);
  // Only hide a source-only tail that exactly matches the structured cards.
  // An unexpected note or unmatched citation stays visible instead of being lost.
  const expected = new Set(citations.map((c, index) => literal(
    `[${c.id ?? index + 1}] ${c.documentTitle}${c.section ? ", " + c.section : ""}`
  )));
  if (!rows.length || !rows.every((line) => expected.has(literal(line)))) return text;
  return text.slice(0, match.index).trimEnd();
}

/** The mobile screen uses Bagong Chat instead of an in-answer menu footer. */
export function answerForDisplay(text: string, citations: DisplayCitation[]): string {
  return answerWithoutSourceList(text, citations).split("\n").filter((line) =>
    !/^\s*(?:Back to categories:\s*Menu(?:\s*\/\s*Mga Paksa)?|Bumalik sa mga kategorya:\s*Mga Paksa)\s*$/i.test(line)
  ).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type AnswerBlock = { kind: "paragraph"; text: string } | { kind: "list"; rows: { label: string; text: string }[] };

export function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let prose: string[] = [];
  const flush = () => {
    if (prose.length) blocks.push({ kind: "paragraph", text: prose.join(" ") });
    prose = [];
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const row = /^(\d+[.)]|[-*•])\s+(.+)$/.exec(line);
    if (row) {
      flush();
      const previous = blocks[blocks.length - 1];
      const item = { label: row[1], text: row[2] };
      if (previous?.kind === "list") previous.rows.push(item);
      else blocks.push({ kind: "list", rows: [item] });
    } else prose.push(line);
  }
  flush();
  return blocks;
}
