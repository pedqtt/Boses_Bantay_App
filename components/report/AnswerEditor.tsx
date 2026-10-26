import { Text, TextInput } from "@/components/AppText";
import { useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";

type AnswerEditorProps = {
  editable?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  isTranscribing: boolean;
  transcribingLabel?: string;
  /** Passthrough for callers that need their own onFocus behavior. Every
   *  current caller renders this inside a KeyboardAwareScrollView (react-
   *  native-keyboard-controller), which already scrolls the focused field
   *  clear of the keyboard on its own - this prop is unused by them and
   *  kept only as an escape hatch. */
  onFocus?: (e: any) => void;
  /** Taller box for the one long-form narrative field (description). */
  tall?: boolean;
  errorMessage?: string;
  /** Shown next to the error, only when a retry is actually possible (a
   *  cached recording URI to resend). */
  onRetry?: () => void;
  /** Shown when a required field is empty. Mutually exclusive with
   *  errorMessage in practice — a field is either broken or blank, not
   *  both — but both are accepted so the caller doesn't need to branch. */
  missingMessage?: string;
};

/**
 * The one editable-answer pattern used everywhere in the report flow: while
 * transcribing, show a spinner in place of the field; otherwise, a plain
 * always-editable text box (typing over a bad transcription is faster than
 * re-recording), with room for an error+retry state or a "this is required"
 * nudge below it.
 *
 * This used to be two near-identical blocks of JSX — one on the step screen,
 * one on the review screen — that had quietly drifted apart (different
 * min-heights, review missing the retry button). Collapsing them into one
 * component is what makes "uniform across the flow" actually true instead of
 * aspirational: there is now only one place this markup can drift.
 */
export function AnswerEditor({
  editable = true,
  value,
  onChangeText,
  placeholder,
  isTranscribing,
  transcribingLabel = "Ginagawa pa...",
  tall = false,
  errorMessage,
  onRetry,
  missingMessage,
  onFocus,
}: AnswerEditorProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorMessage) || Boolean(missingMessage);

  return (
    <View>
      {isTranscribing ? (
        <View className="flex-row items-center bg-brand-50 border border-brand-outline rounded-2xl px-4 py-5">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text className={`${REPORT_TYPE.helper} ml-3 flex-1`}>{transcribingLabel}</Text>
        </View>
      ) : (
        <TextInput
          editable={editable}
          value={value}
          onChangeText={onChangeText}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={() => setFocused(false)}
          accessibilityLabel={placeholder}
          selectionColor={colors.primary}
          style={{ lineHeight: 27, borderColor: hasError ? colors.error : focused ? colors.primary : colors.outlineVariant }}
          multiline
          textAlignVertical="top"
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          className={`${REPORT_TYPE.body} bg-white border rounded-2xl p-4 ${
            tall ? "min-h-[144px]" : "min-h-[76px]"
          } ${hasError ? "border-alert" : "border-gray-200"}`}
        />
      )}

      {!isTranscribing && errorMessage && (
        <View className="mt-1.5">
          <Text className={`${REPORT_TYPE.caption} text-alert`}>{errorMessage}</Text>
          {onRetry && (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              className="self-start bg-brand-50 border border-brand-outline rounded-xl px-4 py-2.5 mt-3 active:opacity-70"
            >
              <Text className={REPORT_TYPE.linkBrand}>Subukan muli</Text>
            </Pressable>
          )}
        </View>
      )}

      {!isTranscribing && !errorMessage && missingMessage && (
        <Text className={`${REPORT_TYPE.caption} text-alert mt-1.5`}>{missingMessage}</Text>
      )}
    </View>
  );
}
