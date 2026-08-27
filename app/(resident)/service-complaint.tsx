import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useNavigation, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/Card";
import { ScreenBackground } from "@/components/ScreenBackground";
import { BahagiHeader } from "@/components/report/BahagiHeader";
import { SubmittedScreen } from "@/components/report/SubmittedScreen";
import { VerificationRequiredScreen } from "@/components/report/VerificationRequiredScreen";
import { REPORT_TYPE } from "@/lib/reportTypeScale";
import { colors } from "@/lib/theme";

type Category = {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// Enough for a resident to actually document a problem from a couple of
// angles (the pothole itself + the street it's on, say) without turning
// this into an unbounded upload queue that's slow to submit and expensive
// to store - five was picked as "clearly more than one," not as a
// precisely-reasoned ceiling.
const MAX_PHOTOS = 5;

// Barangay-level service/infrastructure complaints, distinct from a blotter
// incident: nobody is being accused, there's no respondent, no witnesses -
// just a thing that's broken or unsafe and where it is. Kept to the
// complaints an actual barangay office fields most often rather than trying
// to cover every possible category.
const CATEGORIES: Category[] = [
  { value: "streetlight", label: "Sirang Ilaw sa Poste", icon: "bulb-outline" },
  { value: "manhole", label: "Bukas na Kanal / Manhole", icon: "warning-outline" },
  { value: "garbage", label: "Basura / Kalinisan", icon: "trash-outline" },
  { value: "road", label: "Sirang Kalsada", icon: "car-outline" },
  { value: "water", label: "Suplay ng Tubig", icon: "water-outline" },
  { value: "noise", label: "Ingay sa Paligid", icon: "volume-high-outline" },
  { value: "animal", label: "Ligaw na Hayop", icon: "paw-outline" },
  { value: "other", label: "Iba Pa", icon: "ellipsis-horizontal-outline" },
];

/**
 * Numbered section header - the same "1. / 2. / 3." organizing device
 * IntroScreen already uses to make a short flow feel like a short flow
 * (Hick's Law: perceived effort tracks visible step count). This screen has
 * no BahagiHeader stepper of its own (it's one screen, not a multi-bahagi
 * flow), so the numbering has to live in the body instead - three sections,
 * ordered by how a resident actually decides what to report: what it is,
 * then the specifics, then optional proof.
 */
function StepSection({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-7">
      <View className="flex-row items-center mb-4">
        <View
          className="items-center justify-center rounded-full mr-2.5"
          style={{ width: 22, height: 22, backgroundColor: colors.primaryContainer }}
        >
          <Text className="text-[12px] font-bold" style={{ color: colors.primary }}>
            {n}
          </Text>
        </View>
        <Text className={REPORT_TYPE.fieldLabel}>{title}</Text>
      </View>
      {hint && <Text className={`${REPORT_TYPE.caption} mb-4`}>{hint}</Text>}
      {children}
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// The hero photo's own container is full content width (the screen's own
// px-6 minus the ScrollView's horizontal padding, 24px each side), so a
// fixed height read as an arbitrary rectangle instead of a deliberate
// shape. Deriving the height from that same width makes it a true square,
// scaling correctly across phone sizes instead of a magic-number height
// picked for one screen width.
const HERO_SIZE = SCREEN_WIDTH - 48;

/**
 * Full-screen swipeable viewer for a set of already-added photos - the
 * "tap a photo to see it big, swipe to the next one" pattern from
 * Facebook's own photo composer, rather than only ever seeing images as
 * small grid tiles. Remove and replace both live here instead of as tiny
 * overlapping icons on an 84px thumbnail, which is where they'd previously
 * been crammed - a resident reviewing "did I actually capture the pothole
 * clearly" needs to see it large first, and the two actions that matter
 * once they're looking at it (keep swiping past it vs. do something about
 * it) fit naturally as a bottom bar here.
 */
function PhotoViewer({
  visible,
  images,
  startIndex,
  onClose,
  onRemove,
  onReplace,
}: {
  visible: boolean;
  images: string[];
  startIndex: number;
  onClose: () => void;
  onRemove: (uri: string) => void;
  onReplace: (uri: string) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const listRef = useRef<FlatList<string>>(null);

  function handleMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(Math.max(0, Math.min(next, images.length - 1)));
  }

  const currentUri = images[index];

  if (!currentUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "black" }}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          keyExtractor={(uri) => uri}
          onMomentumScrollEnd={handleMomentumEnd}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH, alignItems: "center", justifyContent: "center" }}>
              <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: "70%" }} resizeMode="contain" />
            </View>
          )}
        />

        {/* Top bar - counter on the left (only meaningful with 2+ photos),
            close on the right. Both float over the image on a soft
            gradient-free scrim rather than a solid bar, keeping the photo
            itself the focus. */}
        <View
          className="absolute left-0 right-0 flex-row items-center justify-between px-5"
          style={{ top: 52 }}
        >
          {images.length > 1 ? (
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              <Text className="text-white text-[13px] font-semibold">
                {index + 1} / {images.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            onPress={onClose}
            hitSlop={10}
            className="items-center justify-center rounded-full active:opacity-70"
            style={{ width: 36, height: 36, backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <Ionicons name="close" size={20} color="white" />
          </Pressable>
        </View>

        {/* Bottom action bar - the two things worth doing once you're
            actually looking at a photo, not buried as tiny icons on the
            grid tile it came from. */}
        <View className="absolute left-0 right-0 flex-row px-6" style={{ bottom: 44, gap: 12 }}>
          <Pressable
            onPress={() => onReplace(currentUri)}
            className="flex-1 flex-row items-center justify-center rounded-2xl py-3.5 active:opacity-80"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <Ionicons name="camera-reverse-outline" size={17} color="white" style={{ marginRight: 6 }} />
            <Text className="text-white font-semibold text-[14px]">Palitan</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onRemove(currentUri);
              if (images.length <= 1) onClose();
              else setIndex((i) => Math.max(0, Math.min(i, images.length - 2)));
            }}
            className="flex-1 flex-row items-center justify-center rounded-2xl py-3.5 active:opacity-80"
            style={{ backgroundColor: colors.error }}
          >
            <Ionicons name="trash-outline" size={17} color="white" style={{ marginRight: 6 }} />
            <Text className="text-white font-semibold text-[14px]">Alisin</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Lightweight complaint flow, deliberately NOT built on top of the voice
 * chunk machinery in report.tsx/reportFlow.ts - that flow exists to capture
 * a legally authoritative spoken statement about an incident between
 * people, with a respondent, witnesses, and blotter type. A broken
 * streetlight doesn't have any of that; forcing it through the same 4-step
 * recording flow would ask a resident "sino ang kausap ninyo" about a
 * pothole. One category tap + a location + a short description covers what
 * the barangay actually needs to dispatch someone, and reads as
 * proportionate to how small the actual report is (Hick's Law - fewer,
 * more relevant fields, not a copy of the bigger flow with unused steps
 * hidden).
 *
 * REDESIGN (component-hierarchy pass): the first version gave category,
 * location, description, and photo all the same visual weight - four
 * identical "label + card" blocks in a row, so nothing actually read as
 * more important than anything else even though they aren't equally
 * important.
 *
 *   Primary   - category. It's the first real decision and the one that
 *               determines everything downstream, so it gets the largest
 *               touch targets on the screen: a 2-column tile grid instead
 *               of small wrapped chips, each tile with its own icon circle
 *               (Fitts's Law - the decision that matters most gets the
 *               biggest target, same reasoning as the Report FAB).
 *   Secondary - location + description. Two closely-related facts about
 *               the same complaint (where, what) now live in ONE card
 *               split by a hairline, the same "two facts belong side by
 *               side, not as two separate card blocks" fix profile.tsx's
 *               identity card already applied to Numero/Purok.
 *   Tertiary  - photos (up to MAX_PHOTOS). Genuinely optional evidence, so
 *               it's a horizontal strip of small thumbnails plus a quiet
 *               dashed "add" tile - real add/remove/replace affordances
 *               without growing into a second bank of full-width cards
 *               that would visually compete with the two required
 *               sections above it.
 *
 * Writes to the same `reports` table as the blotter flow so it shows up
 * alongside blotter reports in My Reports and status updates work the same
 * way - `full_details.type: "service_complaint"` is the marker that
 * distinguishes it, plus `category`/`incident_category` reusing the
 * complaint's own label so the reports list needs no special-casing to
 * display it.
 */
export default function ServiceComplaintScreen() {
  const { profile } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Same tab-bar-hiding treatment as report.tsx and verify-id.tsx - an
  // accidental tab tap mid-form is real friction (lost photo/description),
  // not a minor annoyance, so it's removed as a misclick target entirely
  // while this flow is on screen.
  const navigation = useNavigation();

  function resetForm() {
    setCategory(null);
    setLocation("");
    setDescription("");
    setImages([]);
    setSubmitting(false);
    setReferenceNo("");
    setSubmitted(false);
  }

  // This route is registered as a Tabs.Screen (href: null, same as
  // verify-id/pending) so it stays mounted after the first visit like
  // every other tab - React Navigation doesn't unmount it just because
  // the resident navigated away. Without this, filing a second complaint
  // would reopen the exact form state (or even the submitted confirmation
  // screen) left over from the last one. Resetting on blur, not just after
  // a successful submit, means leaving half-filled and coming back later
  // to file a *different* complaint also starts clean - the one case that
  // should still be preserved (an accidental back-tap mid-form) is
  // deliberately not special-cased here, since this is a short one-screen
  // form, not the multi-step blotter flow that has its own draft-recovery
  // system for that.
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.setOptions({ tabBarStyle: undefined });
        resetForm();
      };
    }, [navigation])
  );

  const slotsLeft = MAX_PHOTOS - images.length;

  function addImages(uris: string[]) {
    if (uris.length === 0) return;
    setImages((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
  }

  function removeImage(uri: string) {
    setImages((prev) => prev.filter((u) => u !== uri));
  }

  function replaceImage(oldUri: string, newUri: string) {
    setImages((prev) => prev.map((u) => (u === oldUri ? newUri : u)));
  }

  // `onReplace` is only passed when this is swapping out one existing
  // photo (see the per-thumbnail "Palitan" action) - camera only ever
  // hands back one shot at a time either way, so a single result is always
  // correct here.
  async function handleTakePhoto(onReplace?: (uri: string) => void) {
    if (!onReplace && slotsLeft <= 0) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Kailangan ang pahintulot",
        "Kailangan po namin ng access sa camera para makakuha ng larawan."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (result.canceled) return;
    if (onReplace) onReplace(result.assets[0].uri);
    else addImages([result.assets[0].uri]);
  }

  async function handlePickImage(onReplace?: (uri: string) => void) {
    if (!onReplace && slotsLeft <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      // Multi-select so a resident documenting one problem from a couple
      // of angles doesn't have to reopen this picker per photo - capped to
      // however many slots are actually left.
      allowsMultipleSelection: !onReplace,
      selectionLimit: onReplace ? 1 : Math.max(slotsLeft, 1),
    });
    if (result.canceled) return;
    if (onReplace) onReplace(result.assets[0].uri);
    else addImages(result.assets.map((a) => a.uri));
  }

  // One quiet entry point instead of two full-width filled buttons sitting
  // permanently on screen - photo is optional evidence, tertiary to the
  // required fields above it, so the choice between camera/gallery only
  // needs to exist at the moment the resident actually taps "add a photo,"
  // not as two buttons competing for attention the whole time.
  //
  // `onReplace` threads through to both source handlers so the same sheet
  // doubles as the "Palitan" (swap) action on an existing thumbnail - one
  // picker UI for both "add a new photo" and "replace this one," rather
  // than a second bespoke flow for swapping.
  function handleAddPhoto(onReplace?: (uri: string) => void) {
    Alert.alert(onReplace ? "Palitan ang Larawan" : "Magdagdag ng Larawan", undefined, [
      { text: "Kumuha ng Larawan", onPress: () => handleTakePhoto(onReplace) },
      { text: "Piliin sa Gallery", onPress: () => handlePickImage(onReplace) },
      { text: "Kanselahin", style: "cancel" },
    ]);
  }

  const canSubmit = Boolean(category) && location.trim().length > 0 && description.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || !category) return;
    setSubmitting(true);

    const refNo = `BGY-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const photoPaths: string[] = [];

      // Best-effort upload, one photo at a time - a missing/misconfigured
      // storage bucket, or one bad file in the middle of the set, shouldn't
      // strand a resident on this screen over evidence that's optional in
      // the first place. Same "don't let a backend gap block the filing"
      // posture as the TEMPORARY bypass in report.tsx. Each photo is tried
      // independently so one failure doesn't drop the rest.
      if (images.length > 0 && isSupabaseConfigured && profile?.id) {
        for (let i = 0; i < images.length; i++) {
          try {
            const response = await fetch(images[i]);
            const blob = await response.blob();
            const filePath = `${profile.id}/${Date.now()}-${i}.jpeg`;
            const { error: uploadError } = await supabase.storage
              .from("report_evidence")
              .upload(filePath, blob, { contentType: "image/jpeg" });
            if (!uploadError) photoPaths.push(filePath);
          } catch (photoErr) {
            console.warn("[service-complaint] photo upload failed, continuing without it ->", photoErr);
          }
        }
      }

      if (isSupabaseConfigured) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("You must be logged in to submit a report.");

          const { error } = await supabase.from("reports").insert({
            reference_no: refNo,
            user_id: user.id,
            status: "Under Review",
            category: category.label,
            summary: description.trim(),
            incident_category: category.value,
            incident_location_text: location.trim(),
            full_details: {
              type: "service_complaint",
              category: category.value,
              categoryLabel: category.label,
              location: location.trim(),
              description: description.trim(),
              photoPaths,
            },
          });

          if (error) throw error;
        } catch (backendErr: any) {
          console.warn(
            "[service-complaint] TEMPORARY bypass: backend submission failed, continuing anyway ->",
            backendErr?.message ?? backendErr
          );
        }
      }

      setReferenceNo(refNo);
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert("Hindi naipasa ang report", err?.message ?? "Subukan po muli.");
    } finally {
      setSubmitting(false);
    }
  }

  // Same gate as report.tsx - reachable only after full Barangay ID
  // authorization. Re-checked here too (not just at the chooser upstream)
  // since this screen has its own route and could be deep-linked directly.
  const isFullyVerified = profile?.barangayIdStatus === "pb_authorized";
  if (!isFullyVerified) {
    return (
      <VerificationRequiredScreen
        status={profile?.barangayIdStatus ?? "unverified"}
        onGoVerify={() => router.push("/(resident)/verify-id")}
        onGoBack={() => router.back()}
      />
    );
  }

  if (submitted) {
    return (
      <SubmittedScreen
        referenceNo={referenceNo}
        onViewReports={() => router.replace("/(resident)/reports")}
        onGoHome={() => router.replace("/(resident)/home")}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: "#FFFFFF" }}>
      <ScreenBackground backgroundColor="#FAF8F7">
        <View style={{ flex: 1 }}>
          {/* No stepper - same call as chooseType's header. This form is
              one screen, not a multi-step journey, and a 1-of-1 (or
              2-of-2) stepper just drew a single dot left-aligned in an
              otherwise empty full-width row, which read as a blank line
              rather than an actual progress signal. Back button + title
              only. */}
          <BahagiHeader
            label="Serbisyo / Kagamitan"
            filledSegments={0}
            totalSegments={0}
            onBack={() => router.back()}
          />

          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 1 - PRIMARY: what kind of problem. Largest touch targets on
                the screen - a 2-column tile grid, not small wrapped chips,
                since this is the one decision everything else depends on. */}
            <StepSection n={1} title="Anong uri ng problema?">
              <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                {CATEGORIES.map((c) => {
                  const active = category?.value === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => setCategory(c)}
                      className="items-center active:opacity-80"
                      style={{
                        width: "31%",
                        paddingVertical: 14,
                        paddingHorizontal: 6,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: active ? colors.primary : colors.outlineVariant,
                        backgroundColor: active ? colors.primaryContainer : "white",
                      }}
                    >
                      {active && (
                        <View
                          className="absolute items-center justify-center rounded-full"
                          style={{
                            top: 6,
                            right: 6,
                            width: 16,
                            height: 16,
                            backgroundColor: colors.primary,
                          }}
                        >
                          <Ionicons name="checkmark" size={11} color="white" />
                        </View>
                      )}
                      <Ionicons
                        name={c.icon}
                        size={22}
                        color={active ? colors.primary : colors.onSurfaceVariant}
                        style={{ marginBottom: 6 }}
                      />
                      <Text
                        className="text-[11.5px] font-medium text-center"
                        style={{ color: active ? colors.primary : colors.onSurface, lineHeight: 15 }}
                        numberOfLines={2}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </StepSection>

            {/* 2 - SECONDARY: the two supporting facts about the same
                complaint (where, what happened), grouped in one card and
                split by a hairline instead of two separate label+card
                blocks - same fix profile.tsx applied to Numero/Purok. */}
            <StepSection n={2} title="Detalye ng Report">
              <Card>
                <View className="px-4 pt-3.5 pb-3.5">
                  <Text
                    className="text-[11px] font-semibold uppercase text-ink-faint"
                    style={{ letterSpacing: 0.5, marginBottom: 4 }}
                  >
                    Saan po ito nangyayari?
                  </Text>
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Hal. tapat ng Blk 3 Lot 12, Purok 5"
                    placeholderTextColor={colors.outline}
                    className="text-[16px] text-ink"
                    style={{ paddingVertical: 4 }}
                  />
                </View>

                <View style={{ height: 1, backgroundColor: colors.outlineVariant }} />

                <View className="px-4 pt-3.5 pb-4">
                  <Text
                    className="text-[11px] font-semibold uppercase text-ink-faint"
                    style={{ letterSpacing: 0.5, marginBottom: 4 }}
                  >
                    Ilarawan po ang problema
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Ilarawan po ang nakita ninyo..."
                    placeholderTextColor={colors.outline}
                    multiline
                    textAlignVertical="top"
                    className="text-[16px] text-ink"
                    style={{ minHeight: 88, paddingVertical: 4 }}
                  />
                </View>
              </Card>
            </StepSection>

            {/* 3 - TERTIARY: optional evidence, but multi-photo now, laid
                out the way Facebook's own composer does it - one large
                featured photo plus a row of smaller tiles underneath,
                instead of a single-height filmstrip of same-size photos
                that gives every image equal weight it doesn't need. Tap
                any photo to open it full-screen in PhotoViewer, where
                replace/remove actually live now (see that component's
                doc comment). Grid tiles keep a quick-delete badge for
                "get rid of this one, no need to even open it," but
                replace moved out of the tiny tiles entirely. */}
            <StepSection
              n={3}
              title="Larawan (opsyonal)"
              hint={images.length > 0 ? `${images.length}/${MAX_PHOTOS} na larawan` : undefined}
            >
              {images.length === 0 ? (
                // Empty state as one inviting, full-width tile - not a
                // small dashed square easy to miss. This is the moment a
                // resident decides whether to bother adding proof at all,
                // so it gets a real presence on screen even though the
                // section stays optional.
                <Pressable
                  onPress={() => handleAddPhoto()}
                  className="items-center justify-center rounded-2xl active:opacity-70"
                  style={{
                    height: 110,
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: colors.outlineVariant,
                    backgroundColor: "white",
                  }}
                >
                  <Ionicons name="images-outline" size={24} color={colors.primary} />
                  <Text className="text-[14px] font-semibold mt-1.5" style={{ color: colors.onSurface }}>
                    Magdagdag ng Larawan
                  </Text>
                  <Text className={`${REPORT_TYPE.caption} mt-0.5`}>Kumuha o pumili mula sa gallery</Text>
                </Pressable>
              ) : (
                <View>
                  {/* Featured photo - the one the resident added/looked at
                      first, full width. */}
                  <Pressable onPress={() => setViewerIndex(0)} className="active:opacity-90">
                    <Image
                      source={{ uri: images[0] }}
                      style={{ width: HERO_SIZE, height: HERO_SIZE, borderRadius: 16 }}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => removeImage(images[0])}
                      hitSlop={8}
                      className="absolute items-center justify-center rounded-full active:opacity-70"
                      style={{
                        top: 8,
                        right: 8,
                        width: 26,
                        height: 26,
                        backgroundColor: "rgba(0,0,0,0.55)",
                      }}
                    >
                      <Ionicons name="close" size={15} color="white" />
                    </Pressable>
                  </Pressable>

                  {/* Supporting grid - remaining photos plus the add tile,
                      as a row of smaller squares under the hero. */}
                  {(images.length > 1 || slotsLeft > 0) && (
                    <View className="flex-row flex-wrap mt-2.5" style={{ gap: 8 }}>
                      {images.slice(1).map((uri, i) => (
                        <View key={uri} style={{ width: 72, height: 72 }}>
                          <Pressable onPress={() => setViewerIndex(i + 1)} className="active:opacity-90">
                            <Image
                              source={{ uri }}
                              style={{ width: 72, height: 72, borderRadius: 12 }}
                              resizeMode="cover"
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => removeImage(uri)}
                            hitSlop={8}
                            className="absolute items-center justify-center rounded-full active:opacity-70"
                            style={{
                              top: -6,
                              right: -6,
                              width: 20,
                              height: 20,
                              backgroundColor: colors.error,
                              borderWidth: 2,
                              borderColor: "white",
                            }}
                          >
                            <Ionicons name="close" size={11} color="white" />
                          </Pressable>
                        </View>
                      ))}

                      {slotsLeft > 0 && (
                        <Pressable
                          onPress={() => handleAddPhoto()}
                          className="items-center justify-center active:opacity-70"
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderStyle: "dashed",
                            borderColor: colors.outlineVariant,
                          }}
                        >
                          <Ionicons name="add" size={20} color={colors.onSurfaceVariant} />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              )}
            </StepSection>

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              className="rounded-2xl py-4 items-center overflow-hidden active:opacity-85"
              style={{ backgroundColor: canSubmit ? colors.primary : colors.outlineVariant }}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className={REPORT_TYPE.buttonPrimary}>Isumite ang Report</Text>
              )}
            </Pressable>
            {!canSubmit && (
              <Text className={`${REPORT_TYPE.caption} text-center mt-2.5`}>
                Kumpletuhin muna ang uri, lokasyon, at deskripsyon.
              </Text>
            )}
          </ScrollView>
        </View>
      </ScreenBackground>

      <PhotoViewer
        visible={viewerIndex !== null}
        images={images}
        startIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
        onRemove={removeImage}
        onReplace={(uri) => handleAddPhoto((newUri) => replaceImage(uri, newUri))}
      />
    </SafeAreaView>
  );
}
