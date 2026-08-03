import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

// ✅ Import our custom bypass function and Auth Context
import { logInUser } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth-context";
import { useKeyboardFocusScroll } from "@/lib/useKeyboardFocusScroll";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { scrollRef, handleFocus, handleContainerLayout } = useKeyboardFocusScroll();
  
  // ✅ Get signIn from our context so the app knows we are logged in
  const { signIn } = useAuth(); 

  async function handleLogin() {
    if (!phone.trim() || !password.trim()) {
      Alert.alert("Missing info", "Please enter both phone number and password.");
      return;
    }

    setLoading(true);

    try {
      // ✅ Call OUR bypass wrapper instead of supabase directly!
      const response = await logInUser(phone.trim(), password.trim());

      if (response.ok) {
        if (signIn) {
          await signIn(response.profile);
        }
        router.replace("/(resident)/home");
      }
    } catch (err: any) {
      Alert.alert("Login failed", err.message ?? "Invalid phone number or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          onLayout={handleContainerLayout}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-8 justify-center">
            <Text className="text-[28px] font-bold text-ink tracking-tight mb-2">
              Welcome back
            </Text>
            <Text className="text-[15px] text-ink-soft mb-8">
              Sign in to access your barangay portal account.
            </Text>

            <View className="mb-6">
              <Text className="text-[13px] font-medium text-ink-soft mb-2 uppercase tracking-wide">
                Mobile Number
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                onFocus={handleFocus}
                placeholder="09171234567"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                autoCapitalize="none"
                className="text-[17px] text-ink border-b border-gray-200 pb-3"
              />
            </View>

            <View className="mb-8">
              <Text className="text-[13px] font-medium text-ink-soft mb-2 uppercase tracking-wide">
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={handleFocus}
                placeholder="Enter password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                className="text-[17px] text-ink border-b border-gray-200 pb-3"
              />
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="bg-brand rounded-2xl py-4 items-center mb-6 active:opacity-85"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-[16px]">Sign In</Text>
              )}
            </Pressable>

            <View className="flex-row justify-center items-center">
              <Text className="text-ink-soft text-[14px]">Don't have an account? </Text>
              <Pressable onPress={() => router.push("/(auth)/register")}>
                <Text className="text-brand font-semibold text-[14px]">Register</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}