import { useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export interface ChatMessage {
  id: string;
  from: "user" | "bot";
  text: string;
}

// Quick prompts
const QUICK_PROMPTS = [
  "Pano mag register sa liga?",
  "Magkano magparehistro ng alagang aso?",
  "Kailan ang inspeksyon sa Tapat Ko, Linis Ko?",
  "Libre ba ang bakuna laban sa rabies?",
];

function isGreeting(text: string): boolean {
  const t = text.toLowerCase().trim();
  const greetings = [
    "hi",
    "hello",
    "kumusta",
    "kamusta",
    "magandang araw",
    "magandang umaga",
    "magandang hapon",
    "magandang gabi",
    "good morning",
    "good afternoon",
    "good evening",
    "hey",
    "yo",
  ];
  return greetings.some((g) => t === g || t.startsWith(`${g} `) || t.endsWith(` ${g}`));
}

function isEnglishQuery(text: string): boolean {
  const t = text.toLowerCase().trim();
  const englishSignals = [
    "how much", "what is", "what are", "where is", "when is", "can i", "how to",
    "is there", "penalty for", "cost of", "fee for", "schedule of", "rules for"
  ];
  if (englishSignals.some((s) => t.includes(s))) return true;

  const tagalogSignals = [
    "ano", "ang", "mga", "magkano", "paano", "kailan", "saan", "bakit", "po",
    "ba", "aso", "pusa", "alaga", "bakuna", "rehistro", "bayad", "multa",
    "libre", "libreng", "paliga", "purok", "kuha", "kumuha", "meron"
  ];
  const words = t.replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  const tagalogCount = words.filter((w) => tagalogSignals.includes(w)).length;
  if (tagalogCount >= 1) return false;

  const englishWords = ["what", "where", "when", "how", "why", "who", "the", "is", "are", "can", "fee", "cost", "penalty", "rules"];
  const englishCount = words.filter((w) => englishWords.includes(w)).length;
  return englishCount >= 2;
}

function cleanSectionContent(content: string, subtitle: string): string {
  let c = (content || "").trim();
  const parts = subtitle.split(": ");
  if (parts.length > 1) {
    const sub = parts.slice(1).join(": ").trim();
    if (sub && c.toLowerCase().startsWith(sub.toLowerCase())) {
      c = c.slice(sub.length).trim();
    }
  }
  return c.replace(/^Seksyon\s+\d+[:\s\-]*/i, "").trim();
}

// Grammatical & generic structural stopwords + verbal prefixes
const GRAMMATICAL_STOPWORDS = new Set([
  "po", "ba", "ng", "sa", "at", "ang", "na", "ay", "ito", "kung", "kayo", "kami",
  "namin", "inyo", "sila", "kanila", "mo", "ko", "ni", "din", "rin", "nga", "naman",
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for", "with", "from",
  "by", "is", "are", "was", "were", "am", "it", "its", "be", "do", "does", "did",
  "barangay", "hall", "bosesbantay", "opisyal", "tala", "mga", "may", "meron", "wala",
  "lahat", "bawat", "anong", "ano", "kailan", "saan", "paano", "bakit", "sino", "alin",
  "dito", "doon", "nito", "para", "ukol", "hinggil", "bukas", "oras", "araw", "petsa",
  "mag", "nag", "pag", "makapag",
]);

// 100% DYNAMIC BOT SEARCH SERVICE
async function sendLiveBotMessage(userQuestion: string, residentName: string): Promise<string> {
  const q = userQuestion.trim();
  const qLower = q.toLowerCase();
  const isEnglish = isEnglishQuery(q);

  // 1. Natural Greeting
  if (isGreeting(q)) {
    const nameStr = residentName ? `, ${residentName}` : "";
    return isEnglish
      ? `Hello${nameStr}! How can I help you today?`
      : `Kumusta po${nameStr}! Ano po ang maitutulong ko sa inyo ngayon?`;
  }

  const fallbackNoData = isEnglish
    ? "I apologize, but there is no official record or document regarding this matter in our database. Please coordinate with the Barangay Hall for further assistance."
    : "Paumanhin po, wala pa po akong tala o opisyal na dokumento ukol sa katanungang ito sa ating database. Mangyaring makipag-ugnayan sa Barangay Hall para sa karagdagang impormasyon.";

  try {
    // 2. Fetch all active and approved documents from Supabase
    const { data: dbDocs, error } = await supabase
      .from("documents")
      .select("title, summary, sections, approval_status, is_active")
      .eq("approval_status", "Approved")
      .eq("is_active", true);

    if (error || !dbDocs || dbDocs.length === 0) {
      return fallbackNoData;
    }

    // Normalize colloquial contractions
    const normalizedQuery = qLower
      .replace(/\bpano\b/g, "paano")
      .replace(/\bsan\b/g, "saan")
      .replace(/\bkelan\b/g, "kailan");

    // 3. Dynamic Query Token Extraction
    const queryTokens = normalizedQuery
      .replace(/[^\w\s\u00C0-\u017F]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !GRAMMATICAL_STOPWORDS.has(w));

    const queryBigrams: string[] = [];
    for (let i = 0; i < queryTokens.length - 1; i++) {
      queryBigrams.push(`${queryTokens[i]} ${queryTokens[i + 1]}`);
    }

    // Robust morphological, stem, and bilingual cognate matcher
    const tokenMatchesText = (token: string, text: string) => {
      const t = token.toLowerCase();
      const txt = text.toLowerCase();
      if (new RegExp("(?:^|[^a-zA-Z0-9])" + t + "(?:$|[^a-zA-Z0-9])", "i").test(txt)) return true;
      if (t.length >= 4 && txt.includes(t) && t !== "pet") return true;

      if (t.startsWith("regist") || t.startsWith("rehistr")) return txt.includes("regist") || txt.includes("rehistr");
      if (t === "liga" || t === "league" || t.includes("liga")) return txt.includes("liga") || txt.includes("league");
      if (t.includes("linis") || t.startsWith("clean")) return txt.includes("linis") || txt.includes("clean");
      if (t.startsWith("inspek") || t.startsWith("inspect")) return txt.includes("inspek") || txt.includes("inspect");
      if (t.startsWith("bakun") || t.startsWith("vaccin")) return txt.includes("bakun") || txt.includes("vaccin");
      if (t === "aso" || t === "pusa" || t === "pet" || t === "pets") return /\b(pet|pets|aso|asong|pusa|pusang)\b/i.test(txt);
      return false;
    };

    // 4. Dynamic Document Scoring with Sentence-Level Topic Completeness
    const scoredDocs = dbDocs.map((doc: any) => {
      const cleanTitle = (doc.title || "")
        .replace(/\.[^/.]+$/, "")
        .replace(/[_\W]+/g, " ")
        .toLowerCase();
      const summaryLower = (doc.summary || "").toLowerCase();
      const fullDocText = (cleanTitle + " " + summaryLower + " " + (doc.sections || []).map((s: any) => `${s.title || ""} ${s.content || ""}`).join(" ")).toLowerCase();

      // Count how many DISTINCT query tokens this document actually addresses
      const matchedTokensCount = queryTokens.filter((tok) => tokenMatchesText(tok, fullDocText)).length;

      let docTopicScore = 0;

      for (const token of queryTokens) {
        if (tokenMatchesText(token, cleanTitle)) docTopicScore += 8;
        if (tokenMatchesText(token, summaryLower)) docTopicScore += 4;
      }

      for (const bigram of queryBigrams) {
        if (cleanTitle.includes(bigram)) docTopicScore += 10;
        if (summaryLower.includes(bigram)) docTopicScore += 5;
      }

      if (Array.isArray(doc.sections)) {
        let matchingSecs = 0;
        for (const sec of doc.sections) {
          const secFull = `${sec.title || ""} ${sec.content || ""}`.toLowerCase();
          const hasMatch = queryTokens.some((tok) => tokenMatchesText(tok, secFull));
          if (hasMatch) matchingSecs++;
        }
        docTopicScore += Math.min(8, matchingSecs * 2.5);
      }

      return { doc, docTopicScore, matchedTokensCount };
    });

    // Sort by distinct query tokens matched descending, then by overall score
    scoredDocs.sort((a, b) => b.matchedTokensCount - a.matchedTokensCount || b.docTopicScore - a.docTopicScore);
    const topDocCandidate = scoredDocs.length > 0 ? scoredDocs[0] : null;
    const maxMatchedTokens = topDocCandidate ? topDocCandidate.matchedTokensCount : 0;
    const topDocScore = topDocCandidate ? topDocCandidate.docTopicScore : 0;

    // Honest fallback if inquiry has zero relevance to database
    if (!topDocCandidate || maxMatchedTokens === 0 || topDocScore < 3.0) {
      return fallbackNoData;
    }

    // Sentence-Level Topic Locking: ONLY qualify documents that match the sentence's maximum distinct tokens!
    const candidateDocs = scoredDocs
      .filter((d) => d.matchedTokensCount === maxMatchedTokens && d.docTopicScore >= Math.max(3.0, topDocScore * 0.70))
      .map((d) => d.doc);

    // 5. Universal Intent Detection
    const isFeeQuery = ["magkano", "bayad", "libre", "singil", "halaga", "premyo", "pabuya", "cost", "fee", "price", "prize", "free"].some((w) => tokenMatchesText(w, normalizedQuery));
    const isPenaltyQuery = ["multa", "parusa", "penalty", "huli", "violation", "paglabag", "bawal", "pananagutan", "saklaw"].some((w) => tokenMatchesText(w, normalizedQuery));
    const isScheduleQuery = ["oras", "kailan", "iskedyul", "araw", "petsa", "panahon", "when", "schedule", "time", "date", "inspeksyon"].some((w) => tokenMatchesText(w, normalizedQuery));
    const isRequirementsQuery = ["paano", "rehistro", "register", "kuha", "sumali", "kwalipikasyon", "edad", "requisitos", "requirement", "qualify", "how", "who"].some((w) => tokenMatchesText(w, normalizedQuery));

    // 6. Dynamic Section-Level Precision Ranking
    interface CandidateSection {
      content: string;
      sectionTitle: string;
      score: number;
    }

    const sectionsFound: CandidateSection[] = [];

    for (const doc of candidateDocs) {
      const sections = Array.isArray(doc.sections) ? doc.sections : [];

      for (const sec of sections) {
        const secTitleLower = (sec.title || "").toLowerCase();
        const secContentLower = (sec.content || "").toLowerCase();

        let score = 0;

        for (const token of queryTokens) {
          if (tokenMatchesText(token, secTitleLower)) {
            score += 5.0;
          } else if (tokenMatchesText(token, secContentLower)) {
            score += 2.0;
          }
        }

        for (const bigram of queryBigrams) {
          if (secTitleLower.includes(bigram)) score += 5.0;
          else if (secContentLower.includes(bigram)) score += 2.5;
        }

        if (isFeeQuery) {
          if (["bayad", "libre", "singil", "halaga", "premyo", "pabuya", "pagpaparehistro", "fee", "cost", "price"].some((w) => secTitleLower.includes(w))) {
            score += 5.0;
          }
          if (/[₱$]|php|pesos?|\b\d+([.,]\d{2})?\b|\blibre\b|\bfree\b/i.test(secContentLower)) {
            score += 3.5;
          }
        }

        if (isPenaltyQuery) {
          if (["multa", "parusa", "paglabag", "penalty", "sanction", "pananagutan", "kagat"].some((w) => secTitleLower.includes(w))) {
            score += 6.0;
          }
          if (["multa", "parusa", "unang paglabag", "penalty", "pananagutan"].some((w) => secContentLower.includes(w))) {
            score += 3.0;
          }
        }

        if (isScheduleQuery) {
          if (["oras", "iskedyul", "araw", "petsa", "panahon", "inspeksyon", "schedule", "time"].some((w) => secTitleLower.includes(w))) {
            score += 5.0;
          }
          if (["lunes", "martes", "miyerkules", "huwebes", "biyernes", "sabado", "linggo", "am", "pm", "umaga", "hapon", "gabi"].some((w) => secContentLower.includes(w))) {
            score += 3.0;
          }
        }

        if (isRequirementsQuery) {
          if (["requisitos", "kwalipikasyon", "pamantayan", "requirements", "edad", "pagpaparehistro", "registration"].some((w) => secTitleLower.includes(w))) {
            score += 6.0;
          }
        }

        if (
          (secTitleLower.includes("pamagat") || secTitleLower.includes("saklaw")) &&
          (isFeeQuery || isPenaltyQuery || isScheduleQuery || isRequirementsQuery)
        ) {
          score -= 10;
        }

        if (score >= 3) {
          sectionsFound.push({
            content: sec.content || "",
            sectionTitle: sec.title || "",
            score,
          });
        }
      }
    }

    if (sectionsFound.length === 0) {
      return fallbackNoData;
    }

    sectionsFound.sort((a, b) => b.score - a.score);
    const bestSection = sectionsFound[0];

    return cleanSectionContent(bestSection.content, bestSection.sectionTitle);
  } catch (err) {
    console.error("Error in sendLiveBotMessage:", err);
    return fallbackNoData;
  }
}

export default function BotScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [residentName, setResidentName] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Itago ang bottom tab navigation habang nasa bot screen
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.setOptions({ tabBarStyle: undefined });
        navigation.getParent()?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/(resident)/home");
    }
  }

  // Keyboard adaptive padding
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showListener = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // I-sync ang pangalan ng kasalukuyang naka-login na residente
  useEffect(() => {
    if (profile?.firstName) {
      setResidentName(profile.firstName);
      return;
    }
    if (profile?.fullName) {
      setResidentName(profile.fullName.split(" ")[0]);
      return;
    }

    async function loadUserName() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          let query = supabase.from("users").select("first_name, last_name");
          if (user.email) {
            query = query.or(`id.eq.${user.id},email.eq.${user.email}`);
          } else {
            query = query.eq("id", user.id);
          }

          const { data: dbUser } = await query.maybeSingle();

          if (dbUser?.first_name) {
            setResidentName(dbUser.first_name);
            return;
          }

          const metaName = user.user_metadata?.first_name || user.user_metadata?.full_name;
          if (metaName) {
            setResidentName(metaName.split(" ")[0]);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadUserName();
  }, [profile]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      from: "user",
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setSending(true);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const botReply = await sendLiveBotMessage(text, residentName);
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          from: "bot",
          text: botReply,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-err-${Date.now()}`,
          from: "bot",
          text: "Paumanhin po, pansamantalang hindi maabot ang sistema. Mangyaring makipag-ugnayan sa Barangay Hall para sa inyong katanungan.",
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header na may Sparkle Icon */}
      <View className="flex-row items-center px-4 pt-2 pb-3 border-b border-gray-100">
        <View className="mr-2">
          <BackButton onPress={goBack} />
        </View>
        <View className="flex-row items-center gap-1.5 flex-1">
          <Text className="text-[20px] font-bold text-ink tracking-tight">Barangay-Bot</Text>
          <Ionicons name="sparkles" size={17} color="#2563EB" />
        </View>
      </View>

      {/* Chat Messages */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            /* EMPTY STATE / GREETING SCREEN */
            <View className="flex-1 justify-center items-center py-8">
              {/* Sparkle Icon */}
              <View className="w-12 h-12 rounded-2xl bg-blue-50 items-center justify-center mb-4">
                <Ionicons name="sparkles" size={26} color="#2563EB" />
              </View>

              {/* Dynamic Personalized Headline */}
              <Text className="text-[22px] font-bold text-ink text-center tracking-tight mb-8">
                {residentName ? `Kumusta, ${residentName}!` : "Kumusta!"} Ano ang maitutulong ko?
              </Text>

              {/* Quick Prompts List */}
              <View className="w-full gap-2">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => handleSend(prompt)}
                    className="flex-row items-center justify-between py-3.5 px-3 rounded-xl active:bg-gray-50 border border-transparent active:border-gray-200"
                  >
                    <Text className="text-[14.5px] text-ink font-normal flex-1 mr-3">
                      {prompt}
                    </Text>
                    <Ionicons name="arrow-forward" size={17} color="#9CA3AF" />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            /* ACTIVE CHAT BUBBLES */
            <View className="gap-3 py-4">
              {messages.map((m) => (
                <View
                  key={m.id}
                  className={`max-w-[85%] px-4 py-3 rounded-2xl ${m.from === "user" ? "bg-brand self-end" : "bg-gray-100 self-start"
                    }`}
                >
                  <Text
                    className={`text-[14px] leading-5 ${m.from === "user" ? "text-white" : "text-ink"
                      }`}
                  >
                    {m.text}
                  </Text>
                </View>
              ))}
              {sending && (
                <ActivityIndicator className="self-start mt-2" color="#1D4ED8" />
              )}
            </View>
          )}
        </ScrollView>

        {/* Input Bar na may Universal Adaptive Padding */}
        <View
          className="px-5 pt-2 border-t border-gray-100 bg-white"
          style={{
            paddingBottom: isKeyboardVisible
              ? 8
              : Math.max(insets.bottom, 12),
          }}
        >
          <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-1.5 mb-1.5">
            <TextInput
              value={input}
              onChangeText={setInput}
              onFocus={() =>
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)
              }
              placeholder="Type a message…"
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-[14px] text-ink py-2"
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={sending || !input.trim()}
              className={`w-9 h-9 rounded-full items-center justify-center active:opacity-85 ${input.trim() ? "bg-brand" : "bg-gray-300"
                }`}
            >
              <Ionicons name="arrow-up" size={18} color="white" />
            </Pressable>
          </View>

          {/* Subtitle disclaimer */}
          <Text className="text-[10px] text-gray-400 text-center px-4 leading-3">
            Maaaring magkamali ang Barangay-Bot. Para sa opisyal na detalye, bisitahin o tawagan ang barangay hall.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
