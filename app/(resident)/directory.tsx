import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase"; // ⚠️ Adjust this import path if needed
import { Card } from "@/components/Card";
import { ScreenBackground } from "@/components/ScreenBackground";
import { colors } from "@/lib/theme";

/**
 * Directory-local section header - deliberately not the shared
 * `SectionLabel` (that component is also used on Home for plain labels
 * like "Quick access", and baking a colored dot + count into it would
 * change those too). Same 12px/uppercase/tracked-out type as
 * SectionLabel, extended with a small color dot (matching each section's
 * theme - red for the urgent group, blue for routine services, so the
 * label itself previews what's below it) and a live count, so a resident
 * scanning quickly knows how many contacts are in each group without
 * reading every card.
 */
function DirectorySectionLabel({
  children,
  count,
  dotColor,
}: {
  children: string;
  count: number;
  dotColor: string;
}) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <View className="flex-row items-center">
        <View
          className="rounded-full mr-2"
          style={{ width: 6, height: 6, backgroundColor: dotColor }}
        />
        <Text className="text-[12px] font-semibold text-ink-faint uppercase tracking-wider">
          {children}
        </Text>
      </View>
      <View
        className="rounded-full"
        style={{
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        }}
      >
        <Text className="text-[11px] font-semibold" style={{ color: colors.outline }}>
          {count}
        </Text>
      </View>
    </View>
  );
}

interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  urgent: boolean;
}

// QC Helpline 122 is the actual citywide 24/7 emergency/complaints line
// (quezoncity.gov.ph/program/qc-helpline-122) - not a barangay-level
// contact, so it isn't something the emergency_contacts table is
// expected to carry. It's the one thing this bar should always lead
// with regardless of what a given barangay has published, so it's a
// fixed constant here rather than something selected out of Supabase
// data (that selection is what kept promoting whichever single-station
// contact - e.g. BFP Milagrosa - happened to sort first).
const QC_HELPLINE: EmergencyContact = {
  id: "qc-helpline-122",
  name: "Quezon City Emergency Hotline",
  role: "",
  phone: "122",
  urgent: true,
};

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

function callContact(contact: EmergencyContact) {
  if (!contact.phone.trim()) return;
  const cleanPhone = contact.phone.replace(/[^0-9+]/g, "");
  Linking.openURL(`tel:${cleanPhone}`);
}

/**
 * PrimaryEmergencyBar - the one thing every source on emergency/SOS UI
 * agrees on that this screen didn't have yet: a single, large,
 * high-contrast, one-hand-reachable action with an explicit text label,
 * not an icon a panicked or unfamiliar user has to interpret first. Every
 * other contact on this screen is "look something up"; this one is "get
 * help right now," so it gets its own row at the very top, sized and
 * worded differently from everything under it rather than just being the
 * first tile in a grid of otherwise-equal items.
 *
 * Which contact gets promoted here isn't a UI choice made in this
 * component - it's whichever urgent contact sorts first from Supabase
 * (contact_id ascending), same source of truth the rest of the screen
 * already trusts for ordering. If that changes (a "priority" flag, say),
 * only the parent's selection logic needs to change.
 *
 * Minimalist pass - same structure, less furniture: the trailing chevron
 * circle is gone (the whole bar is already the tap target; a directional
 * arrow next to it was decoration, not information). Icon disc, eyebrow,
 * name, and number stay - each of those is still doing real work
 * (what/why/who/how), nothing left to cut without losing meaning. No
 * shadow anywhere on this screen - separation between surfaces comes from
 * fill color and, where two similar surfaces sit next to each other, a
 * flat border instead of simulated elevation.
 */
