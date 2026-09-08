import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayInAppTimezone, todayDayOfWeekInAppTimezone } from "@/lib/dates";
import NewServiceForm from "./new-service-form";
import BackLink from "../../../back-link";

export default async function NewServicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRows } = await supabase
    .from("branch_staff")
    .select("branch_id, church_branches(midweek_service_day)")
    .eq("user_id", user.id);
  const staffRow = staffRows?.[0];
  if (!staffRow) redirect("/dashboard/branch");
  const branchId = staffRow.branch_id as string;
  const midweekDay = (staffRow.church_branches as unknown as { midweek_service_day: number | null } | null)?.midweek_service_day ?? null;

  const { data: fundsRaw } = await supabase
    .from("branch_funds")
    .select("id, name")
    .eq("branch_id", branchId)
    .eq("active", true)
    .order("sort_order");
  const funds = fundsRaw || [];

  const today = todayInAppTimezone();
  const dow = todayDayOfWeekInAppTimezone();
  const defaultServiceType: "sunday" | "midweek" = dow === 0 ? "sunday" : dow === midweekDay ? "midweek" : "sunday";

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/branch/services" label="Service Records" />
      <div>
        <h1 className="text-[22px] font-semibold">Record a Service</h1>
        <p className="text-sm text-[var(--slate)] mt-1">Cash Analysis + Record of Activities, in one entry.</p>
      </div>
      <NewServiceForm branchId={branchId} funds={funds} today={today} defaultServiceType={defaultServiceType} />
    </div>
  );
}
