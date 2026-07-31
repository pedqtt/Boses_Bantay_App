import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import type { ChapterProgress } from "@/lib/reportQuestions";

/**
 * The header now does two jobs the previous version undersold: it's the
 * one line that tells a resident "here's where you are," so it needs to
 * read like an actual title, not a quiet eyebrow tag. The topic icon that
 * used to float alone above the question moved in here too — as a small
 * accent next to the title instead of an isolated 48px circle with nothing
 * around it — so nothing on this screen is an orphaned decoration; the icon
 * now visibly belongs to the thing it's labeling.
 *
 * The progress count ("1/3") stays a small solid pill — it's a status
 * marker, meant to be scanned past once the pattern is known — while the
 * chapter title is now the dominant element on this row: larger, bolder,
 * full ink-black instead of secondary tone.
 */
export function ChapterProgressHeader({
  progress,
  isOptional,
}: {
  progress: ChapterProgress;
  isOptional: boolean;
}) {
  return (
    // More generous padding (pt-5 pb-6, was pt-3 pb-4) plus a hairline
    // bottom border — this is what makes it read as an actual header band
    // sitting above the content, rather than just the first few lines of
    // the scrolling page that happen to have a progress bar in them.
    <View className="px-5 pt-5 pb-6 border-b border-gray-100">
      <View className="flex-row items-center justify-between mb-4">
        {/* Icon + title anchor the left edge (natural reading start);
            the "1/3" pill is a status marker, not content, so it sits at
            the row's far right — the same spot a screen title's trailing
            metadata (a count, a badge) conventionally lives. */}
        <View className="flex-row items-center flex-1 mr-3">
          <Ionicons name={progress.chapter.icon as any} size={18} color="#1D4ED8" style={{ marginRight: 6 }} />
          <Text className="text-[18px] font-bold text-ink flex-1" numberOfLines={1}>
            {progress.chapter.label}
          </Text>
        </View>
        <View className="flex-row items-center">
          {isOptional && <Text className={`${REPORT_TYPE.caption} mr-2`}>Opsyonal</Text>}
          <View className="bg-brand rounded-full px-2.5 py-1">
            <Text
              className="text-[11px] font-bold text-white uppercase tracking-wide"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {progress.chapterNumber}/{progress.totalChapters}
            </Text>
          </View>
        </View>
      </View>
      <View className="flex-row gap-1.5">
        {Array.from({ length: progress.stepsInChapter }).map((_, i) => (
          <View
            key={i}
            className={`flex-1 h-1.5 rounded-full ${i < progress.stepInChapter ? "bg-brand" : "bg-gray-200"}`}
          />
        ))}
      </View>
    </View>
  );
}
