import { redirect, notFound } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { signedPhotoUrl } from "@/lib/storage";
import { weekSundayOf, weekLabel } from "@/lib/weeks";
import { recordDeposit, verifyStatement } from "../actions";
import BackLink from "../../../back-link";

type ServiceRow = { id: string; service_date: string; service_type: string; grand_total: number };
type DepositRow = {
  amount: number;
  teller_attached: boolean;
  teller_slip_photo_path: string | null;
  statement_uploaded: boolean;
  statement_amount: number | null;
  statement_photo_path: string | null;
  status: string;
};

export default async function DepositWeekPage({ params }: { params: Promise<{ weekStart: string }> }) {
  const { weekStart } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staffRows } = await supabase.from("branch_staff").select("branch_id").eq("user_id", user.id);
  const branchId = staffRows?.[0]?.branch_id as string | undefined;
  if (!branchId) redirect("/dashboard/branch");

  const sunday = weekSundayOf(weekStart);
  const admin = createAdminClient();

  const { data: servicesRaw } = await admin
    .from("service_records")
    .select("id, service_date, service_type, grand_total")
    .eq("branch_id", branchId)
    .gte("service_date", weekStart)
    .lte("service_date", sunday)
    .order("service_date");
  const services = (servicesRaw || []) as ServiceRow[];
  const expected = services.reduce((sum, s) => sum + Number(s.grand_total), 0);

  const { data: depositRaw } = await admin
    .from("weekly_cash_deposits")
    .select("amount, teller_attached, teller_slip_photo_path, statement_uploaded, statement_amount, statement_photo_path, status")
    .eq("branch_id", branchId).eq("week_start", weekStart).maybeSingle();
  const d = depositRaw as DepositRow | null;
  const photoUrl = await signedPhotoUrl(d?.teller_slip_photo_path || null);
  const statementUrl = await signedPhotoUrl(d?.statement_photo_path || null);
  const statementIsPdf = (d?.statement_photo_path || "").toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-6 max-w-md">
      <BackLink href="/dashboard/branch/deposits" label="Weekly Deposits" />
      <div>
        <h1 className="text-[22px] font-semibold">{weekLabel(weekStart)}</h1>
        <p className="text-sm text-[var(--slate)] mt-1">Weekly cash deposit — covers Sunday and mid-week together.</p>
      </div>

      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
        <h2 className="text-[14px] font-semibold mb-2">This week&apos;s services</h2>
        {services.length === 0 ? (
          <p className="text-[13px] text-[var(--slate)]">No service records for this week yet.</p>
        ) : (
          <div className="space-y-1.5">
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[13.5px]">
                <span>{s.service_date} &middot; {s.service_type === "sunday" ? "Sunday" : "Mid-week"}</span>
                <span className="mono">₦{Number(s.grand_total).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-[13.5px] font-semibold pt-1.5 border-t border-[var(--line)]">
              <span>Expected total</span>
              <span className="mono">₦{expected.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {d && (
        <div className="bg-[var(--good-bg)] rounded-xl p-4 text-[13px] text-[var(--good)]">
          Already recorded: ₦{Number(d.amount).toLocaleString()}
          {d.teller_attached ? " · Teller slip attached" : ""}.
          {photoUrl && <> <a href={photoUrl} target="_blank" rel="noreferrer" className="underline">View photo</a></>}
          {" "}You can update it below if it needs correcting.
        </div>
      )}

      <form action={recordDeposit} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 space-y-4">
        <input type="hidden" name="branch_id" value={branchId} />
        <input type="hidden" name="week_start" value={weekStart} />

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Amount deposited (₦)</label>
          <input
            name="amount" type="number" step="0.01" min="0" required
            defaultValue={d ? Number(d.amount) : expected || undefined}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
          />
        </div>

        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" name="teller_attached" defaultChecked={d?.teller_attached} className="w-4 h-4" />
          Teller slip attached
        </label>

        <div>
          <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">
            Photo of the teller slip{d ? " (leave blank to keep the current one)" : ""}
          </label>
          <input
            name="teller_slip_photo" type="file" accept="image/*" capture="environment"
            required={!d}
            className="w-full text-[13.5px]"
          />
        </div>

        <button className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-2.5 text-[14.5px]">
          {d ? "Update Deposit" : "Record Deposit"}
        </button>
      </form>

      {d && (
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-[14px] font-semibold mb-1">Bank statement</h2>
            <p className="text-[12.5px] text-[var(--slate)]">
              Check what the bank statement shows for this week against what was recorded above.
            </p>
          </div>

          {d.statement_uploaded && (
            d.status === "verified" ? (
              <div className="bg-[var(--good-bg)] text-[var(--good)] rounded-lg px-3 py-2.5 text-[13px]">
                Verified — the statement matches the ₦{Number(d.amount).toLocaleString()} recorded.
                {statementUrl && <> <a href={statementUrl} target="_blank" rel="noreferrer" className="underline">
                  View {statementIsPdf ? "statement (PDF)" : "photo"}</a></>}
              </div>
            ) : (
              <div className="bg-[var(--bad-bg)] text-[var(--bad)] rounded-lg px-3 py-2.5 text-[13px]">
                Mismatch — the statement shows ₦{Number(d.statement_amount).toLocaleString()}, but
                ₦{Number(d.amount).toLocaleString()} was recorded as deposited. Double-check both and correct
                whichever is wrong.
                {statementUrl && <> <a href={statementUrl} target="_blank" rel="noreferrer" className="underline">
                  View {statementIsPdf ? "statement (PDF)" : "photo"}</a></>}
              </div>
            )
          )}

          <form action={verifyStatement} className="space-y-4">
            <input type="hidden" name="branch_id" value={branchId} />
            <input type="hidden" name="week_start" value={weekStart} />

            <div>
              <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">
                Amount shown on the statement (₦)
              </label>
              <input
                name="statement_amount" type="number" step="0.01" min="0" required
                defaultValue={d.statement_amount != null ? Number(d.statement_amount) : Number(d.amount)}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">
                Statement photo or PDF{d.statement_uploaded ? " (leave blank to keep the current one)" : ""}
              </label>
              <input
                name="statement_file" type="file" accept="image/*,application/pdf"
                required={!d.statement_uploaded}
                className="w-full text-[13.5px]"
              />
            </div>

            <button className="w-full rounded-lg bg-[var(--brass)] text-[#1B2233] font-semibold py-2.5 text-[14.5px]">
              {d.statement_uploaded ? "Re-check Statement" : "Verify Deposit"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
