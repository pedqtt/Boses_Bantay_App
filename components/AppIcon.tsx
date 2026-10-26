import { forwardRef, type ComponentProps, type ComponentRef } from "react";
import { StyleSheet } from "react-native";
import { Ionicons as ExpoIonicons } from "@expo/vector-icons";

const UprightIcon = forwardRef<ComponentRef<typeof ExpoIonicons>, ComponentProps<typeof ExpoIonicons>>(
  function UprightIcon({ style, ...props }, ref) {
    return <ExpoIonicons {...props} ref={ref} style={[style, styles.normal]} />;
  }
);
// Keep icon-name typing available to existing components.
export const Ionicons = Object.assign(UprightIcon, { glyphMap: ExpoIonicons.glyphMap });
const styles = StyleSheet.create({ normal: { fontStyle: "normal", fontWeight: "normal" } });
