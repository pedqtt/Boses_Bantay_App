import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/lib/auth-context";
import { fontPreferenceKey, fontScaleFor, isFontSizePreference, type FontSizePreference } from "@/lib/typography";

type TypographyContextValue = { size: FontSizePreference; scale: number; loaded: boolean; error: string; setSize: (size: FontSizePreference) => void };
const TypographyContext = createContext<TypographyContextValue>({ size: "standard", scale: 1, loaded: false, error: "", setSize: () => {} });
export function TypographyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const owner = profile?.id || "guest";
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const [saved, setSaved] = useState<{ owner: string; size: FontSizePreference; loaded: boolean; error: string }>({ owner: "", size: "standard", loaded: false, error: "" });
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(fontPreferenceKey(owner)).then(value => {
      if (active) setSaved({ owner, size: isFontSizePreference(value) ? value : "standard", loaded: true, error: "" });
    }).catch(() => { if (active) setSaved({ owner, size: "standard", loaded: true, error: "Hindi ma-load ang text preference. Piliin muli ang laki ng text." }); });
    return () => { active = false; };
  }, [owner]);
  const loaded = saved.owner === owner && saved.loaded;
  const size = saved.owner === owner ? saved.size : "standard";
  const setSize = useCallback((next: FontSizePreference) => {
    if (!loaded || !isFontSizePreference(next)) return;
    const account = owner;
    setSaved({ owner: account, size: next, loaded: true, error: "" });
    writes.current = writes.current.catch(() => {}).then(async () => {
      try { await SecureStore.setItemAsync(fontPreferenceKey(account), next); }
      catch { if (ownerRef.current === account) setSaved(previous => ({ ...previous, error: "Nabago ang text ngayon, pero hindi na-save ang preference sa device." })); }
    });
  }, [owner, loaded]);
  return <TypographyContext.Provider value={{ size, scale: fontScaleFor(size), loaded, error: saved.owner === owner ? saved.error : "", setSize }}>{children}</TypographyContext.Provider>;
}
export function useTypography() { return useContext(TypographyContext); }

/** Local preview scope: choosing a sample size never updates the saved app setting. */
export function TypographyPreview({ size, children }: { size: FontSizePreference; children: ReactNode }) {
  const current = useTypography();
  return <TypographyContext.Provider value={{ ...current, size, scale: fontScaleFor(size), setSize: () => {} }}>{children}</TypographyContext.Provider>;
}
