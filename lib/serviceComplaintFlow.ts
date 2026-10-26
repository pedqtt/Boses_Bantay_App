export const COMPLAINT_STEPS = ["intro", "category", "details", "photos", "review"] as const;
export type ComplaintStep = typeof COMPLAINT_STEPS[number];
export function complaintCanAdvance(step: ComplaintStep, fields: { category: string | null; location: string; description: string }): boolean {
  if (step === "category") return Boolean(fields.category);
  if (step === "details") return Boolean(fields.location.trim() && fields.description.trim());
  if (step === "review") return Boolean(fields.category && fields.location.trim() && fields.description.trim());
  return true;
}
export function complaintNext(step: ComplaintStep): ComplaintStep {
  return COMPLAINT_STEPS[Math.min(COMPLAINT_STEPS.indexOf(step) + 1, COMPLAINT_STEPS.length - 1)];
}
export function complaintPrevious(step: ComplaintStep): ComplaintStep {
  return COMPLAINT_STEPS[Math.max(0, COMPLAINT_STEPS.indexOf(step) - 1)];
}
