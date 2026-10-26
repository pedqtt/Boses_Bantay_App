export const FONT_SIZE_OPTIONS = [
  { id: "small", label: "Maliit", scale: 0.9 },
  { id: "standard", label: "Karaniwan", scale: 1 },
  { id: "large", label: "Malaki", scale: 1.2 },
  { id: "extraLarge", label: "Pinakamalaki", scale: 1.4 },
] as const;
export type FontSizePreference = typeof FONT_SIZE_OPTIONS[number]["id"];
export const TEXT_ROLES = {
  display: { fontSize: 32, lineHeight: 40 },
  screenTitle: { fontSize: 28, lineHeight: 36 },
  heading: { fontSize: 24, lineHeight: 32 },
  title: { fontSize: 20, lineHeight: 28 },
  section: { fontSize: 18, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 24 },
  secondary: { fontSize: 14, lineHeight: 22 },
  label: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 18 },
  navigation: { fontSize: 12, lineHeight: 18 },
  hero: { fontSize: 40, lineHeight: 48 },
} as const;
export type TextRole = keyof typeof TEXT_ROLES;
export function isFontSizePreference(value: unknown): value is FontSizePreference {
  return FONT_SIZE_OPTIONS.some(option => option.id === value);
}
export function fontScaleFor(value: FontSizePreference) { return FONT_SIZE_OPTIONS.find(option => option.id === value)!.scale; }
export function roleForSize(size: number): TextRole {
  if (size <= 12) return "caption";
  if (size <= 14) return "secondary";
  if (size <= 17) return "body";
  if (size <= 18) return "section";
  if (size <= 21) return "title";
  if (size <= 25) return "heading";
  if (size <= 30) return "screenTitle";
  if (size <= 40) return "display";
  return "hero";
}
export function textMetrics(role: TextRole, scale: number) {
  const token = TEXT_ROLES[role];
  return { fontSize: Math.round(token.fontSize * scale * 2) / 2, lineHeight: Math.ceil(token.lineHeight * scale) };
}
export function fontPreferenceKey(owner: string) { return `boses_text_size.${owner.replace(/[^a-zA-Z0-9_.-]/g, "_")}`; }
