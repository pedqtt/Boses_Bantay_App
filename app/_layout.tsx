import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { AuthProvider } from "@/lib/auth-context";
import { colors } from "@/lib/theme";
// @ts-ignore
import "../global.css";

function InitialLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
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

    if (!session && !inAuthGroup) {
      // Redirect unauthenticated user to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Redirect authenticated user directly to resident home
      router.replace("/(resident)/home");
    }
  }, [session, initialized, segments]);

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
    <AuthProvider>
      <StatusBar style="dark" />
      <InitialLayout />
    </AuthProvider>
  );
}