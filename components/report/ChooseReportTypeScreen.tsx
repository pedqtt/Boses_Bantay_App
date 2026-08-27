import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";

type ReportTypeOption = {
  key: "blotter" | "serviceComplaint";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  examples: string;
  /** Icon-circle tint per option, purely to make the two cards tell apart
   *  at a glance without reading either one first (Hick's Law - the choice
   *  should be scannable, not just readable). Reuses colors already
   *  established elsewhere in the app rather than introducing new ones:
   *  brand blue for blotter (this app's default action color), and the
   *  same amber pair profile.tsx already uses for its "in progress" ID
   *  status tone for the service complaint - not a new color addition. */
  tint: { bg: string; fg: string };
};

const OPTIONS: ReportTypeOption[] = [
  {
    key: "blotter",
    icon: "people-outline",
    title: "Blotter Report",
    body: "Para sa away, sigalot, o insidenteng may kinalaman sa ibang tao.",
    examples: "Gulo sa kapitbahay, banta, pananakit, pag-aaway",
    tint: { bg: colors.primaryContainer, fg: colors.primary },
  },
  {
    key: "serviceComplaint",
    icon: "construct-outline",
    title: "Serbisyo o Kagamitan",
    body: "Para sa sira o problema sa kalsada, ilaw, basura, o iba pang pasilidad.",
    examples: "Sirang poste, bukas na kanal, hindi kinolektang basura",
    tint: { bg: "#FDECC8", fg: "#92600C" },
  },
];

/**
 * Landing gate before the resident commits to either flow. Two very
 * different reports were previously forced through the same 4-step voice
 * flow (Blotter Flow Redesign Plan.md) - a resident reporting an open
 * manhole doesn't have a respondent, doesn't need a spoken narrative
 * chunked into "ano/kailan-saan/sino", and shouldn't be asked "sino ang
 * kausap ninyo" for a pothole. Splitting at the door instead of forcing
 * one flow to awkwardly cover both keeps each flow's questions honest to
 * what it's actually collecting (Hick's Law: fewer, more relevant choices
 * per screen, not one flow trying to be generic enough for everything).
 *
 * REDESIGN (component-hierarchy pass): the first version had every card
 * element at roughly the same visual weight - one icon color for both
 * options, and the "Hal. ..." examples line just a smaller copy of the
 * body text with no separation. Restructured into real top/middle/bottom
 * zones:
 *
 *   Top    - icon (now color-coded per option) + title + chevron. The
 *            entry point, per the component-hierarchy discipline.
 *   Middle - the one-line description. Secondary, not competing with the
 *            title for weight.
 *   Bottom - examples, demoted to genuine tertiary metadata: below a
 *            hairline divider, small icon + smaller/quieter text, so it
 *            reads as "for reference" rather than a second description.
 *
 * Renders into report.tsx's shared BahagiHeader chrome, same as every
 * other stage in that file - see report.tsx's "Chrome" comment.
 */
export function ChooseReportTypeScreen({
  onSelect,
}: {
  onSelect: (type: ReportTypeOption["key"]) => void;
}) {
  return (
    <ScrollView
      className="flex-1 px-6"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 28 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-[21px] font-bold text-ink tracking-tight mb-1.5">
        Anong ire-report ninyo?
      </Text>
      <Text className={`${REPORT_TYPE.subtitle} mb-6`}>
        Piliin po ang uri na pinaka-akma sa inyong sitwasyon.
      </Text>

      <View style={{ gap: 14 }}>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            className="bg-white border border-gray-200 rounded-2xl overflow-hidden active:opacity-80"
          >
            {/* Top zone - entry point: icon, title, chevron. Icon circle
                gets a thin ring in its own tint color - a flat fill alone
                read a little soft against the white card; the ring gives
                it a defined edge without needing a shadow. Chevron sits in
                its own quiet circle rather than floating bare, matching
                the "tap target should look like one" treatment used on
                cards elsewhere (directory.tsx's ContactRow). */}
            <View className="flex-row items-center px-5 pt-5 pb-4">
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 52,
                  height: 52,
                  marginRight: 14,
                  backgroundColor: opt.tint.bg,
                  borderWidth: 1.5,
                  borderColor: `${opt.tint.fg}33`,
                }}
              >
                <Ionicons name={opt.icon} size={24} color={opt.tint.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-[16.5px] font-bold text-ink">{opt.title}</Text>
                <Text className={`${REPORT_TYPE.hint} mt-1`}>{opt.body}</Text>
              </View>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 28, height: 28, marginLeft: 6, backgroundColor: colors.surfaceContainerHigh }}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} />
              </View>
            </View>

            {/* Bottom zone - examples demoted to real tertiary metadata:
                own strip below a hairline, tinted to match the card's icon
                color so it still reads as belonging to this card, not a
                generic gray footer shared by both. "Halimbawa:" as an
                inline label (not an icon) names what the line is instead
                of asking a small glyph to carry that meaning on its own. */}
            <View
              className="px-5 py-3"
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.outlineVariant,
                backgroundColor: `${opt.tint.bg}80`,
              }}
            >
              <Text style={{ fontSize: 12.5, lineHeight: 18 }}>
                <Text style={{ fontWeight: "700", color: opt.tint.fg }}>Halimbawa: </Text>
                <Text style={{ color: colors.onSurfaceVariant }}>{opt.examples}</Text>
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
