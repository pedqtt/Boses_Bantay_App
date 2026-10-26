import { View, type ViewProps } from "react-native";
import { reportStyles } from "./reportStyles";

export function ReportCard({ className = "", style, ...props }: ViewProps & { className?: string }) {
  return <View className={className} style={[reportStyles.card, style]} {...props} />;
}
