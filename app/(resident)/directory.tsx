import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getEmergencyContacts, type EmergencyContact } from "@/lib/api/mockData";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";

function ContactCard({ contact }: { contact: EmergencyContact }) {
  return (
    <Card className="p-4 flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="font-semibold text-ink text-[15px] mb-0.5">{contact.name}</Text>
        <Text className="text-[12px] text-ink-faint">{contact.role}</Text>
      </View>
      <Pressable
        onPress={() => Linking.openURL(`tel:${contact.phone.replace(/[^0-9+]/g, "")}`)}
        // 44x44 minimum touch target — this is the "call for help" button,
        // it gets the largest reachable tap area in the app (Fitts's Law).
        // Solid fill, not a tinted/bordered circle.
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
    (async () => {
      setContacts(await getEmergencyContacts());
      setLoading(false);
    })();
  }, []);

  const urgent = contacts.filter((c) => c.urgent);
  const routine = contacts.filter((c) => !c.urgent);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-5 pt-3 pb-5">
        <Text className="text-[24px] font-semibold text-ink tracking-tight">Emergency Directory</Text>
        <Text className="text-[13px] text-ink-faint mt-0.5">Tap a contact to call</Text>
      </View>
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        // Same reason as home.tsx: reserve room for the floating Bot
        // button so the last contact card doesn't end up underneath it.
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {loading ? (
          <Card className="p-8 items-center">
            <ActivityIndicator color="#1D4ED8" />
          </Card>
        ) : (
          <>
            {urgent.length > 0 && (
              <View className="mb-6">
                <SectionLabel>Emergency</SectionLabel>
                <View className="gap-3">
                  {urgent.map((c) => (
                    <ContactCard key={c.id} contact={c} />
                  ))}
                </View>
              </View>
            )}
            {routine.length > 0 && (
              <View className="mb-8">
                <SectionLabel>Barangay Services</SectionLabel>
                <View className="gap-3">
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
