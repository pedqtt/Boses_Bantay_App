import { Text } from "@/components/AppText";
import { insertServiceComplaint } from "@/lib/api/serviceComplaintSubmission";
import { loadComplaintDraft, saveComplaintDraft, clearComplaintDraft, type ComplaintDraft } from "@/lib/api/serviceComplaintDraft";
import { ComplaintAttachments } from "@/components/report/ComplaintAttachments";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, Image, ActivityIndicator, Alert, Modal, FlatList, Dimensions, BackHandler, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useNavigation, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/AppIcon";
import * as ImagePicker from "expo-image-picker";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { File, Paths } from "expo-file-system";
import { FormField } from "@/components/report/ReportFormFields";
import { VoiceDescriptionInput, type VoiceDescriptionDraft } from "@/components/report/VoiceDescriptionInput";
import { GuideCard } from "@/components/report/GuideCard";
import { ReportPrimaryLabel } from "@/components/report/ReportPrimaryLabel";
import { reportStyles } from "@/components/report/reportStyles";
import { ServiceComplaintIntro, ServiceComplaintReview } from "@/components/report/ServiceComplaintGuide";
import { COMPLAINT_STEPS, complaintCanAdvance, complaintNext, complaintPrevious, type ComplaintStep } from "@/lib/serviceComplaintFlow";
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// The hero photo's own container is full content width (the screen's own
// px-6 minus the ScrollView's horizontal padding, 24px each side), so a
// fixed height read as an arbitrary rectangle instead of a deliberate
// shape. Deriving the height from that same width makes it a true square,
// scaling correctly across phone sizes instead of a magic-number height
// picked for one screen width.

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
              <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: "70%" }} resizeMode="contain" resizeMethod="resize" />
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

