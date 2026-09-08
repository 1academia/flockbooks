"use client";

import { BRANCH_ROLE_LABELS, SUB_ADMIN_ASSIGNABLE_ROLES, type BranchRole } from "@/lib/roles";

type RoleHolder = { name: string; email: string };

export default function InviteForm({
  branchId,
  roleHolders,
  action,
}: {
  branchId: string;
  roleHolders: Record<string, RoleHolder[]>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const role = String(new FormData(form).get("role") || "");
    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();

    const others = (roleHolders[role] || []).filter((h) => h.email.toLowerCase() !== email);
    if (others.length > 0) {
      const names = others.map((h) => h.name || h.email).join(", ");
      const roleLabel = BRANCH_ROLE_LABELS[role as BranchRole] || role;
      const ok = window.confirm(
        `${names} ${others.length === 1 ? "is" : "are"} already down as ${roleLabel} at this branch.\n\n` +
        `Send another invite for ${roleLabel} to a different person anyway?`
      );
      if (!ok) {
        e.preventDefault();
        return;
      }
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="branch_id" value={branchId} />
      <div>
        <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Full name</label>
        <input
          name="name" placeholder="Jane Doe" required
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Email</label>
        <input
          name="email" type="email" placeholder="jane@church.org" required
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">
          Phone <span className="font-normal text-[var(--slate)]">(optional — for WhatsApp/SMS)</span>
        </label>
        <input
          name="phone" type="tel" placeholder="+234 801 234 5678"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">Role</label>
        <select name="role" required className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px]">
          {SUB_ADMIN_ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{BRANCH_ROLE_LABELS[r]}</option>)}
        </select>
      </div>
      <button className="w-full rounded-lg bg-[var(--brass)] text-[#1B2233] font-semibold py-2.5 text-[14.5px]">
        Send Invite
      </button>
    </form>
  );
}
