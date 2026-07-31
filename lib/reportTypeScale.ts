/**
 * Type scale for the guided report flow (app/(resident)/report.tsx and
 * components/report/*). Deliberately its own scale — larger than the rest of
 * the app's 11-17px range — because it's read under different conditions
 * than a dashboard list: an older resident, possibly reading their own
 * transcribed speech back to check it's correct, possibly without reading
 * glasses handy. "Readable at a glance" isn't enough here — it needs to be
 * readable at arm's length by someone who doesn't read fast.
 *
 * Three real tiers, not just "big/medium/small":
 *  - PRIMARY   (ink, near-black)   — the thing the eye must land on first.
 *  - SECONDARY (ink-soft, #374151) — genuinely useful supporting text: the
 *                                    English translation, hints, helper
 *                                    copy. Deliberately NOT ink-faint —
 *                                    content someone needs to read shouldn't
 *                                    be the same washed-out tone as metadata.
 *  - TERTIARY  (ink-faint,#4B5563) — true metadata only: "(opsyonal)", small
 *                                    captions, field labels. Still well
 *                                    above WCAG AA against white (~7:1),
 *                                    just visually quieter than content that
 *                                    matters.
 *
 * Every Text element in the report flow should map to one of these named
 * roles rather than picking a one-off size — that mapping IS the hierarchy;
 * a scale nobody actually uses consistently isn't one.
 */
export const REPORT_TYPE = {
  heroTitle: "text-[26px] font-bold leading-9 text-ink tracking-tight",
  question: "text-[24px] font-semibold leading-8 text-ink",
  subtitle: "text-[15px] leading-6 text-ink-soft",
  hint: "text-[14px] leading-5 text-ink-soft",
  body: "text-[17px] leading-6 text-ink",
  eyebrowBrand: "text-[13px] font-semibold uppercase tracking-wide text-brand",
  eyebrowMuted: "text-[13px] font-semibold uppercase tracking-wide text-ink-faint",
  fieldLabel: "text-[12px] font-semibold uppercase tracking-wide text-ink-faint",
  caption: "text-[13px] leading-5 text-ink-faint",
  helper: "text-[13px] leading-5 text-ink-soft",
  /** Label sitting directly under an icon-only control (record, play/pause).
   *  Bold enough to read as "this belongs to the button above it," not as
   *  ambient caption text. */
  controlLabel: "text-[13px] font-semibold text-ink-soft text-center",
  buttonPrimary: "text-white font-semibold text-[17px]",
  buttonSecondary: "text-[15px] font-medium text-ink-soft",
  linkBrand: "text-[15px] font-semibold text-brand",
} as const;
