import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayInAppTimezone } from "@/lib/dates";
import { recordOutflow } from "../actions";

type FundRow = { id: string; name: string; active: boolean };

export default async function NewOutflowPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRows } = await supabase.from("branch_staff").select("branch_id").eq("user_id", user.id);
  const branchId = staffRows?.[0]?.branch_id as string | undefined;
  if (!branchId) redirect("/dashboard/branch");

  const { data: fundsRaw } = await supabase
    .from("branch_funds")
    .select("id, name, active")
    .eq("branch_id", branchId)
    .eq("active", true)
    .order("sort_order");
  const funds = (fundsRaw || []) as FundRow[];

  const today = todayInAppTimezone();

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <Link href="/dashboard/branch/outflows" className="text-[12.5px] text-[var(--slate)] underline underline-offset-2">
          &larr; Outflow / Expenses
        </Link>
        <h1 className="text-[22px] font-semibold mt-2">Record an Expense</h1>
        <p className="text-sm text-[var(--slate)] mt-1">A photo of the receipt or payment voucher is required as evidence.</p>
      </div>

      <form action={recordOutflow} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 space-y-4">
        <input type="hidden" name="branch_id" value={branchId} />

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Date</label>
          <input
            name="expense_date" type="date" required defaultValue={today}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Amount (₦)</label>
          <input
            name="amount" type="number" step="0.01" min="0.01" required
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Paid to</label>
          <input
            name="paid_to" type="text" placeholder="e.g. ABC Electrical Services" required
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Reason</label>
          <input
            name="reason" type="text" placeholder="e.g. Generator repair" required
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Payment method</label>
          <select name="payment_method" defaultValue="cash"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px]">
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </div>

        {funds.length > 0 && (
          <div>
            <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">
              Fund <span className="font-normal text-[var(--slate)]">(optional — which fund this was paid from)</span>
            </label>
            <select name="fund_id" defaultValue=""
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px]">
              <option value="">Not tied to a specific fund</option>
              {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">
            Receipt or payment voucher photo
          </label>
          <input
            name="receipt_photo" type="file" accept="image/*,application/pdf" capture="environment" required
            className="w-full text-[13.5px]"
          />
        </div>

        <button className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-2.5 text-[14.5px]">
          Record Expense
        </button>
      </form>
    </div>
  );
}
