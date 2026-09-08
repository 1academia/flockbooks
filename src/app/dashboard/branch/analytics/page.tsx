import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { recentMonthKeys, monthLabel, monthShortLabel, sameMonthLastYear } from "@/lib/months";
import BackLink from "../../back-link";

// service_cash_counts -> service_records is a many-to-one relation, so the
// `!inner` join comes back as a single nested object per row, not an array.
type CashCountRow = {
  total: number;
  fund_name: string;
  service_records: { service_date: string } | { service_date: string }[];
};
type OutflowRow = { amount: number; expense_date: string };
type HistoricalRow = { month: string; kind: "income" | "expense"; amount: number };

function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// Supabase's generated types sometimes report an inner-joined singular
// relation as an array even though a row can only ever have one — this
// normalizes either shape.
function oneServiceDate(rel: CashCountRow["service_records"]): string | undefined {
  return Array.isArray(rel) ? rel[0]?.service_date : rel?.service_date;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRows } = await supabase.from("branch_staff").select("branch_id").eq("user_id", user.id);
  const branchId = staffRows?.[0]?.branch_id as string | undefined;
  if (!branchId) redirect("/dashboard/branch");

  // 13 months back covers a 12-month trend chart AND gives us "the same
  // month, last year" for the current month's year-on-year comparison.
  const months = recentMonthKeys(13);
  const currentMonth = months[months.length - 1];

  // The year-over-year comparison can be pointed at any month (not just
  // the current one) — e.g. comparing January 2025 against January 2026 —
  // via ?month=, so the query window has to stretch back far enough to
  // cover whichever month (and its year-ago counterpart) was picked.
  const selectedMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth;
  const selectedLastYear = sameMonthLastYear(selectedMonth);
  const earliestNeeded = [months[0], selectedMonth, selectedLastYear].sort()[0];
  const earliestDate = `${earliestNeeded}-01`;

  const { data: cashRaw } = await supabase
    .from("service_cash_counts")
    .select("total, fund_name, service_records!inner(service_date, branch_id)")
    .eq("service_records.branch_id", branchId)
    .gte("service_records.service_date", earliestDate);
  const cashCounts = (cashRaw || []) as unknown as CashCountRow[];

  const { data: outflowsRaw } = await supabase
    .from("outflows")
    .select("amount, expense_date")
    .eq("branch_id", branchId)
    .gte("expense_date", earliestDate);
  const outflows = (outflowsRaw || []) as OutflowRow[];

  // Months entered by hand for periods before FlockBooks was in use (see
  // /dashboard/branch/historical) — merged in alongside the live totals
  // above so old and new data appear on the same chart without double
  // counting (a month realistically has one or the other, not both).
  const { data: historicalRaw } = await supabase
    .from("historical_monthly_totals")
    .select("month, kind, amount")
    .eq("branch_id", branchId)
    .is("superseded_at", null)
    .gte("month", earliestDate);
  const historical = (historicalRaw || []) as HistoricalRow[];

  const incomeByMonth = new Map<string, number>();
  const incomeByFundThisMonth = new Map<string, number>();
  for (const row of cashCounts) {
    const serviceDate = oneServiceDate(row.service_records);
    if (!serviceDate) continue;
    const mk = monthKeyOf(serviceDate);
    incomeByMonth.set(mk, (incomeByMonth.get(mk) || 0) + Number(row.total));
    if (mk === currentMonth) {
      incomeByFundThisMonth.set(row.fund_name, (incomeByFundThisMonth.get(row.fund_name) || 0) + Number(row.total));
    }
  }

  const expenseByMonth = new Map<string, number>();
  for (const row of outflows) {
    const mk = monthKeyOf(row.expense_date);
    expenseByMonth.set(mk, (expenseByMonth.get(mk) || 0) + Number(row.amount));
  }

  for (const row of historical) {
    const mk = monthKeyOf(row.month);
    const map = row.kind === "income" ? incomeByMonth : expenseByMonth;
    map.set(mk, (map.get(mk) || 0) + Number(row.amount));
  }

  const trend = months.map((mk) => ({
    monthKey: mk,
    income: incomeByMonth.get(mk) || 0,
    expenses: expenseByMonth.get(mk) || 0,
  }));

  const selectedIncome = incomeByMonth.get(selectedMonth) || 0;
  const selectedExpenses = expenseByMonth.get(selectedMonth) || 0;
  const selectedLastYearIncome = incomeByMonth.get(selectedLastYear) || 0;
  const selectedLastYearExpenses = expenseByMonth.get(selectedLastYear) || 0;

  const maxBar = Math.max(1, ...trend.map((t) => Math.max(t.income, t.expenses)));
  const fundRows = [...incomeByFundThisMonth.entries()].sort((a, b) => b[1] - a[1]);
  const maxFund = Math.max(1, ...fundRows.map(([, v]) => v));

  return (
    <div className="space-y-8">
      <BackLink href="/dashboard/branch" label="Branch dashboard" />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold">Analytics</h1>
          <p className="text-sm text-[var(--slate)] mt-1">Income and outflow trends, and how a month compares to the same month last year.</p>
        </div>
        <Link href="/dashboard/branch/historical"
          className="text-[12.5px] font-medium text-[var(--navy)] underline underline-offset-2 whitespace-nowrap">
          Add records from before FlockBooks &rarr;
        </Link>
      </div>

      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
        <form method="get" className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-[12px] font-medium text-[var(--slate)] mb-1">Compare this month against last year</label>
            <input type="month" name="month" defaultValue={selectedMonth}
              className="rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2 text-[14px] outline-none focus:border-[var(--navy)]" />
          </div>
          <button className="rounded-lg bg-[var(--navy)] text-white font-semibold px-4 py-2 text-[13.5px]">Compare</button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <YoyCard
          label={`Income · ${monthLabel(selectedMonth)}`}
          current={selectedIncome}
          previous={selectedLastYearIncome}
          previousLabel={monthLabel(selectedLastYear)}
          goodWhenUp
        />
        <YoyCard
          label={`Expenses · ${monthLabel(selectedMonth)}`}
          current={selectedExpenses}
          previous={selectedLastYearExpenses}
          previousLabel={monthLabel(selectedLastYear)}
          goodWhenUp={false}
        />
      </div>

      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[13px] font-medium text-[var(--slate)]">Last 12 months</p>
          <div className="flex items-center gap-4 text-[11.5px] text-[var(--slate)]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--navy)] inline-block" /> Income</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--brass)] inline-block" /> Expenses</span>
          </div>
        </div>
        <div className="mt-5 flex items-end gap-2 h-40 overflow-x-auto">
          {trend.map((t) => (
            <div key={t.monthKey} className="flex flex-col items-center gap-1 flex-1 min-w-[34px] h-full justify-end">
              <div className="flex items-end gap-0.5 h-full w-full justify-center">
                <div
                  title={`Income ₦${t.income.toLocaleString()}`}
                  className="w-2.5 bg-[var(--navy)] rounded-t-sm"
                  style={{ height: `${(t.income / maxBar) * 100}%` }}
                />
                <div
                  title={`Expenses ₦${t.expenses.toLocaleString()}`}
                  className="w-2.5 bg-[var(--brass)] rounded-t-sm"
                  style={{ height: `${(t.expenses / maxBar) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--slate)] mono">{monthShortLabel(t.monthKey)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
        <p className="text-[13px] font-medium text-[var(--slate)]">
          Income by fund · {monthLabel(currentMonth)}
        </p>
        {fundRows.length === 0 ? (
          <p className="text-sm text-[var(--slate)] mt-3">No service records this month yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {fundRows.map(([name, total]) => (
              <div key={name}>
                <div className="flex items-center justify-between text-[12.5px] mb-1">
                  <span>{name}</span>
                  <span className="mono font-medium">₦{total.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--ice)] overflow-hidden">
                  <div className="h-full bg-[var(--navy)] rounded-full" style={{ width: `${(total / maxFund) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function YoyCard({
  label, current, previous, previousLabel, goodWhenUp,
}: {
  label: string; current: number; previous: number; previousLabel: string; goodWhenUp: boolean;
}) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const isUp = change >= 0;
  const isGood = goodWhenUp ? isUp : !isUp;
  const showChange = previous > 0 || current > 0;
  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
      <p className="text-[13px] text-[var(--slate)]">{label}</p>
      <p className="mono text-[22px] font-semibold text-[var(--navy)] mt-1">₦{current.toLocaleString()}</p>
      <p className="text-[12px] text-[var(--slate)] mt-1.5">
        {previousLabel}: ₦{previous.toLocaleString()}
        {showChange && (
          <span className={`ml-2 font-medium ${isGood ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(0)}%
          </span>
        )}
      </p>
    </div>
  );
}
