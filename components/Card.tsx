import { View, type ViewProps } from "react-native";

// Flat, subtle border — no shadow anywhere. A quiet hairline does the
// separation work a shadow would otherwise fake.
export function Card({ className = "", ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`bg-white border border-gray-200 rounded-2xl ${className}`}
      {...props}
    />
  );
}
