import { FilterRadioGroup } from "@/components/FilterRadioGroup";
import type { DateSortOrder } from "@/lib/list-sort";
const OPTIONS = [{ id: "newest", label: "Pinakabago" }, { id: "oldest", label: "Pinakaluma" }] as const;
export function DateSortOptions({ value, onChange }: { value: DateSortOrder; onChange: (value: DateSortOrder) => void }) {
  return <FilterRadioGroup title="Ayusin ayon sa" value={value} options={OPTIONS} onChange={onChange} separated />;
}
