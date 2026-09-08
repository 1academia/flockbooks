import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBranch, invitePastor } from "./actions";

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  closest_bus_stop: string | null;
  created_via: string;
  regions: { name: string } | null;
};

type PastorRow = {
  branch_id: string;
  app_users: { full_name: string; email: string } | null;
};

export default async function SuperAdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("app_users").select("platform_role").eq("id", user.id).maybeSingle();
  if (profile?.platform_role !== "super_admin") redirect("/dashboard/branch");

  const { data: branches } = await supabase
    .from("church_branches")
    .select("id, name, address, closest_bus_stop, created_via, regions(name)")
    .order("created_at", { ascending: false });

  const { data: pastors } = await supabase
    .from("branch_staff")
    .select("branch_id, app_users!branch_staff_user_id_fkey(full_name, email)")
    .eq("role", "sub_admin");

  const pastorByBranch = new Map<string, { full_name: string; email: string }>();
  ((pastors || []) as unknown as PastorRow[]).forEach((p) => {
    if (p.app_users) pastorByBranch.set(p.branch_id, p.app_users);
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold">Super Admin</h1>
        <p className="text-sm text-[var(--slate)] mt-1">Every church branch, across every region.</p>
      </div>

      <section className="grid sm:grid-cols-2 gap-5">
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
          <h2 className="text-[16px] font-semibold mb-3">Create a Church Branch</h2>
          <form action={createBranch} className="space-y-3">
            <Field label="Branch name" name="name" placeholder="MFM Lekki YC" required />
            <Field label="Address" name="address" placeholder="12 Freedom Way, Lekki" />
            <Field label="Closest bus-stop" name="bus_stop" placeholder="Chevron" />
            <Field label="Region" name="region" placeholder="Region 3" required />
            <button className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-2.5 text-[14.5px]">
              Create Branch
            </button>
          </form>
        </div>

        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
          <h2 className="text-[16px] font-semibold mb-3">Create a Pastor (Sub Admin)</h2>
          <p className="text-[13px] text-[var(--slate)] mb-3">
            A Pastor is automatically that branch&apos;s Sub Admin. They&apos;ll get an email with a sign-in link.
          </p>
          <form action={invitePastor} className="space-y-3">
            <Field label="Full name" name="name" placeholder="Pastor Tobi Popoola" required />
            <Field label="Email" name="email" type="email" placeholder="pastor@church.org" required />
            <div>
              <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Branch</label>
              <select name="branch_id" required className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px]">
                <option value="">Choose a branch…</option>
                {((branches || []) as unknown as BranchRow[]).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <button className="w-full rounded-lg bg-[var(--brass)] text-[#1B2233] font-semibold py-2.5 text-[14.5px]">
              Send Invite
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="text-[16px] font-semibold mb-3">All branches ({(branches || []).length})</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {((branches || []) as unknown as BranchRow[]).map((b) => {
            const pastor = pastorByBranch.get(b.id);
            return (
              <div key={b.id} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[15px]">{b.name}</h3>
                  <span className={`mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                    b.created_via === "self_serve" ? "bg-[var(--good-bg)] text-[var(--good)]" : "bg-[var(--ice)] text-[var(--navy)]"
                  }`}>
                    {b.created_via === "self_serve" ? "self-served" : "by you"}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--slate)] mt-1">{b.regions?.name || "No region"}</p>
                {b.address && <p className="text-[12.5px] text-[var(--slate)] mt-2">{b.address}</p>}
                {b.closest_bus_stop && <p className="text-[12px] text-[var(--slate)]">Near {b.closest_bus_stop}</p>}
                <div className="mt-3 pt-3 border-t border-[var(--line)] text-[12.5px]">
                  {pastor ? (
                    <span>Pastor: <b>{pastor.full_name}</b></span>
                  ) : (
                    <span className="text-[var(--slate)]">No Pastor assigned yet</span>
                  )}
                </div>
              </div>
            );
          })}
          {(branches || []).length === 0 && (
            <p className="text-sm text-[var(--slate)]">No branches yet — create the first one above.</p>
          )}
        </div>
      </section>
    </div>
  );
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
