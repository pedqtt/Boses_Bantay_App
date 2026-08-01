import { Tabs, router, usePathname } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

type IconName = keyof typeof Ionicons.glyphMap;

// Active tab gets a pill behind its icon — still a second signal beyond
// color alone (shape, not just hue, changes on selection), but a soft
// brand-tinted fill instead of a solid block. A fully solid pill next to
// four quiet outline icons was the loudest thing in the bar; a tint keeps
// the same "unmistakable at a glance" property (constraint: never rely on
// color alone) while reading as calm rather than a bright patch.
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
      className={`w-12 h-8 rounded-full items-center justify-center ${focused ? "bg-brand-50" : ""}`}
    >
      <Ionicons name={focused ? filled : outline} size={22} color={focused ? "#1D4ED8" : color} />
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
          shadowColor: "#1D4ED8",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Ionicons name="mic" size={24} color="white" />
      </Pressable>
      <Text
        style={{
          marginTop: 4,
          // Same `ink-faint` (#4B5563) inactive color as the rest of the
          // bar — see the tabBarInactiveTintColor comment below for why.
          color: focused ? "#1D4ED8" : "#4B5563",
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
    <View className="absolute items-center" style={{ right: 16, bottom }}>
      <Pressable
        onPress={() => router.push("/(resident)/bot")}
        accessibilityRole="button"
        // No visible text label anymore (removed per explicit request), so
        // this accessibilityLabel is the only place the button's purpose is
        // still spelled out — screen readers still announce "Ask the Bot,"
        // even though sighted users now rely on the icon alone.
        accessibilityLabel="Ask the Bot"
        className="items-center justify-center bg-brand active:opacity-85"
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          borderWidth: 4,
          borderColor: "white",
          shadowColor: "#1D4ED8",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.14,
          shadowRadius: 6,
          elevation: 3,
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={30} color="white" />
      </Pressable>
    </View>
  );
}

export default function ResidentLayout() {
  // Android's gesture/3-button nav bar sits in this inset — without adding
  // it to the tab bar's own height, the system nav bar overlaps and covers
  // the last few pixels of the bar instead of sitting cleanly below it.
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  // Hidden during the report flow and on the bot screen itself — both
  // screens hide the tab bar for the same misclick-prevention reason, and
  // a floating "open the bot" button has nothing to float above once the
  // bar it normally sits over is gone, plus it'd be pointless while
  // already inside that exact screen. Exact match, not `.includes()` —
  // "/report" is a substring of "/reports" (the reports LIST screen,
  // which should keep showing the button), so a substring check was
  // silently hiding it there too.
  const hideBotFab = pathname === "/report" || pathname === "/bot";
  const tabBarHeight = 64 + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1D4ED8",
        // This is the app's `ink-faint` token (#4B5563), not an arbitrary
        // gray — reused here rather than a fresh hex value so the tab
        // labels meet the same WCAG AA contrast floor already established
        // for status badges and chapter headers elsewhere in the app. The
        // previous value (#6B7280, Tailwind's gray-500) was closer to
        // borderline-AA than genuinely safe at this label's small size —
        // "legible under stress" (skill constraint 6) means erring toward
        // more contrast, not the minimum that technically passes.
        tabBarInactiveTintColor: "#4B5563",
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          backgroundColor: "white",
          // A soft shadow instead of a hard 1px border — separates the bar
          // from content with the same "this is a raised surface" cue as
          // the two FABs above it, rather than a drawn rule. Subtle on
          // purpose (low opacity, small radius): minimalism here means one
          // quiet depth signal for the whole bar, not a heavy card-style
          // shadow competing with the FABs for attention.
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
        Bot dropped out of the tab bar — it's still reachable via the
        floating BotFab above and Home's "Ask the Bot" quick-access card.
        `href: null` is required here, not just omitting this entry: Expo
        Router auto-generates a plain tab button for any route file inside
        a <Tabs> folder that isn't explicitly registered, using the raw
        filename as an unstyled label with no icon — that was rendering as
        a stray, broken-looking 6th "bot" tab alongside the real, styled
        floating button. `href: null` keeps the route navigable
        (router.push still works) while telling the tab bar not to render
        a button for it at all.
      */}
      <Tabs.Screen name="bot" options={{ href: null }} />
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
    {!hideBotFab && <BotFab bottom={tabBarHeight + 20} />}
    </View>
  );
}
