import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteOutflow, viewReceipt } from "./actions";
import BackLink from "../../back-link";

type OutflowRow = {
  id: string;
  expense_date: string;
  amount: number;
  paid_to: string;
  reason: string;
  payment_method: string;
  receipt_photo_path: string | null;
  fund_id: string | null;
};
type FundRow = { id: string; name: string };

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash", transfer: "Transfer", cheque: "Cheque", other: "Other",
};

export default async function OutflowsListPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRows } = await supabase.from("branch_staff").select("branch_id").eq("user_id", user.id);
  const branchId = staffRows?.[0]?.branch_id as string | undefined;
  if (!branchId) redirect("/dashboard/branch");

  const { data: fundsRaw } = await supabase.from("branch_funds").select("id, name").eq("branch_id", branchId);
  const fundName = new Map((fundsRaw as FundRow[] | null || []).map((f) => [f.id, f.name]));

  const { data: outflowsRaw } = await supabase
    .from("outflows")
    .select("id, expense_date, amount, paid_to, reason, payment_method, receipt_photo_path, fund_id")
    .eq("branch_id", branchId)
    .order("expense_date", { ascending: false })
    .limit(100);
  const outflows = (outflowsRaw || []) as OutflowRow[];

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthTotal = outflows
    .filter((o) => o.expense_date.startsWith(monthPrefix))
    .reduce((sum, o) => sum + Number(o.amount), 0);

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/branch" label="Branch dashboard" />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold">Outflow / Expenses</h1>
          <p className="text-sm text-[var(--slate)] mt-1">Every expense paid out, with evidence of what it was for.</p>
        </div>
        <Link href="/dashboard/branch/outflows/new"
          className="rounded-lg bg-[var(--navy)] text-white font-semibold px-4 py-2.5 text-[13.5px] whitespace-nowrap">
          Record an Expense
        </Link>
      </div>

      {deleted && (
        <div className="bg-[var(--ice)] text-[var(--navy)] rounded-lg px-3 py-2 text-[13px] max-w-md">
          Expense removed.
        </div>
      )}

      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 max-w-md">
        <p className="text-[13px] text-[var(--slate)]">This month&apos;s total spent</p>
        <p className="mono text-[22px] font-semibold text-[var(--navy)] mt-1">₦{thisMonthTotal.toLocaleString()}</p>
      </div>

      {outflows.length === 0 ? (
        <p className="text-sm text-[var(--slate)]">No expenses recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {outflows.map((o) => (
            <div key={o.id} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl px-5 py-3.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[14.5px] font-medium">{o.paid_to}</p>
                  <p className="text-[12.5px] text-[var(--slate)] mt-0.5">
                    {o.expense_date} &middot; {PAYMENT_METHOD_LABELS[o.payment_method] || o.payment_method}
                    {o.fund_id && fundName.get(o.fund_id) ? ` · ${fundName.get(o.fund_id)}` : ""}
                  </p>
                  <p className="text-[13px] mt-1.5">{o.reason}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="mono text-[14.5px] font-semibold">₦{Number(o.amount).toLocaleString()}</p>
                  <div className="flex items-center gap-3 mt-1 justify-end">
                    {o.receipt_photo_path && (
                      <form action={viewReceipt}>
                        <input type="hidden" name="branch_id" value={branchId} />
                        <input type="hidden" name="outflow_id" value={o.id} />
                        <button className="text-[11.5px] font-medium text-[var(--navy)] underline underline-offset-2">
                          Receipt
                        </button>
                      </form>
                    )}
                    <form action={deleteOutflow}>
                      <input type="hidden" name="branch_id" value={branchId} />
                      <input type="hidden" name="outflow_id" value={o.id} />
                      <button className="text-[11.5px] font-medium text-[var(--slate)] underline underline-offset-2">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
