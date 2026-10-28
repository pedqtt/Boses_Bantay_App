import { NavbarScrollProvider, useNavbarScrollController } from "@/lib/navbar-scroll";
import { useTypography } from "@/lib/typography-context";
import { Text } from "@/components/AppText";
import { ComplaintCameraRecovery } from "@/components/report/ComplaintCameraRecovery";
import { useEffect, useRef, useState } from "react";
import { Tabs, router, usePathname } from "expo-router";
import { View, Pressable, Animated, PanResponder, Easing, useWindowDimensions, type ColorValue } from "react-native";
import { Ionicons } from "@/components/AppIcon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { colors } from "@/lib/theme";
import { getBotButtonSize, useAppPreferences } from "@/lib/app-preferences";

type IconName = keyof typeof Ionicons.glyphMap;

function SubtleTabButton(props: Pick<BottomTabBarButtonProps, "onPress" | "onLongPress" | "onPressIn" | "onPressOut" | "disabled" | "testID" | "aria-label" | "accessibilityLabel" | "aria-selected" | "style" | "children">) {
  return <Pressable
    onPress={props.onPress}
    onLongPress={props.onLongPress}
    onPressIn={props.onPressIn}
    onPressOut={props.onPressOut}
    disabled={props.disabled}
    testID={props.testID}
    accessibilityRole="tab"
    accessibilityLabel={props["aria-label"] || props.accessibilityLabel}
    accessibilityState={{ selected: props["aria-selected"] === true, disabled: props.disabled ?? false }}
    android_ripple={{ color: "transparent", borderless: false }}
    style={props.style}
  >{props.children}</Pressable>;
}


