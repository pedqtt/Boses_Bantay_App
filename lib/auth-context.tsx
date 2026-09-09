import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { ResidentProfile } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  profile: ResidentProfile | null;
  pendingPhone: string | null;
  setPendingPhone: (phone: string | null) => void;
  signIn: (profile: ResidentProfile) => void;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  async function fetchProfileForUser(userId: string, email?: string) {
    try {
      if (!supabase) return;

      let query = supabase.from("users").select("*");
      if (email) {
        query = query.or(`id.eq.${userId},email.eq.${email}`);
      } else {
        query = query.eq("id", userId);
      }

      const { data: dbUser } = await query.maybeSingle();
      if (dbUser) {
        const firstName = dbUser.first_name ?? "";
        const lastName = dbUser.last_name ?? "";
        setProfile({
          id: dbUser.id,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim() || "Resident",
          phone: dbUser.mobile_number ?? "",
          purok: dbUser.address ?? "",
          barangayIdStatus: "unverified",
        });
      }
    } catch (e) {
      console.log("Error fetching resident profile:", e);
    }
  }

  async function refreshProfile() {
    try {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchProfileForUser(session.user.id, session.user.email);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!supabase) return;

    // 1. I-restore ang profile ng kasalukuyang naka-log in na user sa startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfileForUser(session.user.id, session.user.email);
      }
    });

    // 2. Makinig sa pag-login, pag-logout, o pagpalit ng account
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfileForUser(session.user.id, session.user.email);
      } else {
        setProfile(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    profile,
    pendingPhone,
    setPendingPhone,
    signIn: (p) => setProfile(p),
    signOut: () => setProfile(null),
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

