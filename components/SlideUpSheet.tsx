import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Keyboard, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Text } from "@/components/AppText";
import { Ionicons } from "@/components/AppIcon";

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
export function SlideUpSheet({ visible, title, onClose, children, footer }: {
  visible: boolean; title: string; onClose: () => void; children: ReactNode;
  footer?: (close: () => void) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  const offset = useRef(new Animated.Value(1000)).current;
  const panelHeight = useRef(0), ready = useRef(false), entered = useRef(false), closing = useRef(false);
  useEffect(() => {
    if (visible) Keyboard.dismiss();
    if (!visible) {
      offset.stopAnimation(); offset.setValue(1000);
      panelHeight.current = 0; ready.current = false; entered.current = false; closing.current = false;
    }
  }, [visible, offset]);
  useEffect(() => () => offset.stopAnimation(), [offset]);
  const enter = () => {
    if (!ready.current || !panelHeight.current || entered.current || closing.current) return;
    entered.current = true;
    offset.setValue(panelHeight.current + 12);
    Animated.timing(offset, { toValue: 0, duration: reduceMotion ? 0 : 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const close = () => {
    if (closing.current) return;
    closing.current = true; offset.stopAnimation();
    Animated.timing(offset, { toValue: (panelHeight.current || 1000) + 12, duration: reduceMotion ? 0 : 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
      closing.current = false;
    });
  };
  return <Modal visible={visible} transparent animationType="none" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onShow={() => { ready.current = true; enter(); }} onRequestClose={close}>
    <View style={styles.overlay}>
      <StatusBar style="light" animated={false} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(18,28,49,0.3)" }]} />
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: "#17294B" }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Isara ang filters" style={StyleSheet.absoluteFill} onPress={close} />
      <AnimatedSafeAreaView accessibilityViewIsModal onAccessibilityEscape={close} edges={["bottom"]} onLayout={event => { panelHeight.current = event.nativeEvent.layout.height; enter(); }} style={[styles.sheet, { transform: [{ translateY: offset }] }]}>
        <View style={styles.handle} />
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Isara" onPress={close} style={styles.close}><Ionicons name="close" size={22} color="#52617A" /></Pressable></View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {footer && <View style={styles.footer}>{footer(close)}</View>}
      </AnimatedSafeAreaView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "82%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  handle: { alignSelf: "center", width: 34, height: 4, borderRadius: 2, backgroundColor: "#D9E1ED", marginTop: 12 },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: "#20304A" },
  close: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DEE5EF", alignItems: "center", justifyContent: "center" },
  scroll: { flexShrink: 1 }, body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E1E7EF" },
});
