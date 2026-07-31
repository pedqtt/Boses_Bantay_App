import { Tabs, router, usePathname } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

type IconName = keyof typeof Ionicons.glyphMap;

// Active tab gets a solid pill behind its icon — a second signal beyond
// color alone, so the current tab is unmistakable at a glance rather than
// depending on noticing a subtle blue-vs-gray shift. Solid fill, not a
// soft tint — icon flips to white so it stays legible against it.
function TabIcon({
  focused,
  outline,
  filled,
  color,
}: {
  focused: boolean;
  outline: IconName;
  filled: IconName;
  color: string;
}) {
  return (
    <View
      className={`w-12 h-8 rounded-full items-center justify-center ${focused ? "bg-brand" : ""}`}
    >
      <Ionicons name={focused ? filled : outline} size={22} color={focused ? "white" : color} />
    </View>
  );
}

// Always visible on every tab — but the active one is a touch bolder and
// larger, so hierarchy still reads even with all six labels present.
function TabLabel({ focused, color, children }: { focused: boolean; color: string; children: string }) {
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
 * Kept flat, per the app's no-shadow design language: the "lift" comes from
 * a solid white ring around the circle (so it reads as sitting above the
 * bar) and a negative top margin, not a drop shadow. The label stays
 * beneath it, same as every other tab — a FAB with no text label would
 * break the app's standing rule that icons are always paired with text.
 */
function ReportFabButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
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
        }}
      >
        <Ionicons name="mic" size={24} color="white" />
      </Pressable>
      <Text
        style={{
          marginTop: 4,
          color: focused ? "#1D4ED8" : "#6B7280",
          fontSize: focused ? 11 : 10.5,
          fontWeight: focused ? "700" : "500",
        }}
      >
        Report
      </Text>
    </View>
  );
}

/**
 * Bot as a floating action button, not a tab bar slot: it sits just above
 * the bar in the bottom-right corner instead of taking one of five equal
 * positions in the row. Bottom-right is the standard chat-launcher location
 * (Fitts's Law + convention — a resident who's used any chat widget already
 * knows to look there), which also keeps it out of the way of the Report
 * FAB centered in the bar itself, so the two floating controls never
 * compete for the same visual space.
 *
 * Rendered outside <Tabs> as an absolute overlay on every resident screen
 * except the report flow (see hideBotFab below) — the report flow already
 * hides the tab bar entirely to remove distraction/misclick risk, and a
 * floating bot button hovering over an active recording would undercut
 * that same goal.
 */
function BotFab({ bottom }: { bottom: number }) {
  return (
    <Pressable
      onPress={() => router.push("/(resident)/bot")}
      accessibilityRole="button"
      accessibilityLabel="Ask the Bot"
      className="absolute items-center justify-center bg-brand active:opacity-85"
      style={{
        right: 16,
        bottom,
        width: 56,
        height: 56,
        borderRadius: 28,
        // Flat, matching the rest of the app's no-shadow language.
        elevation: 0,
        shadowOpacity: 0,
        shadowColor: "transparent",
      }}
    >
      <Ionicons name="chatbubble-ellipses" size={24} color="white" />
    </Pressable>
  );
}

export default function ResidentLayout() {
  // Android's gesture/3-button nav bar sits in this inset — without adding
  // it to the tab bar's own height, the system nav bar overlaps and covers
  // the last few pixels of the bar instead of sitting cleanly below it.
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const hideBotFab = pathname?.includes("/report");
  const tabBarHeight = 64 + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1D4ED8",
        // Darker than the typical "inactive gray" — the original #9CA3AF was
        // failing WCAG AA contrast at this label size, same class of bug
        // fixed earlier on status badges.
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          borderTopColor: "#E5E7EB",
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          backgroundColor: "white",
          // Flat — no native shadow/elevation, the border alone defines the edge.
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: "transparent",
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
      {/*
        Report-filing is reachable from every tab, not just Home — the
        highest-stakes action in the app shouldn't depend on which screen
        a resident happens to be on when they need it (Fitts's Law: the
        most critical action needs the shortest, most reliable path). It's
        rendered as the raised center FAB (see ReportFabButton above)
        instead of a regular tab, so it's not just reachable but visually
        the most prominent thing in the bar.
      */}
      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          tabBarButton: (props) => <ReportFabButton {...props} />,
        }}
      />
      {/*
        Bot dropped out of the tab bar — it's still one tap away via Home's
        "Ask the Bot" quick-access card, so removing it here isn't losing
        the feature, it's removing a duplicate path to it and freeing a
        slot for Report to become the FAB above.
      */}
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
    {!hideBotFab && <BotFab bottom={tabBarHeight + 16} />}
    </View>
  );
}
