import { isWithinMilagrosa } from "@/lib/service-area";
import { parseLocationPin, type LocationPin } from "@/lib/map-location";
import type { SupabaseClient } from "@supabase/supabase-js";
export type ServiceComplaintInput = {
  referenceNo: string; userId: string; category: { value: string; label: string };
  location: string; locationPin?: LocationPin | null; description: string; photoPaths: string[];
};
export function buildServiceComplaintRow(input: ServiceComplaintInput) {
  if (!input.userId || !input.referenceNo || !input.category.value || !input.location.trim() || !input.description.trim()) throw new Error("Kumpletuhin muna ang report bago ipasa.");
  if (input.locationPin && !parseLocationPin(input.locationPin)) throw new Error("Hindi wasto ang pin sa mapa. Piliin muli ang lokasyon.");
  if (input.locationPin && !isWithinMilagrosa(input.locationPin)) throw new Error("Pumili ng pin sa loob ng Barangay Milagrosa bago ipasa ang report.");
  if (input.photoPaths.length > 5) throw new Error("Hanggang 5 larawan lang po.");
  // These columns match the live reports schema; category IDs and paths stay in JSON.
  return {
    reference_no: input.referenceNo, user_id: input.userId, status: "Under Review",
    category: input.category.label, summary: input.description.trim(),
    description: input.description.trim(), location: input.location.trim(),
    full_details: { type: "service_complaint", category: input.category.value,
      categoryLabel: input.category.label, location: input.location.trim(),
      description: input.description.trim(), photoPaths: input.photoPaths,
      ...(input.locationPin ? { locationPin: parseLocationPin(input.locationPin) } : {}) },
  };
}
export async function insertServiceComplaint(client: SupabaseClient, input: ServiceComplaintInput) {
  const { data, error } = await client.from("reports").insert(buildServiceComplaintRow(input)).select("id,reference_no").single();
  if (error) {
    console.warn("[service-complaint] database rejected save", { code: error.code, message: error.message });
    if (error.code === "42501") throw new Error("Hindi pinayagan ng database ang pag-save. Pakikontak ang admin para sa report permissions.");
    if (error.code === "PGRST204" || error.code === "42P01") throw new Error("Hindi tugma ang report configuration sa database. Pakikontak ang admin.");
    throw new Error("Hindi makumpirma ang pag-save. Tingnan muna ang Aking Reports bago muling magpasa.");
  }
  if (!data?.id || data.reference_no !== input.referenceNo) throw new Error("Hindi makumpirma ang pag-save. Tingnan muna ang Aking Reports bago muling magpasa.");
  return { id: String(data.id), referenceNo: data.reference_no as string };
}
