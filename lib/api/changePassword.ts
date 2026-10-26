import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getNewPasswordError } from "@/lib/validation";

export async function changeAccountPassword(owner: string, currentPassword: string, newPassword: string) {
  if (!isSupabaseConfigured || !supabase) throw Error("Hindi available ang account service ngayon.");
  if (!owner || !currentPassword) throw Error("Ilagay ang kasalukuyang password.");
  const validation = getNewPasswordError(newPassword);
  if (validation) throw Error(validation);
  if (currentPassword === newPassword) throw Error("Gumamit ng bagong password na iba sa kasalukuyan.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.id !== owner) throw Error("Mag-sign in muli bago palitan ang password.");
  const credentials = user.email ? { email: user.email, password: currentPassword } : user.phone ? { phone: user.phone, password: currentPassword } : null;
  if (!credentials) throw Error("Hindi makumpirma ang login ng account. Makipag-ugnayan sa support.");
  // An isolated, non-persisted session checks the old password without replacing
  // the app's current session or depending on email collection in the UI.
  const verifier = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!.trim(), process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!.trim(), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const verified = await verifier.auth.signInWithPassword(credentials);
    if (verified.error) {
      if (verified.error.code === "invalid_credentials") throw Error("Hindi tama ang kasalukuyang password.");
      if (verified.error.status === 429) throw Error("Maraming sunod-sunod na pagsubok. Maghintay sandali bago subukan muli.");
      throw Error("Hindi makumpirma ang password ngayon. Pakisubukan muli.");
    }
    if (verified.data.user?.id !== owner) throw Error("Hindi tugma ang account. Mag-sign in muli.");
    const updated = await verifier.auth.updateUser({ password: newPassword, current_password: currentPassword });
    if (updated.error) {
      if (updated.error.code === "same_password") throw Error("Dapat iba ang bagong password sa dati.");
      if (updated.error.code === "weak_password") throw Error("Hindi sapat ang lakas ng password. Gumamit ng mas matibay na password.");
      if (updated.error.code === "reauthentication_needed" || updated.error.code === "reauthentication_not_valid") throw Error("Kailangan ng karagdagang verification. Mag-sign in muli bago subukan ulit.");
      throw Error("Hindi na-update ang password sa server. Pakisubukan muli.");
    }
    if (updated.data.user?.id !== owner) throw Error("Hindi makumpirma ang pagbabago. Subukang mag-login gamit ang bagong password bago ulitin.");
  } finally { await verifier.auth.signOut({ scope: "local" }).catch(() => {}); }
}
