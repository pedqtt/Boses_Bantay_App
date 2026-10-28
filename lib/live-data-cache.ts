import type { AccountReport } from "@/lib/myReports";
import type { DirectoryContact } from "@/components/directory/DirectoryContactCard";
export const liveDataCache = { directory: null as DirectoryContact[] | null, accounts: new Map<string, { reports: AccountReport[]; notices: AccountReport[]; partial: boolean }>() };
