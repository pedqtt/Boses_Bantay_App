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

/** Keyword match against name/role, not a dedicated DB field - this data
 *  doesn't carry an icon/category column, so this is a heuristic over the
 *  known agency vocabulary (BFP, PNP, Barangay Hall, Tanod, Health
 *  Center), with a sane, non-broken fallback (a plain call icon) for
 *  anything that doesn't match rather than guessing wrong. Reused to draw
 *  each row's leading icon so an agency's *type* is scannable on sight,
 *  not just its name text. */
function categoryIcon(contact: EmergencyContact): keyof typeof Ionicons.glyphMap {
  const text = `${contact.name} ${contact.role}`.toLowerCase();
  if (/fire|bfp/.test(text)) return "flame";
  if (/police|pnp/.test(text)) return "shield-checkmark";
  if (/health|clinic|hospital|rhu|medical/.test(text)) return "medkit";
  if (/tanod|patrol/.test(text)) return "walk";
  if (/barangay hall|captain|kagawad/.test(text)) return "business";
  return contact.urgent ? "alert-circle" : "call";
}

/**
 * ContactRow - was ContactCard, one bordered box per contact, N of them
 * stacked with margin between. Rebuilt as a row inside one shared list
 * container instead, on the same "1 card with hairline-divided rows"
 * convention Review's field cards and Sa Barangay Hall's step list
 * already use elsewhere in this app (POST_BLOTTER_STEPS' Card, FieldRow) -
 * this screen was the odd one out, using N separate floating boxes for a
 * list of same-shaped items instead of one contained list. Five or six
 * individually-bordered, individually-shadowed-by-implication cards read
 * as five or six unrelated things; one list with a border-b between rows
 * reads as what it actually is - one list, grouped, organized.
 *
 * Three-zone row (leading icon | info stack | call action):
 *
 *   1. Leading zone - a category icon avatar, same tinted-circle language
 *      Home's own quick-access buttons use, so "what kind of contact is
 *      this" is scannable before reading a single word.
 *   2. Info zone - name (primary, largest/boldest) + urgency label, then
 *      role and phone number (secondary, genuinely decision-relevant, not
 *      background metadata - a resident confirming this is the right
 *      contact, or needing to dial manually if the tel: link fails).
 *   3. Action zone - the call button, full row height, right edge.
 *
 * Label - "Emergency" badge, reserved strictly for the urgent group,
 * bg-alert-50/text-alert-dark - the same badge vocabulary STATUS_STYLES
 * already establishes on home.tsx/reports.tsx. The urgent tint carries
 * through the leading icon avatar too, so it's one signal shown
 * consistently (icon, badge, call button), not just the button's fill
 * color as the sole carrier of "this one's urgent."
 */
function ContactRow({ contact, isLast }: { contact: EmergencyContact; isLast?: boolean }) {
  const hasPhone = Boolean(contact.phone.trim());

  const handleCall = () => {
    if (!hasPhone) return;
    const cleanPhone = contact.phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`);
  };

  return (
    <View className={`flex-row items-center px-4 py-4 ${isLast ? "" : "border-b border-gray-100"}`}>
      {/* Leading zone - agency type, at a glance. */}
      <View
        className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${
          contact.urgent ? "bg-alert-50" : "bg-brand-50"
        }`}
      >
        <Ionicons
          name={categoryIcon(contact)}
          size={19}
          color={contact.urgent ? colors.onErrorContainer : colors.primary}
        />
      </View>

      {/* Info zone. */}
      <View className="flex-1 pr-3">
        <Text className="font-semibold text-ink text-[16px] mb-1" numberOfLines={1}>
          {contact.name}
        </Text>

        {contact.urgent && (
          <View className="flex-row items-center self-start bg-alert-50 rounded-full px-2 py-0.5 mb-1.5">
            <Ionicons
              name="alert-circle"
              size={11}
              color={colors.onErrorContainer}
              style={{ marginRight: 3 }}
            />
            <Text className="text-[10px] font-bold uppercase tracking-wide text-alert-dark">
              Emergency
            </Text>
          </View>
        )}

        {contact.role ? (
          <Text className="text-[13px] text-ink-soft mb-1">{contact.role}</Text>
        ) : null}

        {hasPhone ? (
          <Text className="text-[13px] text-ink-faint" style={{ letterSpacing: 0.4 }}>
            {contact.phone}
          </Text>
        ) : (
          <Text className="text-[13px] text-ink-faint italic">Walang nakalistang numero</Text>
        )}
      </View>

      {/* Action zone. */}
      <Pressable
        onPress={handleCall}
        disabled={!hasPhone}
        className={`w-12 h-12 rounded-full items-center justify-center active:opacity-80 ${
          !hasPhone ? "bg-gray-200" : contact.urgent ? "bg-alert" : "bg-brand"
        }`}
      >
        <Ionicons name="call" size={18} color={hasPhone ? "white" : colors.outline} />
      </Pressable>
    </View>
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
    <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: colors.surface }}>
      <ScreenBackground>
        <View className="px-5 pt-3 pb-5">
          <Text className="text-[24px] font-semibold text-ink tracking-tight">
            Emergency Directory
          </Text>
          <Text className="text-[13px] text-ink-faint mt-0.5">
            Pindutin ang icon para tumawag
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
              <Text className="text-[15px] font-semibold text-ink mt-2">No contacts found</Text>
              <Text className="text-[12px] text-ink-faint text-center mt-1">
                Emergency contacts will appear here once published by the barangay.
              </Text>
            </Card>
          ) : (
            <>
              {/* Urgent group first, always - "default sort should match
                  the user's most urgent need," not the order contact_id
                  happens to return. Each section is one Card containing
                  its rows, not one Card per contact - see ContactRow's
                  doc comment for why. */}
              {urgent.length > 0 && (
                <View className="mb-6">
                  <SectionLabel>Emergency</SectionLabel>
                  <Card className="overflow-hidden">
                    {urgent.map((c, i) => (
                      <ContactRow key={c.id} contact={c} isLast={i === urgent.length - 1} />
                    ))}
                  </Card>
                </View>
              )}

              {routine.length > 0 && (
                <View className="mb-8">
                  <SectionLabel>Barangay Services</SectionLabel>
                  <Card className="overflow-hidden">
                    {routine.map((c, i) => (
                      <ContactRow key={c.id} contact={c} isLast={i === routine.length - 1} />
                    ))}
                  </Card>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </ScreenBackground>
    </SafeAreaView>
  );
}
