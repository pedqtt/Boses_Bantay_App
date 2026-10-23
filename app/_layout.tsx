import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { colors } from "@/lib/theme";
// @ts-ignore
import "../global.css";

function InitialLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const { profile } = useAuth();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Local/mock mode has no Supabase client. Mark auth as initialized so
      // the existing offline login flow can continue without calling null.auth.
      setInitialized(true);
      return;
    }

    // Listen for real-time auth state changes from Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setInitialized(true);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(auth)";
    // Login/register update AuthProvider immediately, while a real Supabase
    // session can arrive a moment later. Accept either source so a successful
    // login is not redirected back to the auth screen during that gap.
    const isAuthenticated = Boolean(session || profile);

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect unauthenticated user to login
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect authenticated user directly to resident home
      router.replace("/(resident)/home");
    }
  }, [session, profile, initialized, segments]);

  if (!initialized) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(resident)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    // Wraps the whole app, not just bot.tsx - every screen with a keyboard
    // now goes through react-native-keyboard-controller (KeyboardAware
    // ScrollView, useKeyboardHandler/useKeyboardHeight), which requires
    // exactly one KeyboardProvider instance at the root.
    <KeyboardProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <InitialLayout />
      </AuthProvider>
    </KeyboardProvider>
  );
}