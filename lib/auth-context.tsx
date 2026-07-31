import { createContext, useContext, useState, type ReactNode } from "react";
import type { ResidentProfile } from "@/lib/api/auth";

type AuthContextValue = {
  profile: ResidentProfile | null;
  pendingPhone: string | null;
  setPendingPhone: (phone: string | null) => void;
  signIn: (profile: ResidentProfile) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const value: AuthContextValue = {
    profile,
    pendingPhone,
    setPendingPhone,
    signIn: (p) => setProfile(p),
    signOut: () => setProfile(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