// Keep the selection surface around the icon, so it doesn't crowd the label.
// Each tab fades its own tint as focus changes; no layout or icon movement.
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
  const highlight = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(highlight, { toValue: focused ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [focused, highlight]);
  return (
    <View style={{ width: 48, height: 34, alignItems: "center", justifyContent: "center" }}>
      <Animated.View pointerEvents="none" style={{ position: "absolute", width: 48, height: 34, borderRadius: 13, backgroundColor: "#E8EFFB", borderWidth: 1, borderColor: "#B9CDEE", opacity: highlight, transform: [{ scale: highlight.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }} />
      <Ionicons name={focused ? filled : outline} size={22} color={focused ? colors.primary : typeof color === "string" ? color : colors.primary} style={{ fontStyle: "normal", fontWeight: "normal" }} />
    </View>
  );
}

// Always visible on every tab — but the active one is a touch bolder and
// larger, so hierarchy still reads even with all six labels present.
function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  return (
    <Text variant="navigation" preserveTruncation numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
      style={{
        color,
        fontSize: 11,
        fontWeight: focused ? "600" : "500",
        marginTop: 3,
        lineHeight: 15,
        textAlign: "center",
        fontStyle: "normal",
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
 *
 * This IS a deliberate exception to Card.tsx's "flat, no shadow anywhere"
 * rule, not an oversight to flatten later — it's reserved for floating
 * chrome that sits outside the normal content flow (this FAB, BotFab, the
 * tab bar itself below). In-content Cards should never gain a shadow; a
 * hairline border still does that job. Floating controls are the one place
 * a shadow is doing real work (signaling "above," not "separate from").
 */
function ReportFabButton({
  onPress,
  accessibilityState,
}: Pick<BottomTabBarButtonProps, "onPress" | "accessibilityState">) {
  const focused = Boolean(accessibilityState?.selected);
  const pressScale = useRef(new Animated.Value(1)).current;
  function animatePress(pressed: boolean) {
    Animated.timing(pressScale, { toValue: pressed ? 0.97 : 1, duration: pressed ? 90 : 150, useNativeDriver: true }).start();
  }
  return (
    <Animated.View style={{ flex: 1, alignItems: "center", transform: [{ scale: pressScale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animatePress(true)}
        onPressOut={() => animatePress(false)}
        accessibilityRole="button"
        accessibilityLabel="Report"
        accessibilityState={accessibilityState}
        className="items-center justify-center bg-brand"
        style={{
          width: 56,
          height: 56,
          borderRadius: 20,
          marginTop: -20,
          borderWidth: 3,
          borderColor: focused ? "#DCE8FF" : "white",
          // Toned down from the original (0.28 opacity, radius 8,
          // elevation 6) — enough was still a genuine depth cue that
          // this control is raised above the bar, but the brand-blue glow
          // was reading closer to a highlight than a shadow at that
          // strength. Matches the same restrained-shadow treatment
          // BotFab already uses, just slightly stronger since this one's
          // the higher-stakes control (Fitts's Law still applies to
          // depth cues, not just size).
          shadowColor: "#172033",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Ionicons name="mic-outline" size={23} color="white" style={{ fontStyle: "normal", fontWeight: "normal" }} />
      </Pressable>
      <Text variant="navigation" preserveTruncation numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
        style={{
          marginTop: 5,
          // Same `ink-faint` (#4B5563) inactive color as the rest of the
          // bar — see the tabBarInactiveTintColor comment below for why.
          color: focused ? colors.primary : colors.onSurfaceFaint,
          fontSize: 11,
          lineHeight: 15,
          fontWeight: focused ? "600" : "500",
        }}
      >
        Report
      </Text>
    </Animated.View>
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
const FAB_EDGE_MARGIN = 16;
// Below this many px of total movement, a touch is treated as a tap that
// just happened to wobble slightly, not a drag — without a threshold,
// PanResponder's onMoveShouldSet fires on the tiniest finger tremor and
// steals every single tap before it ever reaches the Pressable underneath.
const DRAG_THRESHOLD = 6;

type FabPosition = { x: number; y: number };

/**
 * Bot as a floating action button the resident can drag anywhere on
 * screen, not a fixed bottom-right dot. Two things make this possible
 * without pulling in react-native-gesture-handler (which would force an
 * EAS rebuild before anyone could test it): PanResponder + Animated, both
 * already part of react-native core.
 *
 * Position is lifted up to ResidentLayout (see `botFabPosition` state)
 * rather than kept local to this component, because BotFab is
 * conditionally rendered (`{!hideBotFab && <BotFab .../>}`) — every time
 * the resident opens the report flow or the bot screen itself, this
 * component unmounts, and local state would reset it back to the corner
 * on every remount. Lifting the state means "where I left it" survives
 * switching tabs, the way a real draggable UI element should.
 *
 * Drag vs. tap is resolved with onMoveShouldSetPanResponder: the
 * responder is only "stolen" from the inner Pressable once real movement
 * crosses DRAG_THRESHOLD, so a normal tap (including a screen-reader
 * double-tap) still reaches the Pressable's onPress uninterrupted — this
 * isn't a second, separate tap handler bolted onto the pan gesture.
 */
function BotFab({
  bottom,
  insetTop,
  position,
  onPositionChange,
  showWelcome,
  onDismissWelcome,
}: {
  bottom: number;
  insetTop: number;
  position: FabPosition | null;
  onPositionChange: (pos: FabPosition) => void;
  showWelcome: boolean;
  onDismissWelcome: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { preferences } = useAppPreferences();
  const fabSize = getBotButtonSize(preferences.botButtonSize);
  const fadeEnabled = useRef(preferences.fadeBotWhenIdle);
  fadeEnabled.current = preferences.fadeBotWhenIdle;

  const minX = FAB_EDGE_MARGIN;
  const maxX = screenWidth - FAB_EDGE_MARGIN - fabSize;
  const minY = insetTop + FAB_EDGE_MARGIN;
  // Floor of the drag range matches the button's normal resting spot — it
  // can be dragged up and sideways freely, but not lower than where it
  // already sits, so it can never end up overlapping the tab bar.
  const maxY = screenHeight - bottom - fabSize;

  const restingPosition: FabPosition = { x: maxX, y: maxY };
  const startPosition = position ? {
    x: position.x < screenWidth / 2 ? minX : maxX,
    y: Math.min(Math.max(position.y, minY), maxY),
  } : restingPosition;

  const pan = useRef(new Animated.ValueXY(startPosition)).current;
  const currentValue = useRef<FabPosition>(startPosition);
  const activeTint = useRef(new Animated.Value(1)).current;
  const pressed = useRef(false);
  const focused = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const welcomeVisible = useRef(showWelcome);
  welcomeVisible.current = showWelcome;
  const [welcomeMounted, setWelcomeMounted] = useState(showWelcome);
  const welcomeProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showWelcome) setWelcomeMounted(true);
    const animation = Animated.timing(welcomeProgress, {
      toValue: showWelcome ? 1 : 0,
      duration: showWelcome ? 240 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !showWelcome) setWelcomeMounted(false);
    });
    return () => animation.stop();
  }, [showWelcome, welcomeProgress]);

  function wakeFab() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    activeTint.stopAnimation();
    Animated.timing(activeTint, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }
  function scheduleFade() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!fadeEnabled.current) { activeTint.stopAnimation(); activeTint.setValue(1); return; }
    idleTimer.current = null;
    if (welcomeVisible.current || dragging.current || pressed.current || focused.current) return;
    idleTimer.current = setTimeout(() => {
      idleTimer.current = null;
      if (!fadeEnabled.current || welcomeVisible.current || dragging.current || pressed.current || focused.current) return;
      activeTint.stopAnimation();
      Animated.timing(activeTint, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    }, 3500);
  }
  useEffect(() => {
    wakeFab(); scheduleFade();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); activeTint.stopAnimation(); };
  }, [preferences.fadeBotWhenIdle, showWelcome]);


  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        onDismissWelcome();
        dragging.current = true; wakeFab();
        pan.setOffset(currentValue.current);
        pan.setValue({ x: 0, y: 0 });
      },
      // useNativeDriver: true crashes here ("onPanResponderMove is not a
      // function") — PanResponder's continuous move callback doesn't
      // support the native driver on this RN/Fabric setup; Animated.event
      // returns something PanResponder can't call once native driving is
      // requested for a per-frame gesture callback like this. Kept on the
      // JS thread instead — the actual smoothness win here is the
      // edge-snap logic and velocity-fed spring below, not the driver.
      onPanResponderTerminate: () => { dragging.current = false; pan.flattenOffset(); scheduleFade(); },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_evt, gesture) => {
        dragging.current = false; scheduleFade();
        pan.flattenOffset();
        const rawX = currentValue.current.x + gesture.dx;
        const rawY = currentValue.current.y + gesture.dy;
        const clampedY = Math.min(Math.max(rawY, minY), maxY);
        // Always resolves to one of the two side edges, never wherever the
        // finger happened to lift — a release near the center of the
        // screen (or anywhere else off the edges) snaps to whichever edge
        // it's closer to, the same as a release that was already close to
        // an edge. Only the vertical position stays free-form; horizontal
        // position is never allowed to rest anywhere but minX or maxX.
        const midX = (minX + maxX) / 2;
        const snappedX = rawX < midX ? minX : maxX;
        const clamped: FabPosition = { x: snappedX, y: clampedY };
        currentValue.current = clamped;
        onPositionChange(clamped);
        // Gesture velocity feeds the spring so the snap continues in the
        // direction the finger was already moving instead of stopping
        // dead and restarting toward the edge - reads as one continuous
        // motion rather than a drag followed by a separate, disconnected
        // animation.
        // Matches the move handler's driver mode - an AnimatedValueXY
        // can't be driven natively in one animation and on the JS thread
        // in another; mixing them on the same value is what the crash
        // above actually traced back to.
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
      // transform instead of left/top - functionally the same position
      // either way (driver mode is JS either way, see above), but this
      // avoids RN having to recompute layout on every frame the way a
      // changing left/top would, which transform does not trigger.
      style={{ transform: [{ translateX: pan.x }, { translateY: pan.y }] }}
    >
      {welcomeMounted && (
        <Animated.View pointerEvents={showWelcome ? "auto" : "none"} style={{
          opacity: welcomeProgress,
          transform: [{ translateY: welcomeProgress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          position: "absolute", bottom: fabSize + 12,
          ...(startPosition.x < (minX + maxX) / 2 ? { left: 0 } : { right: 0 }),
          width: Math.min(240, screenWidth - FAB_EDGE_MARGIN * 2),
          backgroundColor: "#E7EEFF", borderRadius: 20,
          borderWidth: 1, borderColor: "#A8BBE8",
          paddingHorizontal: 17, paddingTop: 13, paddingBottom: 17,
          gap: 9,
          boxShadow: [{ offsetX: 0, offsetY: 3, blurRadius: 18, color: "rgba(25,47,88,0.18)" }],
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text variant="caption" style={{ color: colors.primary, fontWeight: "600", letterSpacing: 0.2 }}>Barangay Bot</Text>
            </View>
            <Pressable onPress={onDismissWelcome} accessibilityRole="button" accessibilityLabel="Isara ang paanyaya" hitSlop={10} style={{ width: 28, height: 28, marginTop: -6, marginRight: -6, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={16} color="#64748B" />
            </Pressable>
          </View>
          <Text variant="body" style={{ color: "#102452", fontWeight: "700", lineHeight: 24 }}>May tanong po kayo?</Text>
          <Text variant="secondary" style={{ color: "#2F4773", marginTop: -5, lineHeight: 21 }}>Magtanong sa akin tungkol sa barangay.</Text>
          <View pointerEvents="none" style={{ position: "absolute", bottom: -5, ...(startPosition.x < (minX + maxX) / 2 ? { left: 26 } : { right: 26 }), width: 9, height: 9, backgroundColor: "#E7EEFF", borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#A8BBE8", transform: [{ rotate: "45deg" }] }} />
        </Animated.View>
      )}
      <Pressable
        onPressIn={() => { pressed.current = true; wakeFab(); }}
        onPressOut={() => { pressed.current = false; scheduleFade(); }}
        onFocus={() => { focused.current = true; wakeFab(); }}
        onBlur={() => { focused.current = false; scheduleFade(); }}
        onPress={() => { onDismissWelcome(); router.push("/(resident)/bot"); }}
        accessibilityRole="button"
        // No visible text label anymore (removed per explicit request), so
        // this accessibilityLabel is the only place the button's purpose is
        // still spelled out — screen readers still announce "Ask the Bot,"
        // even though sighted users now rely on the icon alone.
        accessibilityLabel="Ask the Bot. Draggable — you can move it anywhere on screen."
        className="items-center justify-center"
        style={{
          width: fabSize,
          height: fabSize,
          borderRadius: fabSize / 2,
          backgroundColor: "#7181AE",
          borderWidth: 4,
          borderColor: "white",
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        {/* Keep the rim, icon and shadow opaque; only the blue surface softens. */}
        <Animated.View pointerEvents="none" style={{
          position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
          borderRadius: (fabSize - 8) / 2,
          backgroundColor: colors.primary,
          opacity: activeTint,
        }} />
        <Ionicons name="chatbubble-ellipses" size={Math.round(fabSize * 0.42)} color="white" />
      </Pressable>
    </Animated.View>
  );
}

export default function ResidentLayout() {
  const { width, height } = useWindowDimensions();
  const { scale } = useTypography();
  const { fontScale } = useWindowDimensions();
  const textHeightExtra = Math.max(0, Math.ceil(18 * scale * Math.max(1, fontScale)) - 18);
  const { preferences } = useAppPreferences();
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
  // verify-id added alongside report/bot: it now hides the tab bar itself
  // (same reasoning — keyboard + submit button shouldn't collide with it),
  // so a floating FAB still anchored to where the tab bar used to be would
  // just hang there over a gap instead of over an actual tab bar.
  const hideBotFab =
    pathname === "/report" ||
    pathname === "/bot" ||
    pathname === "/verify-id" ||
    pathname === "/service-complaint" || pathname === "/change-password";
  const tabBarHeight = 72 + insets.bottom + textHeightExtra;
  const navbarScroll = useNavbarScrollController(pathname, tabBarHeight);
  // Lifted out of BotFab itself — see the comment on BotFab for why: it's
  // conditionally rendered, so state local to it would reset every time
  // the resident leaves and returns to a screen where it's shown.
  const [botFabPosition, setBotFabPosition] = useState<{ x: number; y: number } | null>(null);
  // ResidentLayout survives tab changes; a fresh login/app mount gets one invitation.
  const [showBotWelcome, setShowBotWelcome] = useState(true);
  const welcomePath = useRef(pathname);
  useEffect(() => {
    const timer = setTimeout(() => setShowBotWelcome(false), 12000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (welcomePath.current !== pathname) setShowBotWelcome(false);
    welcomePath.current = pathname;
  }, [pathname]);


  return (
    <NavbarScrollProvider value={navbarScroll.value}>
    <View style={{ flex: 1, backgroundColor: colors.residentBackground }}>
      <ComplaintCameraRecovery />
    <Tabs
      backBehavior="fullHistory"
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => <SubtleTabButton {...props} />,
        tabBarActiveTintColor: colors.primary,
        // This is the app's `ink-faint` token (#4B5563), not an arbitrary
        // gray — reused here rather than a fresh hex value so the tab
        // labels meet the same WCAG AA contrast floor already established
        // for status badges and chapter headers elsewhere in the app. The
        // previous value (#6B7280, Tailwind's gray-500) was closer to
        // borderline-AA than genuinely safe at this label's small size —
        // "legible under stress" (skill constraint 6) means erring toward
        // more contrast, not the minimum that technically passes.
        tabBarInactiveTintColor: "#586579",
        tabBarItemStyle: { paddingHorizontal: 2 },
        sceneStyle: { backgroundColor: colors.residentBackground },
        // One rounded background layer; keep the outer bar unclipped for the raised report action.
        tabBarBackground: () => (
          <View pointerEvents="none" style={{
            position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            // Upward shadows separate the bar from scrolling content on Android and iOS.
            boxShadow: [
              { offsetX: 0, offsetY: -6, blurRadius: 20, spreadDistance: 0, color: "rgba(25, 47, 88, 0.10)" },
              { offsetX: 0, offsetY: -1, blurRadius: 4, spreadDistance: 0, color: "rgba(25, 47, 88, 0.07)" },
            ],
          }} />
        ),
        tabBarStyle: {
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          transform: [{ translateY: navbarScroll.translateY }],
          height: tabBarHeight,
          paddingBottom: insets.bottom + 8,
          paddingTop: 11,
          paddingHorizontal: 6,
          backgroundColor: "transparent",
          borderWidth: 0,
          borderTopWidth: 0,
          borderBottomWidth: 0,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
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
      {/* Expo Router 58 redirects focused `href: null` tabs to Home. Keep
          these routes registered and navigable, but hide their tab items. */}
      <Tabs.Screen name="bot" options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="notifications" options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="settings" options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="change-password" options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="verify-id" options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="pending" options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="service-complaint" options={{ tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="report-detail" options={{ tabBarItemStyle: { display: "none" } }} />
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
    {!hideBotFab && preferences.showBot && (
      <BotFab
        key={`${preferences.botButtonSize}-${width}-${height}`}
        bottom={tabBarHeight + 20}
        insetTop={insets.top}
        position={botFabPosition}
        onPositionChange={setBotFabPosition}
        showWelcome={showBotWelcome}
        onDismissWelcome={() => setShowBotWelcome(false)}
      />
    )}
    </View>
    </NavbarScrollProvider>
  );
}
