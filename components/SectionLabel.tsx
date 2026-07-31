import { Text } from "react-native";

// Shared section-header treatment: 12px semibold, uppercase, tracked out.
// Reused wherever a screen groups content under a label (Recent reports,
// Account, Emergency, Barangay Services) so the vocabulary stays consistent
// instead of being redefined per screen.
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-[12px] font-semibold text-ink-faint uppercase tracking-wider mb-3">
      {children}
    </Text>
  );
}
