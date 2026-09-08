import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createOwnBranch, setMidweekDay, inviteStaff, addFund, toggleFund, cancelInvite, resendInvite } from "./actions";
import { BRANCH_ROLE_LABELS, WEEKDAY_LABELS, type BranchRole } from "@/lib/roles";
import InviteForm from "./InviteForm";

type BranchDetail = {
  id: string;
  name: string;
  address: string | null;
  closest_bus_stop: string | null;
  midweek_service_day: number | null;
  statement_deadline_dow: number;
  statement_deadline_time: string;
  region_id: string | null;
  regions: { name: string } | null;
};

type RegionStaffRow = {
  branch_id: string;
  role: BranchRole;
  app_users: { full_name: string; email: string; phone: string | null } | null;
};
type RegionBranchRow = { id: string; name: string };

type StaffRow = {
  role: BranchRole;
  app_users: { full_name: string; email: string; phone: string | null } | null;
};

type FundRow = { id: string; name: string; active: boolean; sort_order: number };
type PendingInviteRow = { id: string; email: string; full_name: string; role: BranchRole; invited_at: string };

export default async function BranchDashboard({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; cancelled?: string }>;
}) {
  const { sent, cancelled } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myStaffRows } = await supabase
    .from("branch_staff")
    .select("branch_id, role, church_branches(id, name, address, closest_bus_stop, midweek_service_day, statement_deadline_dow, statement_deadline_time, region_id, regions(name))")
    .eq("user_id", user.id);

  const branchRow = myStaffRows?.[0];
  const isSubAdmin = myStaffRows?.some((r) => r.role === "sub_admin") ?? false;

  if (!branchRow) {
    return (
      <div className="max-w-md">
        <h1 className="text-[22px] font-semibold mb-1">Welcome 👋</h1>
        <p className="text-sm text-[var(--slate)] mb-6">
          You&apos;re not attached to a branch yet. If you&apos;re a Pastor starting a new church, create it below —
          it&apos;s added to Super Admin&apos;s list automatically.
        </p>
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
          <form action={createOwnBranch} className="space-y-3">
            <Field label="Branch name" name="name" placeholder="MFM Bethel" required />
            <Field label="Address" name="address" placeholder="4 Grace Avenue, Ajah" />
            <Field label="Closest bus-stop" name="bus_stop" placeholder="Ajah Roundabout" />
            <Field label="Region" name="region" placeholder="Region 3" required />
            <button className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-2.5 text-[14.5px]">
              Create My Branch
            </button>
          </form>
        </div>
      </div>
    );
  }

  const branch = branchRow.church_branches as unknown as BranchDetail;

  const { data: staffRaw } = await supabase
    .from("branch_staff")
    .select("role, app_users!branch_staff_user_id_fkey(full_name, email, phone)")
    .eq("branch_id", branch.id);
  const staff = (staffRaw || []) as unknown as StaffRow[];

  const { data: fundsRaw } = await supabase
    .from("branch_funds")
    .select("id, name, active, sort_order")
    .eq("branch_id", branch.id)
    .order("sort_order");
  const funds = (fundsRaw || []) as FundRow[];

  const { data: pendingRaw } = await supabase
    .from("pending_invites")
    .select("id, email, full_name, role, invited_at")
    .eq("branch_id", branch.id)
    .is("accepted_at", null)
    .order("invited_at", { ascending: false });
  const pendingInvites = (pendingRaw || []) as PendingInviteRow[];

  // A Sub Admin can also see contact info for staff at other branches in
  // their own region — everyone else (including this branch's own
  // non-Sub-Admin staff) still only sees this branch. Uses the admin
  // client since this reaches beyond the viewer's own branch.
  let regionBranches: { branch: RegionBranchRow; staff: RegionStaffRow[] }[] = [];
  if (isSubAdmin && branch.region_id) {
    const admin = createAdminClient();
    const { data: siblingBranches } = await admin
      .from("church_branches")
      .select("id, name")
      .eq("region_id", branch.region_id)
      .neq("id", branch.id);
    const siblings = (siblingBranches || []) as RegionBranchRow[];
    if (siblings.length > 0) {
      const { data: regionStaffRaw } = await admin
        .from("branch_staff")
        .select("branch_id, role, app_users!branch_staff_user_id_fkey(full_name, email, phone)")
        .in("branch_id", siblings.map((b) => b.id));
      const regionStaff = (regionStaffRaw || []) as unknown as RegionStaffRow[];
      regionBranches = siblings
        .map((b) => ({ branch: b, staff: regionStaff.filter((s) => s.branch_id === b.id) }))
        .filter((b) => b.staff.length > 0);
    }
  }

  // Who's currently down as each role — accepted staff and unaccepted invites
  // together, deduped by email — used client-side to warn before creating a
  // second person on the same role.
  const roleHolders: Record<string, { name: string; email: string }[]> = {};
  const addHolder = (role: string, name: string, email: string) => {
    if (!email) return;
    const list = (roleHolders[role] ||= []);
    if (!list.some((h) => h.email.toLowerCase() === email.toLowerCase())) list.push({ name, email });
  };
  for (const s of staff) addHolder(s.role, s.app_users?.full_name || "", s.app_users?.email || "");
  for (const inv of pendingInvites) addHolder(inv.role, inv.full_name, inv.email);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold">{branch.name}</h1>
          <p className="text-sm text-[var(--slate)] mt-1">{branch.regions?.name || "No region set"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/branch/deposits"
            className="rounded-lg bg-[var(--paper)] border border-[var(--line)] text-[var(--navy)] font-semibold px-4 py-2.5 text-[13.5px] whitespace-nowrap">
            Weekly Deposits
          </Link>
          <Link href="/dashboard/branch/outflows"
            className="rounded-lg bg-[var(--paper)] border border-[var(--line)] text-[var(--navy)] font-semibold px-4 py-2.5 text-[13.5px] whitespace-nowrap">
            Outflow / Expenses
          </Link>
          <Link href="/dashboard/branch/analytics"
            className="rounded-lg bg-[var(--paper)] border border-[var(--line)] text-[var(--navy)] font-semibold px-4 py-2.5 text-[13.5px] whitespace-nowrap">
            Analytics
          </Link>
          <Link href="/dashboard/branch/services"
            className="rounded-lg bg-[var(--navy)] text-white font-semibold px-4 py-2.5 text-[13.5px] whitespace-nowrap">
            Service Records
          </Link>
        </div>
      </div>

      <section className="grid sm:grid-cols-2 gap-5">
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
          <h2 className="text-[15px] font-semibold mb-1">Services</h2>
          <p className="text-[13px] text-[var(--slate)] mb-3">
            Sunday service always happens. Pick which weekday carries this branch&apos;s mid-week service —
            Record of Activities gets filled for both, and the weekly cash deposit always covers both together.
          </p>
          {isSubAdmin ? (
            <form action={setMidweekDay} className="flex items-center gap-2">
              <input type="hidden" name="branch_id" value={branch.id} />
              <select name="midweek_day" defaultValue={branch.midweek_service_day ?? ""}
                className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px]">
                <option value="">Not set yet</option>
                {WEEKDAY_LABELS.map((d, i) => i !== 0 && <option key={i} value={i}>{d}</option>)}
              </select>
              <button className="rounded-lg bg-[var(--navy)] text-white font-semibold px-4 py-2.5 text-[13.5px] shrink-0">Save</button>
            </form>
          ) : (
            <p className="text-[14px]">{branch.midweek_service_day != null ? WEEKDAY_LABELS[branch.midweek_service_day] : "Not set yet"}</p>
          )}
        </div>

        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
          <h2 className="text-[15px] font-semibold mb-1">Weekly cash deposit</h2>
          <p className="text-[13px] text-[var(--slate)]">
            Recorded every week, always covering Sunday and mid-week together — due by
            {" "}<b className="text-[var(--ink)]">
            {WEEKDAY_LABELS[branch.statement_deadline_dow]} {formatTime(branch.statement_deadline_time)}
            </b> the week after.
          </p>
          <Link href="/dashboard/branch/deposits" className="inline-block mt-3 text-[13px] font-semibold text-[var(--navy)] underline underline-offset-2">
            Record this week&apos;s deposit &rarr;
          </Link>
          <p className="text-[12px] text-[var(--slate)] mt-3">Open a week above to check its deposit against the bank statement.</p>
        </div>
      </section>

      {isSubAdmin && (
        <section className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 max-w-md">
          <h2 className="text-[15px] font-semibold mb-3">Add someone to this branch</h2>
          {sent && (
            <div className="mb-3 bg-[var(--good-bg)] text-[var(--good)] rounded-lg px-3 py-2 text-[13px]">
              Invite sent to {sent}.
            </div>
          )}
          {cancelled && (
            <div className="mb-3 bg-[var(--ice)] text-[var(--navy)] rounded-lg px-3 py-2 text-[13px]">
              Invite cancelled.
            </div>
          )}
          <InviteForm branchId={branch.id} roleHolders={roleHolders} action={inviteStaff} />

          {pendingInvites.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--line)]">
              <h3 className="text-[13px] font-semibold text-[var(--slate)] mb-2">
                Waiting to accept ({pendingInvites.length})
              </h3>
              <div className="space-y-2">
                {pendingInvites.map((inv) => {
                  const hoursSince = (new Date().getTime() - new Date(inv.invited_at).getTime()) / 3_600_000;
                  const canResend = hoursSince >= 24;
                  return (
                    <div key={inv.id} className="flex items-center justify-between bg-[var(--ice)] rounded-lg px-3 py-2">
                      <div>
                        <p className="text-[13px] font-medium">{inv.full_name || inv.email}</p>
                        <p className="text-[11.5px] text-[var(--slate)]">
                          {inv.email} &middot; {BRANCH_ROLE_LABELS[inv.role]} &middot; invited {new Date(inv.invited_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {canResend && (
                          <form action={resendInvite}>
                            <input type="hidden" name="branch_id" value={branch.id} />
                            <input type="hidden" name="invite_id" value={inv.id} />
                            <button className="text-[11.5px] font-medium text-[var(--navy)] underline underline-offset-2">
                              Resend
                            </button>
                          </form>
                        )}
                        <form action={cancelInvite}>
                          <input type="hidden" name="branch_id" value={branch.id} />
                          <input type="hidden" name="invite_id" value={inv.id} />
                          <button className="text-[11.5px] font-medium text-[var(--slate)] underline underline-offset-2">
                            Cancel
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11.5px] text-[var(--slate)] mt-2">
                A Resend button appears once an invite has waited 24 hours unanswered — or fill in the same email and role above and send again any time.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="max-w-md">
        <h2 className="text-[15px] font-semibold mb-1">Funds</h2>
        <p className="text-[13px] text-[var(--slate)] mb-3">
          Cash is counted separately per fund on every service&apos;s entry form. Retire a fund instead of deleting it —
          past records that used it stay intact either way.
        </p>
        <div className="space-y-2 mb-3">
          {funds.map((f) => (
            <div key={f.id} className="flex items-center justify-between bg-[var(--paper)] border border-[var(--line)] rounded-lg px-4 py-2.5">
              <span className={`text-[14px] ${f.active ? "" : "line-through text-[var(--slate)]"}`}>{f.name}</span>
              {isSubAdmin && (
                <form action={toggleFund}>
                  <input type="hidden" name="branch_id" value={branch.id} />
                  <input type="hidden" name="fund_id" value={f.id} />
                  <input type="hidden" name="active" value={String(f.active)} />
                  <button className="text-[12px] font-medium text-[var(--slate)] underline underline-offset-2">
                    {f.active ? "Retire" : "Reactivate"}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
        {isSubAdmin && (
          <form action={addFund} className="flex items-center gap-2">
            <input type="hidden" name="branch_id" value={branch.id} />
            <input name="name" placeholder="e.g. Building Fund" required
              className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]" />
            <button className="rounded-lg bg-[var(--brass)] text-[#1B2233] font-semibold px-4 py-2.5 text-[13.5px] shrink-0">Add</button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-[15px] font-semibold mb-3">Everyone at this branch</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {staff.map((s, i) => (
            <div key={i} className="bg-[var(--paper)] border border-[var(--line)] rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium">{s.app_users?.full_name}</p>
                <p className="text-[12px] text-[var(--slate)]">{s.app_users?.email}</p>
                {s.app_users?.phone && <p className="text-[12px] text-[var(--slate)]">{s.app_users.phone}</p>}
              </div>
              <span className="mono text-[10px] uppercase tracking-wide bg-[var(--ice)] text-[var(--navy)] px-2 py-1 rounded-full">
                {BRANCH_ROLE_LABELS[s.role as keyof typeof BRANCH_ROLE_LABELS]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {isSubAdmin && regionBranches.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold mb-1">Other branches in {branch.regions?.name}</h2>
          <p className="text-[13px] text-[var(--slate)] mb-3">
            Visible to you as this branch&apos;s Sub Admin — everyone else only sees their own branch.
          </p>
          <div className="space-y-4">
            {regionBranches.map(({ branch: b, staff: s }) => (
              <div key={b.id}>
                <p className="text-[13px] font-semibold text-[var(--slate)] mb-2">{b.name}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {s.map((person, i) => (
                    <div key={i} className="bg-[var(--paper)] border border-[var(--line)] rounded-lg px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-medium">{person.app_users?.full_name}</p>
                        <p className="text-[12px] text-[var(--slate)]">{person.app_users?.email}</p>
                        {person.app_users?.phone && <p className="text-[12px] text-[var(--slate)]">{person.app_users.phone}</p>}
                      </div>
                      <span className="mono text-[10px] uppercase tracking-wide bg-[var(--ice)] text-[var(--navy)] px-2 py-1 rounded-full">
                        {BRANCH_ROLE_LABELS[person.role as keyof typeof BRANCH_ROLE_LABELS]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

function Field(props: { label: string; name: string; placeholder?: string; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">{props.label}</label>
      <input
        name={props.name}
        type={props.type || "text"}
        placeholder={props.placeholder}
        required={props.required}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
      />
    </div>
  );
}
