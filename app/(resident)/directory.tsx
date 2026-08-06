import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase"; // ⚠️ Adjust this import path if needed
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors } from "@/lib/theme";

interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  urgent: boolean;
}

function ContactCard({ contact }: { contact: EmergencyContact }) {
  const handleCall = () => {
    // Sanitize phone number and format tel URL correctly
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

  useEffect(() => {
    async function fetchContacts() {
      try {
        setLoading(true);
        // Query live 'emergency_contacts' where is_active = true
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
      }
    }

    fetchContacts();
  }, []);

  const urgent = contacts.filter((c) => c.urgent);
  const routine = contacts.filter((c) => !c.urgent);

  return (
    <SafeAreaView className="flex-1" edges={["top"]}>
      <ScreenBackground>
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
      >
        {loading ? (
          <Card className="p-8 items-center justify-center">
            <ActivityIndicator color={colors.primary} size="large" />
            <Text className="text-[13px] text-ink-faint mt-3">Loading directory...</Text>
          </Card>
        ) : contacts.length === 0 ? (
          <Card className="p-8 items-center justify-center">
            <Ionicons name="call-outline" size={32} color={colors.outlineFaint} />
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
    </ScreenBackground>
    </SafeAreaView>
  );
}