import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

type BahagiHeaderProps = {
  /** The section's own name - "Sino ang Nagrereklamo", "Ang Insidente",
   *  "Huling Detalye", "Suriin ang Report". Primary: this is what a
   *  resident actually needs to answer "where am I," not the raw step
   *  count. */
  label: string;
  /** "Bahagi 2 ng 5" - secondary, shown as a quiet pill next to `label`.
   *  Omitted on IntroScreen, which has no numbered position yet. */
  stepText?: string;
  /** How many of `totalSegments` read as done, current step included. 0 on
   *  Intro (nothing started), `totalSegments` on Details/Review
   *  (everything done). */
  filledSegments: number;
  totalSegments: number;
  onBack: () => void;
  backDisabled?: boolean;
};

/** Dot-and-connector stepper, not a plain filled bar. A bar communicates
 *  "how much" but not "which one" - at a glance it reads the same whether
 *  a resident is on step 2 or step 3 of a 5-segment bar unless they stop
 *  and count filled segments. Marking the current step as its own larger,
 *  ringed dot answers "where am I right now" directly, the way a physical
 *  form's numbered checklist would, while the connecting lines still carry
 *  the same "how much is behind me" signal the bar did. */
function Stepper({ total, current }: { total: number; current: number }) {
  return (
    <View className="flex-row items-center">
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isCurrent = step === current;
        const isLast = step === total;

        return (
          <View key={i} className="flex-row items-center" style={{ flex: isLast ? 0 : 1 }}>
            <View
              style={{
                width: isCurrent ? 11 : 7,
                height: isCurrent ? 11 : 7,
                borderRadius: 999,
                backgroundColor: isDone || isCurrent ? colors.primary : colors.outlineVariant,
                borderWidth: isCurrent ? 2.5 : 0,
                borderColor: colors.primaryContainer,
              }}
            />
            {!isLast && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  marginHorizontal: 4,
                  borderRadius: 1,
                  backgroundColor: isDone ? colors.primary : colors.outlineVariant,
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * The header every screen in the live report flow shares - Intro, the four
 * numbered Bahagi screens (ConfirmYouScreen, the two chunk screens,
 * DetailsScreen), and Review. One component instead of six near-identical
 * copies of the same JSX, so a header change happens once and can't drift
 * out of sync between screens.
 *
 * Two stacked zones:
 *
 *   1. Identity - back chevron and the section's own name in one row,
 *      separated by a thin vertical rule instead of being pushed to
 *      opposite ends of the row. Back-then-title reads as one connected
 *      unit ("go back from Bahagi 2") rather than two unrelated controls
 *      sharing a shelf, which is what a `justify-between` split with
 *      DraftBadge on the far right used to produce. DraftBadge is gone
 *      from here entirely - it was repeating on every one of six screens,
 *      which is exactly the "shown so often it stops registering" failure
 *      its own doc comment warns about; it still appears where it actually
 *      matters (SubmittedScreen, right after a resident submits).
 *      The name itself is 17px bold - trimmed down from an earlier 20px,
 *      which read as heavier than a label needs to be once it's sharing a
 *      row with the back chevron and divider rather than owning a row to
 *      itself. Screen labels themselves are kept short for the same
 *      reason ("Nagrereklamo" not "Sino ang Nagrereklamo") - this is a
 *      wayfinding label glanced at, not body copy read in full. Paired
 *      with its numeric position as a brand-tinted pill at the row's far
 *      end, now 12px to match the title's smaller scale - still at
 *      REPORT_TYPE.fieldLabel's 12px floor, not below it, so it stays
 *      legible while no longer competing with the title for size.
 *   2. Progress - a dot-and-connector stepper instead of a flat filled bar
 *      (see Stepper's own comment for why), sized to `totalSegments` with
 *      the current step as its own larger, ringed dot.
 *
 * `filledSegments` doubles as "the current step number" (1-indexed) for the
 * stepper - the segment at `filledSegments` is drawn as current, everything
 * before it as done, everything after as upcoming. Callers pass one number;
 * they don't need to know the stepper distinguishes "done" from "current"
 * internally.
 */
export function BahagiHeader({
  label,
  stepText,
  filledSegments,
  totalSegments,
  onBack,
  backDisabled,
}: BahagiHeaderProps) {
  return (
    <View
      className="px-6 pt-5 pb-6"
      // A flat header sitting directly on ScreenBackground's dot texture had
      // no edge at all - content below would scroll right up under it with
      // nothing marking where the header ends. A solid backgroundColor
      // (matching the page surface exactly, not white, so it doesn't itself
      // look like a card and doesn't band against ScreenBackground's own
      // color) plus a barely-there shadow gives it that edge without a hard
      // border line, which would read as heavier than this chrome needs to
      // be. Offset is downward-only and small (height 1, no width) and
      // opacity/radius are both low, so the shadow only reads below the
      // header, fading out almost immediately - not a halo around the whole
      // bar. elevation is Android's equivalent of the iOS shadow props -
      // both are needed since RN doesn't unify them.
      style={{
        backgroundColor: colors.surface,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View className="flex-row items-center mb-5">
        <Pressable
          onPress={onBack}
          disabled={backDisabled}
          hitSlop={12}
          className="active:opacity-60"
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurfaceVariant} />
        </Pressable>

        {/* Same thin-rule-as-separator pattern PhoneInput uses between
            "+63" and its digit field - a minimalist divider instead of
            pushing the back button and title to opposite ends of the row. */}
        <View className="w-px h-7 bg-gray-300 mx-4" />

        <Text
          numberOfLines={1}
          className="flex-1 mr-3 text-[17px] font-bold text-ink tracking-tight"
        >
          {label}
        </Text>
        {stepText && (
          <View className="bg-brand-50 rounded-full px-3 py-1">
            <Text className="text-[13px] font-semibold text-brand-dark">{stepText}</Text>
          </View>
        )}
      </View>

      <Stepper total={totalSegments} current={filledSegments} />
    </View>
  );
}
