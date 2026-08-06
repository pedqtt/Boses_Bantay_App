// theme.ts — single source of truth for spacing, type, color-role, radius,
// and elevation tokens, per the android-expo-ui skill (Material Design 3
// principles: 8dp grid, MD3 type scale, WCAG AA contrast, MD3 elevation).
//
// COLORS ARE THIS APP'S OWN, NOT MD3's REFERENCE PALETTE: the skill's
// sample theme.ts uses a generic MD3 purple. Boses Bantay already has a
// brand identity (tailwind.config.js: brand blue #1D4ED8, alert red
// #DC2626, ink grayscale) established well before this skill existed, so
// every value below is one of those existing colors, just organized under
// MD3's semantic ROLE names (primary/onPrimary, surface/onSurface, etc.)
// so components can be written against roles instead of raw hex. Nothing
// here changes what the app looks like today.
//
// One real fix, made everywhere it appeared: #9CA3AF was used app-wide as
// placeholderTextColor and as the unchecked-checkbox icon color. Measured
// against this app's white/near-white field backgrounds it comes out to
// ~2.5:1 - well under WCAG's 4.5:1 minimum for text and 3:1 minimum for
// UI components, meaning every placeholder and every unchecked checkbox
// in the app was failing AA. Replaced with #6B7280 (already in use
// elsewhere as the icon gray) everywhere #9CA3AF appeared as a color
// value - that measures ~4.83:1, clearing both minimums, without
// introducing a new color family. `outline` below uses that same
// corrected value.

export const spacing = {
  xxs: 4, // icon-to-text gaps, chip internals
  xs: 8, // between related items (label -> value)
  sm: 12, // compact list internals (4pt-grid exception, use sparingly)
  md: 16, // DEFAULT: screen edge margins, card padding
  lg: 24, // between distinct sections
  xl: 32, // major section breaks
  xxl: 48, // hero areas, empty states
} as const;

// MD3 type scale. NOTE: the existing auth screens (login/register/otp/
// forgot-password/reset-password) use their own hand-tuned sizes
// (text-[19px], text-[28px], etc.) that were deliberately bumped up this
// session for older-user legibility - those are a considered decision,
// not a violation to silently overwrite. This scale is here for screens
// built or reworked going forward (resident home/reports/directory,
// GIS/voice-filing/RAG screens still to come), not a mandate to rewrite
// the auth flow's already-tuned type sizes.
export const typography = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: "400" },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: "400" },
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: "400" },
  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: "400" },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: "400" },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: "400" },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: "500" },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: "400", letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: "500", letterSpacing: 0.5 },
} as const;

// Semantic color roles, values pulled from tailwind.config.js's existing
// brand/alert/ink palette - see the file header for why, and for the one
// corrected value (outline).
export const colors = {
  primary: "#1D4ED8", // brand.DEFAULT
  onPrimary: "#FFFFFF",
  primaryContainer: "#EBF1FE", // brand.50 / brand.light
  onPrimaryContainer: "#1638A8", // brand.dark

  surface: "#FCFCFD", // ScreenBackground's base color - app background
  onSurface: "#0B0F19", // ink.DEFAULT - primary text
  onSurfaceVariant: "#374151", // ink.soft - secondary text (never lighter than this)
  onSurfaceFaint: "#4B5563", // ink.faint - tertiary text/icons (tab bar inactive state, etc.)

  surfaceContainerLow: "#FFFFFF", // card background
  surfaceContainerHigh: "#F3F4F6", // elevated card / dialog / AuthActionGroup rule area

  outline: "#6B7280", // borders that carry meaning - corrected from #9CA3AF, see file header
  outlineVariant: "#E5E7EB", // decorative dividers, input underlines - already used everywhere
  // Distinct from `outline` on purpose: `outline` is "muted but active"
  // (placeholders, icons on live/interactive elements). This is "inert" -
  // empty-state icons, disabled chevrons, content with nothing behind it
  // yet. The two were being used interchangeably before this was named;
  // now the rule is: is there real content/interaction here, or not.
  outlineFaint: "#D1D5DB",

  error: "#DC2626", // alert.DEFAULT
  onError: "#FFFFFF",
  errorContainer: "#FEE2E2", // alert.100
  onErrorContainer: "#B91C1C", // alert.dark
} as const;

// The error/focus/default field-border ternary was independently
// hand-written in ~5 places (login, register's Field, reset-password x2,
// PhoneInput) with the same three values and the same precedence. One
// function, one place to change it.
export function fieldBorderColor({ error, focused }: { error?: boolean; focused?: boolean }): string {
  if (error) return colors.error;
  if (focused) return colors.primary;
  return colors.outlineVariant;
}

// Dark mode isn't wired up anywhere in this app yet (no useColorScheme /
// theme-switching exists) - intentionally not inventing a dark palette
// here until that's actually being built, rather than guessing values
// that would go untested.

export const radius = { sm: 8, md: 12, lg: 16, xl: 28, full: 999 } as const;

// MD3 elevation -> RN shadow + Android elevation prop. level2 matches the
// shadow already tuned on ReportFabButton this session (shadowOpacity
// 0.14 / shadowRadius 5 / elevation 3) - kept as-is rather than changed
// to the reference 0.12/4/3, since that was a deliberate "more subtle"
// adjustment made from direct feedback.
export const elevation = {
  level1: { elevation: 1, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  level2: { elevation: 3, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  level3: { elevation: 6, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
} as const;
