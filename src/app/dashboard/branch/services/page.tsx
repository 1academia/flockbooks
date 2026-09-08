import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/roles";
import BackLink from "../../back-link";

type Row = {
  id: string;
  service_date: string;
  service_type: string;
  attendance_total: number;
  grand_total: number;
  status: string;
};

export default async function ServicesListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRows } = await supabase.from("branch_staff").select("branch_id").eq("user_id", user.id);
  const branchId = staffRows?.[0]?.branch_id as string | undefined;
  if (!branchId) redirect("/dashboard/branch");

  const { data: recordsRaw } = await supabase
    .from("service_records")
    .select("id, service_date, service_type, attendance_total, grand_total, status")
    .eq("branch_id", branchId)
    .order("service_date", { ascending: false })
    .limit(50);
  const records = (recordsRaw || []) as Row[];

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/branch" label="Branch dashboard" />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold">Service Records</h1>
          <p className="text-sm text-[var(--slate)] mt-1">Cash Analysis + Record of Activities, one row per service.</p>
        </div>
        <Link href="/dashboard/branch/services/new"
          className="rounded-lg bg-[var(--navy)] text-white font-semibold px-4 py-2.5 text-[13.5px] whitespace-nowrap">
          + Record a Service
        </Link>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-[var(--slate)]">No service records yet — the first one starts with &quot;Record a Service&quot; above.</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <Link key={r.id} href={`/dashboard/branch/services/${r.id}`}
              className="flex items-center justify-between bg-[var(--paper)] border border-[var(--line)] rounded-xl px-5 py-3.5 hover:border-[var(--navy)] transition-colors">
              <div>
                <p className="text-[14.5px] font-medium">
                  {r.service_date} <span className="text-[var(--slate)] font-normal">&middot; {r.service_type === "sunday" ? "Sunday" : "Mid-week"}</span>
                </p>
                <p className="text-[12.5px] text-[var(--slate)] mt-0.5">Attendance {r.attendance_total}</p>
              </div>
              <div className="text-right">
                <p className="mono text-[14.5px] font-semibold">₦{Number(r.grand_total).toLocaleString()}</p>
                <StatusBadge status={r.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const closed = status === "closed";
  return (
    <span className={`inline-block mt-1 text-[10.5px] uppercase tracking-wide mono px-2 py-0.5 rounded-full ${
      closed ? "bg-[var(--good-bg)] text-[var(--good)]" : "bg-[var(--ice)] text-[var(--navy)]"
    }`}>
      {statusLabel(status)}
    </span>
  );
}
