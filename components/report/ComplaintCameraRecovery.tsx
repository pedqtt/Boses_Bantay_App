import { useEffect } from "react";
import { AppState } from "react-native";
import { router, usePathname } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { loadComplaintDraft } from "@/lib/api/serviceComplaintDraft";

export function ComplaintCameraRecovery() {
  const { profile } = useAuth();
  const path = usePathname();
  useEffect(() => {
    if (!profile?.id || profile.barangayIdStatus !== "pb_authorized") return;
    let cancelled = false;
    async function recover() {
      try {
        const draft = await loadComplaintDraft(profile!.id);
        if (!cancelled && draft?.pendingPhoto && !path.includes("service-complaint")) router.replace("/(resident)/service-complaint");
      } catch { /* The complaint screen offers recovery if storage becomes available. */ }
    }
    void recover();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void recover(); });
    return () => { cancelled = true; listener.remove(); };
  }, [profile?.id, profile?.barangayIdStatus, path]);
  return null;
}
