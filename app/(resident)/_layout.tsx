import { useRef, useState } from "react";
import { Tabs, router, usePathname } from "expo-router";
import {
  View,
  Text,
  Pressable,
  Dimensions,
  Animated,
  PanResponder,
  type ColorValue,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  focused,
  outline,
  filled,
  color,
}: {
  focused: boolean;
  outline: IconName;
  filled: IconName;
  color: ColorValue;
}) {
  return (
    <View
      className={`w-12 h-8 rounded-full items-center justify-center ${focused ? "bg-brand-50" : ""}`}
    >
      <Ionicons name={focused ? filled : outline} size={22} color={focused ? colors.primary : (color as string)} />
    </View>
  );
}

// Always visible on every tab — but the active one is a touch bolder and
// larger, so hierarchy still reads even with all six labels present.
function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  return (
    <Text
      style={{
        color,
        fontSize: focused ? 11 : 10.5,
        fontWeight: focused ? "700" : "500",
        marginTop: 3,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Report-filing rendered as a raised center FAB instead of a regular tab.
 *
 * Two things changed to make room for this: Bot dropped out of the tab bar
 * entirely (it's still one tap away from Home's "Ask the Bot" quick-access
 * card — the app used to duplicate that access in both places, which is
 * exactly the kind of redundant navigation the earlier design pass flagged
 * as a problem, not a feature), and Report — the single highest-stakes,
 * most time-critical action in the app — gets promoted from "one of six
 * equal tabs" to a visually dominant control (Fitts's Law: the most
 * critical action deserves the largest, easiest-to-hit target, not just an
 * equal slot in a row of six).
 *
 * The "lift" is signaled two ways now: a solid white ring around the circle
 * (so it reads as cleanly cut out from the bar behind it) plus a subtle
 * drop shadow — unlike flat surfaces elsewhere in the app (cards, buttons),
 * a shadow here is a genuine depth cue, not decoration: this control is
 * literally floating above the bar, so it should look like it. Kept soft
 * (low opacity, small radius) rather than a heavy Material-style shadow —
 * minimalist means restrained, not absent. The label stays beneath it, same
 * as every other tab — a FAB with no text label would break the app's
 * standing rule that icons are always paired with text.
 */
function ReportFabButton({
  onPress,
  accessibilityState,
}: {
  onPress?: (e?: any) => void;
  accessibilityState?: { selected?: boolean };
}) {
  const focused = Boolean(accessibilityState?.selected);
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Report"
        accessibilityState={accessibilityState}
        className="items-center justify-center bg-brand active:opacity-85"
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          marginTop: -26,
          borderWidth: 4,
          borderColor: "white",
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.14,
          shadowRadius: 5,
          elevation: 3,
        }}
      >
        <Ionicons name="mic" size={24} color="white" />
      </Pressable>
      <Text
        style={{
          marginTop: 4,
          color: focused ? colors.primary : colors.onSurfaceFaint,
          fontSize: focused ? 11 : 10.5,
          fontWeight: focused ? "700" : "500",
        }}
      >
        Report
      </Text>
    </View>
  );
}

const FAB_SIZE = 72;
const FAB_EDGE_MARGIN = 16;
const DRAG_THRESHOLD = 6;

type FabPosition = { x: number; y: number };

function BotFab({
  bottom,
  insetTop,
  position,
  onPositionChange,
}: {
  bottom: number;
  insetTop: number;
  position: FabPosition | null;
  onPositionChange: (pos: FabPosition) => void;
}) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const minX = FAB_EDGE_MARGIN;
  const maxX = screenWidth - FAB_EDGE_MARGIN - FAB_SIZE;
  const minY = insetTop + FAB_EDGE_MARGIN;
  const maxY = screenHeight - bottom - FAB_SIZE;

  const restingPosition: FabPosition = { x: maxX, y: maxY };
  const startPosition = position ?? restingPosition;

  const pan = useRef(new Animated.ValueXY(startPosition)).current;
  const currentValue = useRef<FabPosition>(startPosition);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) =>
        Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        pan.setOffset(currentValue.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        pan.flattenOffset();
        const rawX = currentValue.current.x + gesture.dx;
        const rawY = currentValue.current.y + gesture.dy;
        const clampedY = Math.min(Math.max(rawY, minY), maxY);
        const midX = (minX + maxX) / 2;
        const snappedX = rawX < midX ? minX : maxX;
        const clamped: FabPosition = { x: snappedX, y: clampedY };
        currentValue.current = clamped;
        onPositionChange(clamped);
        Animated.spring(pan, {
          toValue: clamped,
          useNativeDriver: false,
          friction: 8,
          tension: 45,
          velocity: { x: gesture.vx, y: gesture.vy },
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      className="absolute"
      style={{ transform: [{ translateX: pan.x }, { translateY: pan.y }] }}
    >
      <Pressable
        onPress={() => router.push("/(resident)/bot")}
        accessibilityRole="button"
        accessibilityLabel="Ask the Bot"
        className="items-center justify-center bg-brand active:opacity-85"
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_SIZE / 2,
          borderWidth: 4,
          borderColor: "white",
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={30} color="white" />
      </Pressable>
    </Animated.View>
  );
}

export default function ResidentLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const hideBotFab =
    pathname === "/report" ||
    pathname === "/bot" ||
    pathname === "/verify-id" ||
    pathname === "/service-complaint" ||
    pathname === "/notification" ||
    pathname === "/help" ||
    pathname?.endsWith("/help");

  const tabBarHeight = 64 + insets.bottom;
  const [botFabPosition, setBotFabPosition] = useState<{ x: number; y: number } | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.onSurfaceFaint,
          tabBarStyle: {
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 8,
            backgroundColor: "white",
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 8,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ focused, color }) => (
              <TabIcon focused={focused} outline="home-outline" filled="home" color={color} />
            ),
            tabBarLabel: ({ focused, color }) => (
              <TabLabel focused={focused} color={color}>
                Home
              </TabLabel>
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            tabBarIcon: ({ focused, color }) => (
              <TabIcon focused={focused} outline="document-text-outline" filled="document-text" color={color} />
            ),
            tabBarLabel: ({ focused, color }) => (
              <TabLabel focused={focused} color={color}>
                Reports
              </TabLabel>
            ),
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: "Report",
            tabBarButton: (props) => <ReportFabButton {...props} />,
          }}
        />

        {/* Hidden Screens (not shown in bottom navigation tab bar) */}
        <Tabs.Screen name="bot" options={{ href: null }} />
        <Tabs.Screen name="notification" options={{ href: null }} />
        <Tabs.Screen name="help" options={{ href: null }} />

        <Tabs.Screen
          name="directory"
          options={{
            title: "Directory",
            tabBarIcon: ({ focused, color }) => (
              <TabIcon focused={focused} outline="call-outline" filled="call" color={color} />
            ),
            tabBarLabel: ({ focused, color }) => (
              <TabLabel focused={focused} color={color}>
                Directory
              </TabLabel>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused, color }) => (
              <TabIcon focused={focused} outline="person-outline" filled="person" color={color} />
            ),
            tabBarLabel: ({ focused, color }) => (
              <TabLabel focused={focused} color={color}>
                Profile
              </TabLabel>
            ),
          }}
        />
      </Tabs>
      {!hideBotFab && (
        <BotFab
          bottom={tabBarHeight + 20}
          insetTop={insets.top}
          position={botFabPosition}
          onPositionChange={setBotFabPosition}
        />
      )}
    </View>
  );
}