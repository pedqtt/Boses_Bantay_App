import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Chunking adapter to prevent 2048-byte size limit warnings on iOS SecureStore
const SecureStoreAdapter = {
  getItem: async (key: string) => {
    // 1. Try fetching unchunked key first
    const directValue = await SecureStore.getItemAsync(key);
    if (directValue) return directValue;

    // 2. Fetch chunked key parts if large payload was split
    let i = 0;
    let chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
    if (!chunk) return null;

    let fullValue = "";
    while (chunk) {
      fullValue += chunk;
      i++;
      chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
    }
    return fullValue;
  },

  setItem: async (key: string, value: string) => {
    const CHUNK_SIZE = 1800; // Stay well under 2048 byte limit

    // If small enough, save directly
    if (value.length <= CHUNK_SIZE) {
      return await SecureStore.setItemAsync(key, value);
    }

    // Clean up any old unchunked/chunked keys
    await SecureStoreAdapter.removeItem(key);

    // Split large value into chunks
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) || [];
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }
  },

  removeItem: async (key: string) => {
    // Remove unchunked item
    await SecureStore.deleteItemAsync(key);

    // Remove all chunked items
    let i = 0;
    while (await SecureStore.getItemAsync(`${key}_chunk_${i}`)) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      i++;
    }
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: SecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);