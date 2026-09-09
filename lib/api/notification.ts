// Client-side notification helpers used by the React Native app.
// Provides a Supabase-based implementation when configured, and a
// small in-memory mock fallback for local development.

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Notification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "ID Verified",
    message: "Your Barangay ID has been approved.",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "n2",
    title: "System Update",
    message: "The app will undergo maintenance tonight.",
    isRead: true,
    createdAt: new Date().toISOString(),
  },
];

export async function getMyNotifications(): Promise<Notification[]> {
  if (!isSupabaseConfigured) {
    await delay(250);
    return [...MOCK_NOTIFICATIONS].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      message: String(row.message ?? ""),
      isRead: Boolean(row.is_read),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }));
  } catch (err) {
    console.warn("[notifications] Supabase fetch failed, falling back to mock:", err);
    await delay(200);
    return [...MOCK_NOTIFICATIONS];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const idx = MOCK_NOTIFICATIONS.findIndex((n) => n.id === id);
    if (idx >= 0) MOCK_NOTIFICATIONS[idx].isRead = true;
    return;
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.warn("[notifications] Failed to mark read:", err);
  }
}

export const isNotificationsConfigured = isSupabaseConfigured;