function PrimaryEmergencyBar({ contact }: { contact: EmergencyContact }) {
  const hasPhone = Boolean(contact.phone.trim());
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!hasPhone) return;
    await Clipboard.setStringAsync(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Pressable
      onPress={() => callContact(contact)}
      disabled={!hasPhone}
      accessibilityRole="button"
      accessibilityLabel={`Tumawag sa ${contact.name}`}
      className="rounded-2xl mb-4 px-7 pt-7 pb-7 active:opacity-90"
      style={{ backgroundColor: hasPhone ? colors.error : colors.outlineFaint }}
    >
      {/* Legibility fix kept (letter-spacing -1, not -2) but the copy
          button's circular fill is gone again - back to a bare icon,
          just with a generous hitSlop so the tap target is still real
          without drawing a visible shape for it. Minimal reading over
          structured-looking. */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1" style={{ minWidth: 0 }}>
          {hasPhone ? (
            <>
              <Text
                className="text-white font-extrabold"
                style={{ fontSize: 60, lineHeight: 62, letterSpacing: -1, fontVariant: ["tabular-nums"] }}
                numberOfLines={1}
              >
                {contact.phone}
              </Text>
              <Text
                className="text-[13.5px] font-medium mt-2"
                style={{ color: "rgba(255,255,255,0.75)" }}
                numberOfLines={1}
              >
                {contact.name}
              </Text>
            </>
          ) : (
            <Text className="text-white font-bold text-[19px] tracking-tight" numberOfLines={1}>
              {contact.name}
            </Text>
          )}
        </View>
        {hasPhone && (
          <Pressable
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={copied ? "Nakopya na" : `Kopyahin ang numero ng ${contact.name}`}
            hitSlop={10}
            className="items-center justify-center active:opacity-60"
            style={{ width: 30, height: 30, marginLeft: 10 }}
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={22}
              color="rgba(255,255,255,0.85)"
            />
          </Pressable>
        )}
      </View>

      {/* Same rounded-2xl/mt-7 as before - still the card's own shape
          and spacing scale, just carried through unchanged rather than
          adding new decoration to make it feel "structured." */}
      {hasPhone && (
        <View
          className="flex-row items-center justify-center rounded-xl mt-6"
          style={{ height: 40, backgroundColor: "white" }}
        >
          <Ionicons name="call" size={14} color={colors.error} style={{ marginRight: 6 }} />
          <Text className="font-semibold text-[13px]" style={{ color: colors.error, letterSpacing: 0.2 }}>
            Tumawag Ngayon
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * EmergencyTile - every OTHER urgent contact once one has already been
 * promoted to PrimaryEmergencyBar above. Two-column tiles, white surface,
 * left-aligned text - see git history for the two earlier passes (a taller
 * full-width row list, then a solid-red-fill grid) this replaced and why
 * each one didn't hold up: full-width rows cost too much vertical space
 * for a group that's usually 2-4 contacts; solid red fill read as a wall
 * of loud blocks instead of a scannable list once there were more than two
 * or three of them.
 *
 * Visual pass: a bare icon glyph read as a wireframe, not a finished
 * surface. The icon now sits in its own tinted disc (the same "category
 * icon in a colored circle" language the routine list and Home's
 * quick-access chips already use elsewhere in this app - this was the
 * one place that had drifted from it). A flat border defines the tile's
 * edge - no shadow on this screen.
 */
function EmergencyTile({ contact }: { contact: EmergencyContact }) {
  const hasPhone = Boolean(contact.phone.trim());
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!hasPhone) return;
    await Clipboard.setStringAsync(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="p-3.5">
      <View className="flex-row items-center mb-3">
        <View
          className="w-9 h-9 rounded-full items-center justify-center mr-2.5"
          style={{ backgroundColor: hasPhone ? colors.errorContainer : "#F3F4F6" }}
        >
          <Ionicons
            name={categoryIcon(contact)}
            size={16}
            color={hasPhone ? colors.error : colors.outline}
          />
        </View>
        <Text className="flex-1 font-semibold text-ink text-[14px]" numberOfLines={1}>
          {contact.name}
        </Text>
      </View>

      {/* Same composed split bar as ContactRow, same dimensions - only
          the fill color (red vs blue) differs, so the two lists read as
          one consistent system instead of the routine list looking
          "finished" and this one looking like an earlier draft of it. */}
      <View className="flex-row items-stretch rounded-xl overflow-hidden">
        <Pressable
          onPress={() => callContact(contact)}
          disabled={!hasPhone}
          accessibilityRole="button"
          accessibilityLabel={`Tumawag sa ${contact.name}`}
          className="flex-1 flex-row items-center active:opacity-85"
          style={{
            paddingVertical: 11,
            paddingHorizontal: 14,
            backgroundColor: hasPhone ? colors.errorContainer : "#F3F4F6",
          }}
        >
          <Ionicons
            name="call"
            size={15}
            color={hasPhone ? colors.error : colors.outline}
            style={{ marginRight: 8 }}
          />
          <Text
            className="text-[13.5px] font-semibold"
            style={{ color: hasPhone ? colors.error : colors.outline, letterSpacing: 0.3 }}
            numberOfLines={1}
          >
            {hasPhone ? contact.phone : "Walang numero"}
          </Text>
        </Pressable>

        {hasPhone && (
          <Pressable
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={copied ? "Nakopya na" : `Kopyahin ang numero ng ${contact.name}`}
            className="items-center justify-center active:opacity-70 bg-white"
            style={{ width: 46, borderLeftWidth: 1.5, borderLeftColor: colors.outline }}
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={17}
              color={copied ? "#16A34A" : colors.error}
            />
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/**
 * ContactRow - the routine/Barangay Services list. Separate, bordered Card
 * per contact (not one shared Card with hairlines inside), same reasoning
 * as EmergencyTile/PrimaryEmergencyBar reading as distinct objects rather
 * than spreadsheet rows. No shadow - Card's own default flat border does
 * the separation work.
 *
 * Two zones - identity (icon, name, role) and a single composed action
 * bar below it, not three stacked pieces (a muted phone line, then a
 * separate full-width button, then nothing tying them together). The
 * number was reference text sitting above the actual action that dials
 * it, which put visual distance between "here's who" and "here's how" -
 * merged now into one split bar: a call segment carrying both the label
 * AND the number (so the number reads as part of what happens when you
 * tap, not a caption above it), with a divided-off copy segment beside
 * it - the same split-button shape a phone's own native call sheet uses
 * (main action, one secondary action docked to it) rather than two
 * unrelated controls scattered around the card.
 *
 * Copy - phone numbers in a directory like this get typed into other
 * apps as often as they get called from this one (texted to a neighbor,
 * saved to a personal contacts app); `tel:` links don't cover that, and
 * this app can't create device contacts. `expo-clipboard` covers the
 * actual gap: one tap, then a checkmark confirms it worked (RN doesn't
 * surface a native "copied" toast, so this fakes that same brief
 * confirmation instead of leaving the tap's result ambiguous).
 */
function ContactRow({ contact }: { contact: EmergencyContact }) {
  const hasPhone = Boolean(contact.phone.trim());
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!hasPhone) return;
    await Clipboard.setStringAsync(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="p-3.5">
      <View className="flex-row items-center mb-3">
        <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center mr-2.5">
          <Ionicons name={categoryIcon(contact)} size={16} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-ink text-[14px]" numberOfLines={1}>
            {contact.name}
          </Text>
          {contact.role ? (
            <Text className="text-[11px] text-ink-faint mt-0.5" numberOfLines={1}>
              {contact.role}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Minimalist pass on the same split bar - dropped the "TAWAGAN"
          eyebrow (the icon already says "call," the label was restating
          it) and the translucent circle behind the icon (a flat icon
          directly on the fill reads just as clearly and is one fewer
          decorative layer). One line now: icon, then the number - still
          a wide call segment + a docked copy segment, same structure. */}
      <View className="flex-row items-stretch rounded-xl overflow-hidden">
        <Pressable
          onPress={() => callContact(contact)}
          disabled={!hasPhone}
          accessibilityRole="button"
          accessibilityLabel={`Tumawag sa ${contact.name}`}
          className="flex-1 flex-row items-center active:opacity-85"
          style={{
            paddingVertical: 11,
            paddingHorizontal: 14,
            backgroundColor: hasPhone ? colors.primaryContainer : "#F3F4F6",
          }}
        >
          <Ionicons
            name="call"
            size={15}
            color={hasPhone ? colors.primary : colors.outline}
            style={{ marginRight: 8 }}
          />
          <Text
            className="text-[13.5px] font-semibold"
            style={{ color: hasPhone ? colors.primary : colors.outline, letterSpacing: 0.3 }}
            numberOfLines={1}
          >
            {hasPhone ? contact.phone : "Walang numero"}
          </Text>
        </Pressable>

        {/* FIXED - was colors.onPrimaryContainer (#011760) docked right
            next to colors.primary (#021F94) - two near-identical dark
            navies with barely a value difference between them, so the
            split read as one flat dark bar instead of two distinct
            segments. White instead, with a brand-colored icon: now the
            "docked secondary action" reads as an actual second surface
            (light against dark) the way a real split button/segmented
            control should, not just a slightly darker patch of the same
            color. */}
        {hasPhone && (
          <Pressable
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={copied ? "Nakopya na" : `Kopyahin ang numero ng ${contact.name}`}
            className="items-center justify-center active:opacity-70 bg-white"
            style={{ width: 46, borderLeftWidth: 1.5, borderLeftColor: colors.outline }}
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={17}
              color={copied ? "#16A34A" : colors.primary}
            />
          </Pressable>
        )}
      </View>
    </Card>
  );
}

export default function DirectoryScreen() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  // Fetches once on mount only (empty dep array below) - this screen was
  // never actually re-fetching on every tab switch to begin with (no
  // useFocusEffect here, and React Navigation keeps tab screens mounted
  // by default rather than remounting them), so contacts already load
  // exactly once per app session, not on every visit.
  //
  // What WAS missing: any way to get fresh data without that being true.
  // "Only update if something changed in the database" isn't something a
  // phone can know on its own without a live subscription - the practical
  // middle ground every list-of-published-content screen uses is manual
  // pull-to-refresh: nothing fetches in the background, the resident
  // decides when to check for updates. Wired to the same fetchContacts
  // logic below, now callable from both the initial mount and the
  // ScrollView's RefreshControl.
  const fetchContacts = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
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
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchContacts({ silent: true });
    setRefreshing(false);
  }

  // Search filters the whole directory, not a client-side afterthought
  // bolted onto one section - a resident looking for "health center" needs
  // that to work whether it landed in Emergency or Barangay Services.
  // Applied before the urgent/routine/primary split below, so every
  // derived group reflects the filtered set consistently.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const urgent = filtered.filter((c) => c.urgent);
  const routine = filtered.filter((c) => !c.urgent);
  // Hero bar is always QC Helpline 122, fixed - not selected out of
  // whatever the barangay happened to publish (that's what kept
  // promoting BFP Milagrosa). Every actual published urgent contact,
  // BFP Milagrosa included, now stays in the Emergency grid below it
  // instead of being pulled out to make room for the hero.
  const primary = QC_HELPLINE;
  const restUrgent = urgent;

  return (
    <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: colors.surfaceContainerLow }}>
      {/* Body lightened off the app-wide surface tone (#F5F2F3), same
          per-screen override bot.tsx uses - now that the header below is
          pure white with a hairline border, the shared gray-ish surface
          read noticeably duller by comparison against it. Cards keep
          their own white fill/border untouched - this only affects the
          open page background around them. */}
      <ScreenBackground backgroundColor="#FAF8F7">
        {/* Header now pure white with a hairline bottom border, not the
            same surface color as the content below it - matches bot.tsx's
            header treatment so both screens read consistently instead of
            each doing its own thing. No leading icon badge next to the
            title either - this screen opens with a phone icon on the very
            next thing under it (PrimaryEmergencyBar), a second one here
            would repeat, not reinforce. */}
        <View
          className="px-5 pt-3 pb-4"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
          }}
        >
          {/* Title + a live total count, same "count previews what's
              below" idea as the section labels further down - a resident
              opening this screen sees at a glance how many contacts the
              barangay has published, not just a bare title. */}
          <View className="flex-row items-end justify-between mb-4">
            <Text className="text-[24px] font-semibold text-ink tracking-tight">
              Emergency Directory
            </Text>
            {!loading && contacts.length > 0 && (
              <View
                className="rounded-full mb-0.5"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                }}
              >
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: colors.outline }}
                >
                  {contacts.length} contact{contacts.length === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </View>

          {/* Search - real utility once the directory grows past a handful
              of contacts, not decoration. Lives in the persistent header
              zone (outside the ScrollView) so it stays reachable while
              scanning a long filtered list, the same reason it isn't
              buried inside a collapsible section. Filled with the page's
              own tint (not white, which is what the header itself is now)
              so it reads as an inset field sitting IN the header, not a
              white-on-white shape defined only by its border. */}
          {!loading && contacts.length > 0 && (
            <View
              className="flex-row items-center rounded-full px-4"
              style={{
                height: 46,
                backgroundColor: "#FAF8F7",
                borderWidth: 1,
                borderColor: colors.outlineVariant,
              }}
            >
              <Ionicons name="search" size={17} color={colors.outline} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Maghanap ng contact o serbisyo"
                placeholderTextColor={colors.outline}
                className="flex-1 ml-2.5 text-[14px] text-ink"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="I-clear ang paghahanap">
                  <Ionicons name="close-circle" size={17} color={colors.outline} />
                </Pressable>
              )}
            </View>
          )}
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 110 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
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
          ) : filtered.length === 0 ? (
            <Card className="p-8 items-center justify-center">
              <Ionicons name="search" size={28} color={colors.outlineFaint} />
              <Text className="text-[14px] font-semibold text-ink mt-2">
                Walang natagpuang contact
              </Text>
              <Text className="text-[12px] text-ink-faint text-center mt-1">
                Subukan ang ibang keyword para sa "{query}".
              </Text>
            </Card>
          ) : (
            <>
              {primary && <PrimaryEmergencyBar contact={primary} />}

              {restUrgent.length > 0 && (
                <View className="mb-6">
                  <DirectorySectionLabel count={restUrgent.length} dotColor={colors.error}>
                    Emergency
                  </DirectorySectionLabel>
                  <View style={{ gap: 12 }}>
                    {restUrgent.map((c) => (
                      <EmergencyTile key={c.id} contact={c} />
                    ))}
                  </View>
                </View>
              )}

              {routine.length > 0 && (
                <View className="mb-8">
                  <DirectorySectionLabel count={routine.length} dotColor={colors.primary}>
                    Barangay Services
                  </DirectorySectionLabel>
                  {/* Separate, individually-shadowed cards with real gap
                      between them now, not one shared Card with hairlines
                      inside it - see ContactRow's doc comment for why. */}
                  <View style={{ gap: 12 }}>
                    {routine.map((c) => (
                      <ContactRow key={c.id} contact={c} />
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
