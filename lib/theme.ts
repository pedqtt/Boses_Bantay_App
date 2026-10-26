import { TEXT_ROLES } from "@/lib/typography";

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

// Compatibility aliases backed by the shared application text hierarchy.
// AppText and AppTextInput apply the account preference and retain OS scaling.
export const typography = {
  displayLarge: { ...TEXT_ROLES.hero, fontWeight: "400" },
  displayMedium: { ...TEXT_ROLES.hero, fontWeight: "400" },
  displaySmall: { ...TEXT_ROLES.display, fontWeight: "400" },
  headlineLarge: { ...TEXT_ROLES.display, fontWeight: "600" },
  headlineMedium: { ...TEXT_ROLES.screenTitle, fontWeight: "600" },
  headlineSmall: { ...TEXT_ROLES.heading, fontWeight: "600" },
  titleLarge: { ...TEXT_ROLES.title, fontWeight: "600" },
  titleMedium: { ...TEXT_ROLES.section, fontWeight: "600" },
  titleSmall: { ...TEXT_ROLES.body, fontWeight: "600" },
  bodyLarge: { ...TEXT_ROLES.body, fontWeight: "400" },
  bodyMedium: { ...TEXT_ROLES.secondary, fontWeight: "400" },
  bodySmall: { ...TEXT_ROLES.caption, fontWeight: "400" },
  labelLarge: { ...TEXT_ROLES.label, fontWeight: "600" },
  labelMedium: { ...TEXT_ROLES.caption, fontWeight: "500" },
  labelSmall: { ...TEXT_ROLES.caption, fontWeight: "500" },
} as const;

// Semantic color roles, values pulled from tailwind.config.js's existing
// brand/alert/ink palette - see the file header for why, and for the one
// corrected value (outline).
//
// UPDATED: brand/surface rolled over to the resident-provided reference
// palette (Imperial Blue / White Convolvulus) - see tailwind.config.js's
// brand block for the full shade ramp derived from #021F94. Started scoped
// to bot.tsx only, then applied app-wide at the resident's request.
export const colors = {
  primary: "#021C84", // brand.DEFAULT - Imperial Blue
  onPrimary: "#FFFFFF",
  primaryContainer: "#DCE5F7", // brand.50 / brand.light
  onPrimaryContainer: "#011760", // brand.dark
  // A lighter step of primary for filled buttons/surfaces that don't need
  // (or don't want) the full DEFAULT navy's weight - directory.tsx's call
  // action was the first place `primary` at full strength read as too
  // heavy for a button meant to be tapped often, not a one-off emphasis
  // color. White text still clears WCAG AA on this (~4.85:1).
  primaryMuted: "#5065AE", // brand.400
  residentBackground: "#F9FAFD", // Near-white blue-gray background for resident modules.
  residentTint: "#DCE5F7", // Deeper accent fill for resident options and supporting controls.
  residentSelected: "#CCDAF4", // Selected controls need more emphasis than supporting fills.
  residentAccentOutline: "#9BB1DA",
  surface: "#F5F2F3", // White Convolvulus - ScreenBackground's base color, app background
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

  error: "#80111E", // alert.DEFAULT - deepened to match brand's lightness/weight, see tailwind.config.js
  onError: "#FFFFFF",
  errorOutline: "#DEB5BC",
  errorContainer: "#F5E0E4", // alert.100
  onErrorContainer: "#5C0C15", // alert.dark
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

// Header colors are shared independently of each action's established dimensions.
export const headerActionColors = {
  primary: { backgroundColor: colors.residentTint, borderColor: colors.residentAccentOutline },
  secondary: { backgroundColor: "#F1F3F8", borderColor: "#C5D2E8" },
  primaryPressed: "#CCDAF4",
  secondaryPressed: "#E4EAF5",
} as const;
