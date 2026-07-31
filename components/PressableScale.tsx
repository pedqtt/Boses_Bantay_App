import { useRef, type ReactNode } from "react";
import { Animated, Pressable } from "react-native";

// Tactile press: scales down slightly instead of just fading opacity, so
// primary controls feel handled rather than templated. Shared so any
// future primary action (not just the report CTA) gets the same feel.
export function PressableScale({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