/** Guided complaint flow; form data remains in the controller across steps. */
export default function ServiceComplaintScreen() {
  const { profile } = useAuth();
  const [step, setStep] = useState<ComplaintStep>("intro");
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitLock = useRef(false);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<VoiceDescriptionDraft>({ clips: [] });
  const [voiceBusy, setVoiceBusy] = useState(false);
  const voiceBusyRef = useRef(false);
  const handleVoiceBusy = useCallback((busy: boolean) => { voiceBusyRef.current = busy; setVoiceBusy(busy); }, []);
  const [images, setImages] = useState<string[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const attachmentLock = useRef(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Same tab-bar-hiding treatment as report.tsx and verify-id.tsx - an
  // accidental tab tap mid-form is real friction (lost photo/description),
  // not a minor annoyance, so it's removed as a misclick target entirely
  // while this flow is on screen.
  const navigation = useNavigation();
  const [draftReady, setDraftReady] = useState(false);
  const skipPersistence = useRef(false);
  const completed = useRef(false);
  const pendingPhoto = useRef<{ replaceUri: string | null } | null>(null);
  const snapshot = useRef<ComplaintDraft | null>(null);
  const owner = useRef(profile?.id);
  owner.current = profile?.id;
  snapshot.current = { step, categoryId: category?.value ?? null, location, description, images, voiceDraft, pendingPhoto: pendingPhoto.current };

  function persistDraft(patch: Partial<ComplaintDraft> = {}) {
    if (!profile?.id || !snapshot.current) return Promise.resolve();
    return saveComplaintDraft(profile.id, { ...snapshot.current, pendingPhoto: pendingPhoto.current, ...patch });
  }
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    const userId = profile.id;
    setDraftReady(false);
    void (async () => {
      try {
        const saved = await loadComplaintDraft(userId);
        if (cancelled) return;
        if (saved) {
          setStep(saved.step); setCategory(CATEGORIES.find(c => c.value === saved.categoryId) ?? null);
          setLocation(saved.location); setDescription(saved.description); setImages(saved.images);
          setVoiceDraft(saved.voiceDraft); pendingPhoto.current = saved.pendingPhoto;
          snapshot.current = saved;
        }
        if (saved?.pendingPhoto) {
          const pending = await ImagePicker.getPendingResultAsync();
          if (cancelled) return;
          if (pending && "code" in pending) throw new Error(pending.message);
          if (pending && !pending.canceled) {
            const uris = await copyPhotos(pending.assets.map(asset => asset.uri));
            if (cancelled) return;
            const photos = mergePickedPhotos(saved.images, uris, saved.pendingPhoto.replaceUri);
            setImages(photos); setStep("photos");
            pendingPhoto.current = null;
            await saveComplaintDraft(userId, { ...saved, images: photos, step: "photos", pendingPhoto: null });
          } else {
            pendingPhoto.current = null;
            await saveComplaintDraft(userId, { ...saved, pendingPhoto: null });
          }
        }
      } catch {
        if (!cancelled) Alert.alert("Hindi naibalik ang larawan", "Nananatili ang inyong report. Subukan pong kunan o piliin muli ang larawan.");
      } finally { if (!cancelled) setDraftReady(true); }
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);
  useEffect(() => {
    if (!draftReady || submitted || skipPersistence.current || attachmentLock.current || !profile?.id) return;
    if (!category && !location.trim() && !description.trim() && !images.length) return;
    const timer = setTimeout(() => { if (!skipPersistence.current) void persistDraft().catch(() => {}); }, 400);
    return () => clearTimeout(timer);
  }, [draftReady, step, category, location, description, images, voiceDraft, submitted, profile?.id]);


  function resetForm() {
    pendingPhoto.current = null;
    setStep("intro"); setEditingFromReview(false); setSubmitError(""); submitLock.current = false;
    setCategory(null);
    setLocation("");
    setDescription("");
    setVoiceDraft({ clips: [] }); handleVoiceBusy(false);
    setImages([]); setAttachmentBusy(false); attachmentLock.current = false;
    setSubmitting(false);
    setReferenceNo("");
    setSubmitted(false);
  }

  // Keep step data while navigating within this screen; clear it after leaving.
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      if (completed.current) { completed.current = false; resetForm(); }
      return () => {
        navigation.setOptions({ tabBarStyle: undefined });
        // Camera launches and temporary blur must never discard the form.
      };
    }, [navigation])
  );

  function goTo(next: ComplaintStep) {
    skipPersistence.current = false;
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function goBack() {
    if (submitLock.current || voiceBusyRef.current || attachmentLock.current) return;
    if (editingFromReview) { setEditingFromReview(false); goTo("review"); return; }
    if (step !== "intro") { goTo(complaintPrevious(step)); return; }
    if (category || location.trim() || description.trim() || images.length) {
      Alert.alert("Lumabas sa report?", "Hindi mase-save ang hindi pa naipapasang report.", [
        { text: "Ipagpatuloy", style: "cancel" },
        { text: "Lumabas", style: "destructive", onPress: () => {
          skipPersistence.current = true;
          if (profile?.id) void clearComplaintDraft(profile.id).then(() => { resetForm(); router.back(); }).catch(() => { skipPersistence.current = false; Alert.alert("Hindi mabura ang draft", "Pakisubukan muli."); });
        } },
      ]);
    } else router.back();
  }
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (submitted || profile?.barangayIdStatus !== "pb_authorized") return false;
      goBack(); return true;
    });
    return () => listener.remove();
  }, [step, editingFromReview, category, location, description, images.length, submitted, profile?.barangayIdStatus]));

  const slotsLeft = MAX_PHOTOS - images.length;

  function removeImage(uri: string) {
    setImages((prev) => prev.filter((u) => u !== uri));
    setViewerIndex(index => images.length <= 1 ? null : index === null ? null : Math.min(index, images.length - 2));
  }

  function mergePickedPhotos(previous: string[], uris: string[], replaceUri: string | null): string[] {
    if (replaceUri && uris.length) return previous.map(uri => uri === replaceUri ? uris[0] : uri);
    return [...new Set([...previous, ...uris])].slice(0, MAX_PHOTOS);
  }
  async function copyPhotos(uris: string[]): Promise<string[]> {
    const copies: string[] = [];
    for (const uri of uris.slice(0, MAX_PHOTOS)) {
      const source = new File(uri);
      const extension = source.extension || ".jpg";
      const destination = new File(Paths.document, `complaint-photo-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
      await source.copy(destination);
      if (!destination.exists || !destination.size) throw new Error("Photo copy failed");
      copies.push(destination.uri);
    }
    return copies;
  }
  async function selectPhotos(camera: boolean, replaceUri: string | null = null) {
    if (attachmentLock.current || !draftReady || !profile?.id) return;
    const userId = profile.id;
    attachmentLock.current = true; setAttachmentBusy(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { Alert.alert("Kailangan ang camera", "Payagan ang camera sa Settings, o pumili sa gallery."); return; }
      }
      pendingPhoto.current = { replaceUri };
      // Complete the durable checkpoint BEFORE Android opens another Activity.
      await persistDraft();
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"], quality: 0.5, base64: false, exif: false, allowsEditing: false,
        allowsMultipleSelection: !camera && !replaceUri, selectionLimit: replaceUri ? 1 : Math.max(slotsLeft, 1),
      };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (owner.current !== userId) return;
      if (!result.canceled) {
        const uris = await copyPhotos(result.assets.map(asset => asset.uri));
        if (owner.current !== userId) return;
        const next = mergePickedPhotos(snapshot.current?.images ?? images, uris, replaceUri);
        setImages(next);
        pendingPhoto.current = null;
        await persistDraft({ images: next, pendingPhoto: null });
      } else { pendingPhoto.current = null; await persistDraft({ pendingPhoto: null }); }
    } catch {
      pendingPhoto.current = null;
      try { await persistDraft({ pendingPhoto: null }); } catch { /* Keep the in-memory form for retry. */ }
      Alert.alert("Hindi maidagdag ang larawan", "Nananatili ang inyong report. Subukan pong muli o piliin ang larawan sa gallery.");
    } finally {
      if (owner.current === userId) { attachmentLock.current = false; setAttachmentBusy(false); }
    }
  }
  function handleAddPhoto(replaceUri: string | null = null) {
    Alert.alert(replaceUri ? "Palitan ang larawan" : "Magdagdag ng larawan", undefined, [
      { text: "Kumuha ng larawan", onPress: () => { void selectPhotos(true, replaceUri); } },
      { text: "Piliin sa gallery", onPress: () => { void selectPhotos(false, replaceUri); } },
      { text: "Kanselahin", style: "cancel" },
    ]);
  }

  const formFields = { category: category?.value ?? null, location, description };
  const canSubmit = complaintCanAdvance("review", formFields);
  const canAdvance = draftReady && complaintCanAdvance(step, formFields) && !voiceBusy && !attachmentBusy;
  function advance() {
    if (!canAdvance || submitLock.current || voiceBusyRef.current || attachmentLock.current) return;
    if (step === "review") { void handleSubmit(); return; }
    if (editingFromReview) { setEditingFromReview(false); goTo("review"); return; }
    goTo(complaintNext(step));
  }

  async function handleSubmit() {
    if (!canSubmit || !category || submitLock.current || voiceBusyRef.current || attachmentLock.current) return;
    submitLock.current = true; setSubmitting(true); setSubmitError("");
    const refNo = `BGY-${Math.floor(100000 + Math.random() * 900000)}`;
    const photoPaths: string[] = [];
    const uploadedPaths: string[] = [];
    let committed = false;
    let databaseAttempted = false;
    try {
      if (!isSupabaseConfigured || !supabase) throw new Error("Hindi pa naka-configure ang report service. Pakikontak ang admin.");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Mag-sign in po muli bago ipasa ang report.");
      for (let i = 0; i < images.length; i++) {
        const file = new File(images[i]);
        if (!file.exists || !file.size) throw new Error("Hindi makita ang larawan. Alisin at idagdag po itong muli.");
        if (file.size > 10 * 1024 * 1024) throw new Error("Hanggang 10 MB bawat larawan. Pumili po ng mas maliit na larawan.");
        const mime = file.type || "image/jpeg";
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/heic" ? "heic" : "jpeg";
        const filePath = `${user.id}/${Date.now()}-${i}.${ext}`;
        const { error } = await supabase.storage.from("report_evidence").upload(filePath, await file.arrayBuffer(), { contentType: mime });
        if (error) {
          console.warn("[service-complaint] photo upload rejected", { message: error.message });
          throw new Error("Hindi ma-upload ang larawan. Pakisubukan muli; kung paulit-ulit, ipasuri sa admin ang photo storage settings.");
        }
        photoPaths.push(filePath); uploadedPaths.push(filePath);
      }
      databaseAttempted = true;
      const receipt = await insertServiceComplaint(supabase, {
        referenceNo: refNo, userId: user.id, category, location, description, photoPaths,
      });
      committed = true;
      skipPersistence.current = true; completed.current = true;
      if (profile?.id) { try { await clearComplaintDraft(profile.id); } catch { /* The report has already been saved successfully. */ } }
      setReferenceNo(receipt.referenceNo); setSubmitted(true);
    } catch (err: unknown) {
      console.warn("[service-complaint] submission failed", err);
      setSubmitError(err instanceof Error ? err.message : "Hindi naipasa ang report. Pakisubukan muli.");
      if (!committed && !databaseAttempted && uploadedPaths.length && supabase) {
        try { await supabase.storage.from("report_evidence").remove(uploadedPaths); } catch { /* Best-effort cleanup. */ }
      }
    } finally {
      submitLock.current = false; setSubmitting(false);
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
        kind="serviceComplaint"
        referenceNo={referenceNo}
        onViewReports={() => router.replace("/(resident)/reports")}
        onGoHome={() => router.replace("/(resident)/home")}
      />
    );
  }

  const position = COMPLAINT_STEPS.indexOf(step);
  const headings: Record<ComplaintStep, [string, string]> = {
    intro: ["Serbisyo / Kagamitan", ""],
    category: ["Anong uri ng problema?", "Piliin ang pinaka-akma sa inyong concern."],
    details: ["Saan at ano ang problema?", "Ibigay ang lokasyon at maikling paglalarawan."],
    photos: ["Magdagdag ng mga larawan.", "Ipakita ang problema nang mas malinaw. Opsyonal ang mga attachment."],
    review: ["Suriin ang inyong report.", "Itama ang anumang mali bago ipasa."],
  };
  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom"]} style={{ backgroundColor: "#FFFFFF" }}>
      <ScreenBackground backgroundColor={colors.residentBackground}>
        <BahagiHeader label={step === "review" ? "Suriin ang report" : "Serbisyo / Kagamitan"}
          stepText={position ? `Bahagi ${position} ng 4` : undefined}
          filledSegments={position} totalSegments={4} onBack={goBack} backDisabled={submitting || voiceBusy || attachmentBusy} />
        <KeyboardAwareScrollView ref={scrollRef} bottomOffset={24} className="flex-1 px-6"
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}>
          {step !== "intro" && <View className="mb-6">
            <Text className="text-[27px] leading-9 font-semibold text-ink mb-2">{headings[step][0]}</Text>
            <Text className={REPORT_TYPE.subtitle}>{headings[step][1]}</Text>
          </View>}
          {step === "intro" && <ServiceComplaintIntro />}
          {step === "category" && (
            <View>
              <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                {CATEGORIES.map((c) => {
                  const active = category?.value === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => setCategory(c)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      className="items-center active:opacity-80"
                      style={{
                        width: "48%",
                        paddingVertical: 14,
                        paddingHorizontal: 6,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: active ? colors.primary : colors.outlineVariant,
                        backgroundColor: active ? colors.residentTint : "white",
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
                        className="text-[14px] font-medium text-center"
                        style={{ color: active ? colors.primary : colors.onSurface, lineHeight: 20 }}
                        numberOfLines={2}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          {step === "details" && <View>
            <View className="mb-5"><GuideCard><Text className={REPORT_TYPE.hint}>Isama ang kalye, purok, o malapit na palatandaan. Ilarawan kung ano ang sira o problemang napansin ninyo.</Text></GuideCard></View>
            <FormField label="Lokasyon" value={location} onChangeText={setLocation}
              placeholder="Hal. tapat ng Blk 3 Lot 12, Purok 5" />
            <Text className={`${REPORT_TYPE.fieldLabel} mb-3`}>Paglalarawan ng problema</Text>
            <Text className={`${REPORT_TYPE.helper} mb-4`}>Maaaring mag-record o mag-type. Maaari ring baguhin ang transcript bago magpatuloy.</Text>
            <VoiceDescriptionInput value={description} onChangeText={setDescription}
              draft={voiceDraft} onDraftChange={setVoiceDraft} onBusyChange={handleVoiceBusy} />
          </View>}
          {step === "photos" && <ComplaintAttachments images={images} busy={attachmentBusy}
            onCamera={() => { void selectPhotos(true); }} onGallery={() => { void selectPhotos(false); }} onPhoto={setViewerIndex}
            onRemovePhoto={removeImage} />}
          {step === "review" && <ServiceComplaintReview category={category?.label ?? ""}
            location={location.trim()} description={description.trim()} images={images}
            onEdit={next => { if (!submitting) { setEditingFromReview(true); goTo(next); } }}
            onPhoto={setViewerIndex} />}
        </KeyboardAwareScrollView>
        <View style={reportStyles.actionBar}>
          {submitError && step === "review" ? <Text accessibilityRole="alert" className="text-alert text-[13px] leading-5 mb-3">{submitError}</Text> : null}
          {!canAdvance && !voiceBusy && !attachmentBusy && <Text className={`${REPORT_TYPE.helper} text-center mb-3`}>{step === "category" ? "Pumili po muna ng uri ng problema." : "Kumpletuhin po ang lokasyon at paglalarawan."}</Text>}
          <Pressable onPress={advance} disabled={!canAdvance || submitting} accessibilityRole="button"
            accessibilityState={{ disabled: !canAdvance || submitting, busy: submitting }}
            style={[reportStyles.primaryAction, { backgroundColor: canAdvance ? colors.primary : colors.outlineVariant }]}
            className="items-center active:opacity-85">
            {submitting ? <ActivityIndicator color="white" /> : <ReportPrimaryLabel icon={step === "review" ? "paper-plane-outline" : "arrow-forward"}>
              {step === "review" ? "Ipasa ang report" : editingFromReview ? "Bumalik sa review" : step === "intro" ? "Simulan" : step === "photos" && !images.length ? "Laktawan at suriin" : step === "photos" ? "Suriin ang report" : "Susunod"}
            </ReportPrimaryLabel>}
          </Pressable>
        </View>
      </ScreenBackground>
      <PhotoViewer key={`${viewerIndex ?? "closed"}-${images.length}`} visible={viewerIndex !== null}
        images={images} startIndex={viewerIndex ?? 0} onClose={() => setViewerIndex(null)}
        onRemove={removeImage} onReplace={uri => handleAddPhoto(uri)} />
    </SafeAreaView>
  );
}
