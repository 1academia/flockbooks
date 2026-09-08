import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { recentWeekStarts, weekSundayOf, weekLabel, depositDeadline, isPastDeadline } from "@/lib/weeks";
import { todayInAppTimezone } from "@/lib/dates";
import BackLink from "../../back-link";

type ServiceRow = { service_date: string; grand_total: number };
type DepositRow = {
  week_start: string; amount: number; teller_attached: boolean; teller_slip_photo_path: string | null;
  status: string;
};

export default async function DepositsListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRows } = await supabase.from("branch_staff").select("branch_id").eq("user_id", user.id);
  const branchId = staffRows?.[0]?.branch_id as string | undefined;
  if (!branchId) redirect("/dashboard/branch");

  const { data: branch } = await supabase
    .from("church_branches")
    .select("statement_deadline_dow, statement_deadline_time")
    .eq("id", branchId)
    .single();

  const weeks = recentWeekStarts(12, todayInAppTimezone());
  const earliestWeek = weeks[weeks.length - 1];

  const { data: servicesRaw } = await supabase
    .from("service_records")
    .select("service_date, grand_total")
    .eq("branch_id", branchId)
    .gte("service_date", earliestWeek);
  const services = (servicesRaw || []) as ServiceRow[];

  const { data: depositsRaw } = await supabase
    .from("weekly_cash_deposits")
    .select("week_start, amount, teller_attached, teller_slip_photo_path, status")
    .eq("branch_id", branchId)
    .gte("week_start", earliestWeek);
  const deposits = new Map((depositsRaw as DepositRow[] | null || []).map((d) => [d.week_start, d]));

  const rows = weeks
    .map((weekStart) => {
      const sunday = weekSundayOf(weekStart);
      const expected = services
        .filter((s) => s.service_date >= weekStart && s.service_date <= sunday)
        .reduce((sum, s) => sum + Number(s.grand_total), 0);
      const deposit = deposits.get(weekStart) || null;
      const deadline = branch ? depositDeadline(weekStart, branch.statement_deadline_dow) : null;
      const overdue = !deposit && !!branch && isPastDeadline(weekStart, branch.statement_deadline_dow, branch.statement_deadline_time);
      return { weekStart, expected, deposit, deadline, overdue };
    })
    .filter((r) => r.expected > 0 || r.deposit);

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/branch" label="Branch dashboard" />
      <div>
        <h1 className="text-[22px] font-semibold">Weekly Cash Deposits</h1>
        <p className="text-sm text-[var(--slate)] mt-1">
          One deposit per week — always covers Sunday and mid-week together.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--slate)]">
          No weeks with service records yet — record a service first, then come back here to log its deposit.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.weekStart} href={`/dashboard/branch/deposits/${r.weekStart}`}
              className="flex items-center justify-between bg-[var(--paper)] border border-[var(--line)] rounded-xl px-5 py-3.5 hover:border-[var(--navy)] transition-colors">
              <div>
                <p className="text-[14.5px] font-medium">{weekLabel(r.weekStart)}</p>
                <p className="text-[12.5px] text-[var(--slate)] mt-0.5">
                  Expected ₦{r.expected.toLocaleString()}
                  {r.deadline && !r.deposit ? ` · Due ${r.deadline}` : ""}
                </p>
              </div>
              <div className="text-right">
                {r.deposit ? (
                  <>
                    <p className="mono text-[14.5px] font-semibold">₦{Number(r.deposit.amount).toLocaleString()}</p>
                    {r.deposit.status === "verified" ? (
                      <StatusBadge label="Verified" tone="good" />
                    ) : r.deposit.status === "mismatch" ? (
                      <StatusBadge label="Mismatch" tone="bad" />
                    ) : (
                      <StatusBadge label="Recorded" tone="good" />
                    )}
                  </>
                ) : (
                  <StatusBadge label={r.overdue ? "Overdue" : "Not yet recorded"} tone={r.overdue ? "bad" : "neutral"} />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "good" | "bad" | "neutral" }) {
  const cls =
    tone === "good" ? "bg-[var(--good-bg)] text-[var(--good)]" :
    tone === "bad" ? "bg-[var(--bad-bg)] text-[var(--bad)]" :
    "bg-[var(--ice)] text-[var(--navy)]";
  return (
    <span className={`inline-block mt-1 text-[10.5px] uppercase tracking-wide mono px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}
