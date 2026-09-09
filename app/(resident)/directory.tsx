import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Linking, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";

interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  urgent: boolean;
}

function ContactCard({ contact }: { contact: EmergencyContact }) {
  const handleCall = () => {
    const cleanPhone = contact.phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`);
  };

  return (
    <Card className="p-4 flex-row items-center justify-between mb-3">
      <View className="flex-1 pr-3">
        <Text className="font-semibold text-ink text-[15px] mb-0.5">{contact.name}</Text>
        {contact.role ? (
          <Text className="text-[12px] text-ink-faint">{contact.role}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={handleCall}
        className={`w-11 h-11 rounded-full items-center justify-center active:opacity-80 ${
          contact.urgent ? "bg-alert" : "bg-brand"
        }`}
      >
        <Ionicons name="call" size={17} color="white" />
      </Pressable>
    </Card>
  );
}

export default function DirectoryScreen() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchContacts = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("is_active", true)
        .order("contact_id", { ascending: true });

      if (error) throw error;

      if (data) {
        const mapped: EmergencyContact[] = data.map((c) => ({
          id: String(c.contact_id),
          name: c.agency_name || c.name || "Emergency Contact",
          role: c.contact_person || c.role || "",
          phone: c.phone_number || c.phone || "",
          urgent: c.category === "Emergency" || c.urgent === true,
        }));
        setContacts(mapped);
      }
    } catch (err) {
      console.error("Error loading emergency contacts from Supabase:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch whenever the user tab switches back to Directory
  useFocusEffect(
    useCallback(() => {
      fetchContacts(false);
    }, [fetchContacts])
  );

  // Subscribe to real-time changes from Supabase (Insert, Update, Delete)
  useEffect(() => {
    fetchContacts(true);

    const channel = supabase
      .channel("emergency_contacts_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emergency_contacts",
        },
        () => {
          fetchContacts(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchContacts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContacts(false);
  };

  const urgent = contacts.filter((c) => c.urgent);
  const routine = contacts.filter((c) => !c.urgent);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-5 pt-3 pb-5">
        <Text className="text-[24px] font-semibold text-ink tracking-tight">
          Emergency Directory
        </Text>
        <Text className="text-[13px] text-ink-faint mt-0.5">
          Tap a contact to call
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1D4ED8"]} />
        }
      >
        {loading ? (
          <Card className="p-8 items-center justify-center">
            <ActivityIndicator color="#1D4ED8" size="large" />
            <Text className="text-[13px] text-ink-faint mt-3">Loading directory...</Text>
          </Card>
        ) : contacts.length === 0 ? (
          <Card className="p-8 items-center justify-center">
            <Ionicons name="call-outline" size={32} color="#9CA3AF" />
            <Text className="text-[15px] font-semibold text-ink mt-2">
              No contacts found
            </Text>
            <Text className="text-[12px] text-ink-faint text-center mt-1">
              Emergency contacts will appear here once published by the barangay.
            </Text>
          </Card>
        ) : (
          <>
            {urgent.length > 0 && (
              <View className="mb-6">
                <SectionLabel>Emergency</SectionLabel>
                <View className="mt-2">
                  {urgent.map((c) => (
                    <ContactCard key={c.id} contact={c} />
                  ))}
                </View>
              </View>
            )}

            {routine.length > 0 && (
              <View className="mb-8">
                <SectionLabel>Barangay Services</SectionLabel>
                <View className="mt-2">
                  {routine.map((c) => (
                    <ContactCard key={c.id} contact={c} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}