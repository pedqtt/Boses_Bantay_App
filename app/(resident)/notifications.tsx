import { ReportNotifications } from "@/components/reports/ReportNotifications";
import { useAuth } from "@/lib/auth-context";
import type { AccountReport } from "@/lib/myReports";

const EMPTY_REPORTS: AccountReport[] = [];
// Temporary preview mode, shared with the Home notification card.
export default function NotificationsScreen() {
  const { profile } = useAuth();
  return <ReportNotifications page sample owner={profile?.id ?? ""} reports={EMPTY_REPORTS} loading={false} error="" partial={false} refresh={() => {}} />;
}
