import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/relativeTime";
import { Card } from "@/components/Card";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  noticeType?: string;
  target?: string;
  alertLevel?: string;
  sender?: string;
  createdAt: string;
  isRead: boolean;
};

// Helper to determine badge styling and label based on alert level
function getAlertBadge(level?: string) {
  const l = (level || "").toLowerCase();
  if (l.includes("mataas") || l.includes("high") || l.includes("orange") || l.includes("warning")) {
    return { label: "Mataas na Alerto", bg: "bg-orange-500", text: "text-white" };
  }
  if (l.includes("kritikal") || l.includes("emergency") || l.includes("critical") || l.includes("red")) {
    return { label: "Kritikal / Emergency", bg: "bg-red-600", text: "text-white" };
  }
  return { label: "Normal", bg: "bg-blue-600", text: "text-white" };
}

// Clean administrative brackets like "[System-wide Broadcast | Mataas na Alerto]" from the title
function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "Announcement";
  return rawTitle.replace(/^\[.*?\]\s*/, "").trim();
}

export default function NotificationScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const isInitialLoad = useRef(true);

  // Navigate back specifically to the Profile tab
  const handleGoToProfile = useCallback(() => {
    router.replace("/(resident)/profile");
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      if (isInitialLoad.current) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped: NotificationItem[] = data.map((item) => {
          const rawTitle = item.title ?? item.pamagat ?? "";
          const rawMessage = item.message ?? item.mensahe ?? "";
          
          let alertLevel = item.alert_level ?? item.alertLevel ?? item.level ?? item.severity ?? "";

          const combinedText = `${rawTitle} ${rawMessage} ${item.notice_type ?? ""}`.toLowerCase();
          if (!alertLevel || alertLevel.toLowerCase() === "normal") {
            if (combinedText.includes("mataas")) {
              alertLevel = "Mataas na Alerto";
            } else if (combinedText.includes("kritikal") || combinedText.includes("emergency")) {
              alertLevel = "Kritikal / Emergency";
            } else {
              alertLevel = "Normal";
            }
          }

          return {
            id: String(item.id ?? item.notification_id ?? ""),
            title: cleanTitle(rawTitle),
            message: rawMessage || "No details provided.",
            noticeType: item.notice_type ?? item.type ?? "System-level Broadcast",
            target: item.target ?? "System-wide Broadcast",
            alertLevel,
            sender: item.sender ?? item.mula_kay ?? "Admin",
            createdAt: item.created_at,
            isRead: Boolean(item.is_read),
          };
        });

        setNotifications(mapped);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // 1. Initial Data Fetch
      fetchNotifications();

      // 2. Real-Time Supabase Listener
      // Automatically receives broadcasts as soon as admin posts them
      const channel = supabase
        .channel("realtime-notifications-tab")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          () => {
            // Silently refresh the list in background
            fetchNotifications();
          }
        )
        .subscribe();

      // 3. Android Physical Back Button Handler -> Navigates to Profile
      const onBackPress = () => {
        handleGoToProfile();
        return true;
      };

      const backHandler = BackHandler.addEventListener("hardwareBackPress", onBackPress);

      return () => {
        supabase.removeChannel(channel);
        backHandler.remove();
      };
    }, [fetchNotifications, handleGoToProfile])
  );

  async function handleToggleExpand(item: NotificationItem) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const isOpening = !expandedIds[item.id];
    setExpandedIds((prev) => ({
      ...prev,
      [item.id]: !prev[item.id],
    }));

    if (isOpening && !item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );

      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", item.id);

        if (error && error.code === "42703") {
          await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("notification_id", item.id);
        }
      } catch (err) {
        console.warn("Failed to update read status:", err);
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-3 pb-4 flex-row items-center justify-between border-b border-gray-100">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleGoToProfile}
            className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:opacity-70"
          >
            <Ionicons name="arrow-back" size={20} color="#1F2937" />
          </Pressable>
          <Text className="text-[22px] font-semibold text-ink tracking-tight">
            Notifications
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {loading ? (
          <Card className="p-8 items-center justify-center">
            <ActivityIndicator color="#1D4ED8" size="large" />
            <Text className="text-[13px] text-ink-faint mt-3">
              Loading announcements...
            </Text>
          </Card>
        ) : notifications.length === 0 ? (
          <Card className="p-8 items-center justify-center">
            <Ionicons name="notifications-off-outline" size={32} color="#9CA3AF" />
            <Text className="text-[15px] font-semibold text-ink mt-2">
              No notifications
            </Text>
            <Text className="text-[13px] text-ink-faint text-center mt-1">
              Official barangay alerts and announcements will appear here.
            </Text>
          </Card>
        ) : (
          <View className="gap-3 pb-8">
            {notifications.map((item) => {
              const isExpanded = Boolean(expandedIds[item.id]);
              const alertBadge = getAlertBadge(item.alertLevel);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleToggleExpand(item)}
                  className="active:opacity-95"
                >
                  <Card className={`p-4 border ${!item.isRead ? "border-brand bg-blue-50/20" : "border-gray-200"}`}>
                    {/* Header Badges */}
                    <View className="flex-row flex-wrap items-center gap-1.5 mb-2">
                      <View className="px-2 py-0.5 rounded-full bg-gray-100">
                        <Text className="text-[10px] font-medium text-gray-600">
                          {item.noticeType}
                        </Text>
                      </View>

                      <View className={`px-2.5 py-0.5 rounded-full ${alertBadge.bg}`}>
                        <Text className={`text-[10px] font-bold ${alertBadge.text}`}>
                          {alertBadge.label}
                        </Text>
                      </View>

                      {!item.isRead && (
                        <View className="w-2.5 h-2.5 rounded-full bg-brand ml-auto" />
                      )}
                    </View>

                    {/* Title Row */}
                    <View className="flex-row items-center justify-between mt-1">
                      <Text className={`flex-1 text-[15px] ${!item.isRead ? "font-bold text-ink" : "font-semibold text-ink"}`}>
                        {item.title}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#6B7280"
                        style={{ marginLeft: 8 }}
                      />
                    </View>

                    {/* Metadata Subtitle */}
                    <View className="flex-row items-center justify-between mt-1.5">
                      <Text className="text-[11px] text-ink-faint">
                        {relativeTime(item.createdAt)}
                      </Text>
                      {item.sender ? (
                        <Text className="text-[11px] text-ink-faint">
                          Mula kay: {item.sender}
                        </Text>
                      ) : null}
                    </View>

                    {/* Expandable Message Body */}
                    {isExpanded && (
                      <View className="mt-3 pt-3 border-t border-gray-100">
                        <Text className="text-[14px] text-ink leading-5">
                          {item.message}
                        </Text>
                      </View>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}