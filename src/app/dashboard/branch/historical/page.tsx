import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { monthLabel } from "@/lib/months";
import { saveHistoricalMonth, deleteHistoricalMonth } from "./actions";
import BackLink from "../../back-link";

type FundRow = { id: string; name: string };
type HistoricalRow = { month: string; kind: "income" | "expense"; fund_name: string | null; amount: number };

export default async function HistoricalPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const { saved, deleted } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRows } = await supabase
    .from("branch_staff")
    .select("branch_id, role")
    .eq("user_id", user.id);
  const branchId = staffRows?.[0]?.branch_id as string | undefined;
  if (!branchId) redirect("/dashboard/branch");
  const isSubAdmin = staffRows?.some((r) => r.role === "sub_admin") ?? false;

  if (!isSubAdmin) {
    return (
      <div className="space-y-6 max-w-md">
        <BackLink href="/dashboard/branch/analytics" label="Analytics" />
        <p className="text-sm text-[var(--slate)]">Only this branch&apos;s Sub Admin can enter historical totals.</p>
      </div>
    );
  }

  const { data: fundsRaw } = await supabase
    .from("branch_funds")
    .select("id, name")
    .eq("branch_id", branchId)
    .eq("active", true)
    .order("sort_order");
  const funds = (fundsRaw || []) as FundRow[];

  const { data: historicalRaw } = await supabase
    .from("historical_monthly_totals")
    .select("month, kind, fund_name, amount")
    .eq("branch_id", branchId)
    .is("superseded_at", null)
    .order("month", { ascending: false });
  const historical = (historicalRaw || []) as HistoricalRow[];

  const byMonth = new Map<string, { income: number; expenses: number }>();
  for (const row of historical) {
    const entry = byMonth.get(row.month) || { income: 0, expenses: 0 };
    if (row.kind === "income") entry.income += Number(row.amount);
    else entry.expenses += Number(row.amount);
    byMonth.set(row.month, entry);
  }
  const months = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-8 max-w-md">
      <BackLink href="/dashboard/branch/analytics" label="Analytics" />
      <div>
        <h1 className="text-[22px] font-semibold">Records from before FlockBooks</h1>
        <p className="text-sm text-[var(--slate)] mt-1">
          Enter one total per fund and one expense total for a past month — no per-service detail or receipts needed —
          so Analytics can compare it against the same month in another year.
        </p>
      </div>

      {saved && (
        <div className="bg-[var(--good-bg)] text-[var(--good)] rounded-lg px-3 py-2 text-[13px]">
          Saved {monthLabel(saved)}.
        </div>
      )}
      {deleted && (
        <div className="bg-[var(--ice)] text-[var(--navy)] rounded-lg px-3 py-2 text-[13px]">
          Month cleared.
        </div>
      )}

      <form action={saveHistoricalMonth} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 space-y-4">
        <input type="hidden" name="branch_id" value={branchId} />
        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Month</label>
          <input type="month" name="month" required
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]" />
        </div>

        {funds.length === 0 ? (
          <p className="text-[13px] text-[var(--slate)]">No active funds — a Sub Admin can add some from the branch page first.</p>
        ) : (
          funds.map((f) => (
            <div key={f.id}>
              <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">{f.name} total (₦)</label>
              <input type="number" min="0" step="0.01" name={`fund_${f.id}`} placeholder="0"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]" />
            </div>
          ))
        )}

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Total expenses (₦)</label>
          <input type="number" min="0" step="0.01" name="expenses" placeholder="0"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]" />
        </div>

        <p className="text-[11.5px] text-[var(--slate)]">
          Leave a fund or the expense total blank (or 0) to skip it. Saving replaces whatever was already on file for that month.
        </p>

        <button className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-2.5 text-[14.5px]">
          Save Month
        </button>
      </form>

      {months.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold mb-3">Months on file</h2>
          <div className="space-y-2">
            {months.map(([month, totals]) => (
              <div key={month} className="flex items-center justify-between bg-[var(--paper)] border border-[var(--line)] rounded-lg px-4 py-3">
                <div>
                  <p className="text-[13.5px] font-medium">{monthLabel(month)}</p>
                  <p className="text-[12px] text-[var(--slate)] mono mt-0.5">
                    Income ₦{totals.income.toLocaleString()} · Expenses ₦{totals.expenses.toLocaleString()}
                  </p>
                </div>
                <form action={deleteHistoricalMonth}>
                  <input type="hidden" name="branch_id" value={branchId} />
                  <input type="hidden" name="month" value={month} />
                  <button className="text-[11.5px] font-medium text-[var(--slate)] underline underline-offset-2">
                    Clear
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
