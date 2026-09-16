import { View, Text } from "react-native";

const STATUS_META: Record<string, { bg: string; text: string; dot: string }> = {
  "Under Review": { bg: "bg-amber-700", text: "text-white", dot: "bg-white" },
  "Sinuri": { bg: "bg-amber-700", text: "text-white", dot: "bg-white" },
  "Investigating": { bg: "bg-blue-600", text: "text-white", dot: "bg-white" },
  "Nag-iimbestiga": { bg: "bg-blue-600", text: "text-white", dot: "bg-white" },
  "Resolved": { bg: "bg-green-700", text: "text-white", dot: "bg-white" },
  "Nareselba": { bg: "bg-green-700", text: "text-white", dot: "bg-white" },
};

const DEFAULT_META = { bg: "bg-gray-600", text: "text-white", dot: "bg-white" };

export function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? DEFAULT_META;

  return (
    <View className={`flex-row items-center px-2.5 py-1 rounded-full ${meta.bg}`}>
      <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${meta.dot}`} />
      <Text className={`text-[11px] font-medium ${meta.text}`}>{status}</Text>
    </View>
  );
}