import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ChatMessage } from "@/lib/api/chat";
import { colors } from "@/lib/theme";
import { answerBlocks, answerForDisplay, unwrapExcerpt } from "@/lib/chat/citation-presentation";

/** Keep the answer readable; original source excerpts are available on demand. */
export function ChatResponse({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const citations = message.citations ?? [];
  const ids = new Set(citations.map((citation, index) => citation.id ?? index + 1));
  const tagalog = message.language === "tagalog" || /(?:^|\n)Pinagmulan:/.test(message.text);
  const answer = answerForDisplay(message.text, citations);
  const inline = (text: string) => text.split(/(\[\d+\])/g).map((part, index) => {
    const match = /^\[(\d+)\]$/.exec(part);
    const id = match ? Number(match[1]) : null;
    return id !== null && ids.has(id) ? (
      <Text key={index} onPress={() => setExpanded(id)} accessibilityRole="link"
        accessibilityLabel={`${tagalog ? "Tingnan ang pinagmulan" : "View source"} ${id}`}
        style={{ color: colors.primary, fontWeight: "600" }}>{part}</Text>
    ) : part;
  });
  return (
    <View style={{ width: "100%", minWidth: 0, alignSelf: "stretch" }}>
      <View style={{ gap: 16 }}>
        {answerBlocks(answer).map((block, index) => block.kind === "paragraph" ? (
          <Text key={index} selectable style={{ fontSize: 15, lineHeight: 24, color: colors.onSurface }}>{inline(block.text)}</Text>
        ) : (
          <View key={index} style={{ gap: 12 }}>
            {block.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Text style={{ minWidth: 20, fontSize: 14, lineHeight: 24, color: colors.primary, fontWeight: "600" }}>{row.label}</Text>
                <Text selectable style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 24, color: colors.onSurface }}>{inline(row.text)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      {citations.length > 0 && (
        <View style={{ width: "100%", minWidth: 0, marginTop: 24, borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.onSurfaceVariant }}>{tagalog ? "Pinagmulan" : "Sources"}</Text>
            <Text style={{ fontSize: 12, color: colors.onSurfaceFaint }}>{citations.length}</Text>
          </View>
          {citations.map((citation, index) => {
            const id = citation.id ?? index + 1;
            const open = expanded === id;
            const excerpt = citation.excerpt ? unwrapExcerpt(citation.excerpt) : "";
            return (
              <View key={`${id}-${citation.documentTitle}`} style={{ width: "100%", minWidth: 0, flexGrow: 0, borderWidth: 1, borderColor: open ? colors.primaryMuted : colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, borderRadius: 16, overflow: "hidden" }}>
                <Pressable onPress={excerpt ? () => setExpanded(open ? null : id) : undefined}
                  disabled={!excerpt} accessibilityRole={excerpt ? "button" : undefined}
                  accessibilityState={excerpt ? { expanded: open } : undefined}
                  accessibilityLabel={`${tagalog ? "Pinagmulan" : "Source"} ${id}: ${citation.documentTitle}${citation.section ? ", " + citation.section : ""}`}
                  style={{ padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 10, minHeight: 52 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{id}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={{ fontSize: 13, lineHeight: 19, fontWeight: "600", color: colors.onSurface }} numberOfLines={open ? undefined : 2}>{citation.documentTitle}</Text>
                    {citation.section ? <Text style={{ fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant }}>{citation.section}</Text> : null}
                    {excerpt ? <Text style={{ fontSize: 12, lineHeight: 17, color: colors.primary }}>{open ? (tagalog ? "Itago ang sipi" : "Hide excerpt") : (tagalog ? "Tingnan ang sipi" : "Show excerpt")}</Text> : null}
                  </View>
                  {excerpt ? <Ionicons name={open ? "chevron-up" : "chevron-down"} size={15} color={colors.onSurfaceFaint} style={{ marginTop: 6 }} /> : null}
                </Pressable>
                {open && excerpt ? (
                  <View style={{ width: "100%", minWidth: 0, maxWidth: 640, alignSelf: "flex-start", flexGrow: 0, flexShrink: 0, paddingHorizontal: 12, paddingBottom: 12 }}>
                    <View style={{ width: "100%", minWidth: 0, borderLeftWidth: 2, borderLeftColor: colors.primaryMuted, backgroundColor: colors.surfaceContainerHigh, padding: 12, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.onSurfaceVariant, marginBottom: 6 }}>{tagalog ? "Sipi mula sa dokumento" : "Document excerpt"}</Text>
                      <Text selectable style={{ width: "100%", alignSelf: "stretch", flexGrow: 0, flexShrink: 0, fontSize: 14, lineHeight: 22, color: colors.onSurfaceVariant }}>{excerpt}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
