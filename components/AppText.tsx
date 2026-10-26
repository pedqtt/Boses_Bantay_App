import { createContext, forwardRef, useContext } from "react";
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextProps, type TextInputProps } from "react-native";
import { cssInterop } from "nativewind";
import { roleForSize, textMetrics, type TextRole } from "@/lib/typography";
import { useTypography } from "@/lib/typography-context";

const InText = createContext(false);
type AppTextProps = TextProps & { variant?: TextRole; className?: string; preserveTruncation?: boolean };
const TextBase = forwardRef<NativeText, AppTextProps>(function AppText({ style, children, variant, numberOfLines, preserveTruncation = false, allowFontScaling = true, ...props }, ref) {
  const nested = useContext(InText);
  const { scale } = useTypography();
  const flattened = StyleSheet.flatten(style) || {};
  const explicitSize = typeof flattened.fontSize === "number";
  // Color-only inline Text inherits from its parent; it must not rescale twice.
  const metrics = variant || explicitSize || !nested ? textMetrics(variant || roleForSize(explicitSize ? flattened.fontSize! : 16), scale) : undefined;
  const lines = !preserveTruncation && variant !== "navigation" && scale > 1 && numberOfLines === 1 ? undefined : numberOfLines;
  return <NativeText {...props} ref={ref} allowFontScaling={allowFontScaling} numberOfLines={lines} style={[style, metrics]}><InText.Provider value={true}>{children}</InText.Provider></NativeText>;
});
export const Text = cssInterop(TextBase, { className: "style" });
export type Text = NativeText;

type AppInputProps = TextInputProps & { className?: string };
const InputBase = forwardRef<NativeTextInput, AppInputProps>(function AppTextInput({ style, allowFontScaling = true, ...props }, ref) {
  const { scale } = useTypography();
  const flattened = StyleSheet.flatten(style) || {};
  const size = typeof flattened.fontSize === "number" ? flattened.fontSize : 16;
  const metrics = textMetrics(size >= 22 ? roleForSize(size) : "body", scale);
  const number = (value: unknown) => typeof value === "number" ? value : 0;
  const verticalPadding = number(flattened.paddingTop ?? flattened.paddingVertical ?? flattened.padding) + number(flattened.paddingBottom ?? flattened.paddingVertical ?? flattened.padding);
  const minHeight = Math.max(number(flattened.minHeight), metrics.lineHeight + verticalPadding);
  return <NativeTextInput {...props} ref={ref} allowFontScaling={allowFontScaling} style={[style, metrics, { minHeight }]} />;
});
export const TextInput = cssInterop(InputBase, { className: "style" });
export type TextInput = NativeTextInput;
