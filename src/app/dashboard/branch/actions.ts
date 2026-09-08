"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendInviteEmail, sendNewBranchNoticeEmail, sendDuplicateRoleAlertEmail } from "@/lib/resend";
import { sendInviteWhatsApp, sendInviteSMS } from "@/lib/messaging";
import { SUB_ADMIN_ASSIGNABLE_ROLES, BRANCH_ROLE_LABELS, type BranchRole } from "@/lib/roles";
import { currentUser as getCurrentUser, requireSubAdmin } from "@/lib/authz";

async function currentUser() {
  const supabase = await createClient();
  const { id, email, fullName } = await getCurrentUser(supabase);
  return { user: { id, email }, fullName };
}

// A Pastor creating their own branch: it's added to Super Admin's list
// automatically, no approval step, and the creator becomes its Sub Admin.
export async function createOwnBranch(formData: FormData) {
  const { user, fullName } = await currentUser();
  const admin = createAdminClient();

  const regionName = String(formData.get("region") || "").trim();
  let regionId: string | null = null;
  if (regionName) {
    const { data: existingRegion } = await admin.from("regions").select("id").eq("name", regionName).maybeSingle();
    regionId = existingRegion
      ? existingRegion.id
      : (await admin.from("regions").insert({ name: regionName }).select("id").single()).data?.id;
  }

  const { data: branch, error } = await admin.from("church_branches").insert({
    name: String(formData.get("name") || "").trim(),
    address: String(formData.get("address") || "").trim() || null,
    closest_bus_stop: String(formData.get("bus_stop") || "").trim() || null,
    region_id: regionId,
    created_via: "self_serve",
    created_by: user.id,
  }).select("id, name").single();
  if (error) throw error;

  await admin.from("branch_staff").insert({
    branch_id: branch.id, user_id: user.id, role: "sub_admin", accepted_at: new Date().toISOString(),
  });

  // Heads-up to every Super Admin — not a gate, just visibility.
  const { data: superAdmins } = await admin.from("app_users").select("email").eq("platform_role", "super_admin");
  for (const sa of superAdmins || []) {
    await sendNewBranchNoticeEmail({
      to: sa.email, branchName: branch.name, region: regionName || "no region set", createdByName: fullName,
    });
  }

  revalidatePath("/dashboard/branch");
}

export async function setMidweekDay(formData: FormData) {
  const { user } = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  const day = formData.get("midweek_day");

  await requireSubAdmin(branchId, user.id, admin, "Only that branch's Sub Admin can set this");

  await admin.from("church_branches")
    .update({ midweek_service_day: day === "" ? null : Number(day) })
    .eq("id", branchId);

  revalidatePath("/dashboard/branch");
}

export async function inviteStaff(formData: FormData) {
  const { user, fullName } = await currentUser();
  const admin = createAdminClient();

  const branchId = String(formData.get("branch_id") || "");
  const role = String(formData.get("role") || "") as BranchRole;
  if (!SUB_ADMIN_ASSIGNABLE_ROLES.includes(role)) throw new Error("Not an assignable role");

  await requireSubAdmin(branchId, user.id, admin, "Only that branch's Sub Admin can invite staff");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const { data: branch } = await admin.from("church_branches").select("name").eq("id", branchId).single();

  // Inviting the same email+role again (e.g. because the first invite email
  // never seemed to arrive) used to hit a unique-constraint crash and show the
  // person a broken error page. Now it's treated as "resend": update the
  // timestamp and send the email again, same as a fresh invite.
  const { data: existingInvite } = await admin.from("pending_invites")
    .select("id").eq("branch_id", branchId).eq("email", email).eq("role", role).maybeSingle();

  const isNewPerson = !existingInvite;

  if (existingInvite) {
    await admin.from("pending_invites")
      .update({ full_name: name, phone, invited_by: user.id, invited_at: new Date().toISOString() })
      .eq("id", existingInvite.id);
  } else {
    const { error } = await admin.from("pending_invites").insert({
      branch_id: branchId, email, full_name: name, phone, role, invited_by: user.id,
    });
    if (error) throw error;
  }

  const branchName = branch?.name || "your branch";
  await sendInviteEmail({ to: email, fullName: name, role, branchName, invitedByName: fullName });
  if (phone) {
    await sendInviteWhatsApp({ to: phone, fullName: name, role, branchName, invitedByName: fullName });
    await sendInviteSMS({ to: phone, fullName: name, role, branchName, invitedByName: fullName });
  }

  // Only worth flagging when this invite added a genuinely new person to the
  // role (not just a resend to the same email) — otherwise the sub admin
  // would get this alert every time they resend the same invite.
  if (isNewPerson && user.email) {
    await alertIfRoleHasMultiplePeople({ admin, branchId, branchName, role, notifyEmail: user.email });
  }

  revalidatePath("/dashboard/branch");
  redirect(`/dashboard/branch?sent=${encodeURIComponent(email)}`);
}

// One-click resend for an invite that's been sitting unanswered — re-sends
// exactly what was already on file (no form to refill) and bumps invited_at,
// which also resets the 24-hour wait before this button shows again.
export async function resendInvite(formData: FormData) {
  const { user, fullName } = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await requireSubAdmin(branchId, user.id, admin);

  const inviteId = String(formData.get("invite_id") || "");
  const { data: invite } = await admin.from("pending_invites")
    .select("email, full_name, phone, role").eq("id", inviteId).eq("branch_id", branchId).maybeSingle();
  if (!invite) throw new Error("Invite not found");

  await admin.from("pending_invites").update({ invited_at: new Date().toISOString() }).eq("id", inviteId);

  const { data: branch } = await admin.from("church_branches").select("name").eq("id", branchId).single();
  const branchName = branch?.name || "your branch";
  await sendInviteEmail({ to: invite.email, fullName: invite.full_name, role: invite.role, branchName, invitedByName: fullName });
  if (invite.phone) {
    await sendInviteWhatsApp({ to: invite.phone, fullName: invite.full_name, role: invite.role, branchName, invitedByName: fullName });
    await sendInviteSMS({ to: invite.phone, fullName: invite.full_name, role: invite.role, branchName, invitedByName: fullName });
  }

  revalidatePath("/dashboard/branch");
  redirect(`/dashboard/branch?sent=${encodeURIComponent(invite.email)}`);
}

// Everyone currently down as `role` at this branch, whether already accepted
// or still a pending invite — deduplicated by email so a resend never counts
// as two people. If there's more than one, the sub admin gets a heads-up
// email so a typo or an accidental second invite doesn't quietly leave two
// people (e.g. two Accountants) both active for the same role.
async function alertIfRoleHasMultiplePeople(opts: {
  admin: ReturnType<typeof createAdminClient>;
  branchId: string;
  branchName: string;
  role: BranchRole;
  notifyEmail: string;
}) {
  const { admin, branchId, branchName, role, notifyEmail } = opts;

  const { data: acceptedRaw } = await admin.from("branch_staff")
    .select("app_users!branch_staff_user_id_fkey(full_name, email)")
    .eq("branch_id", branchId).eq("role", role);
  const accepted = (acceptedRaw || [])
    .map((r) => r.app_users as unknown as { full_name: string; email: string } | null)
    .filter(Boolean) as { full_name: string; email: string }[];

  const { data: pendingRaw } = await admin.from("pending_invites")
    .select("full_name, email").eq("branch_id", branchId).eq("role", role).is("accepted_at", null);
  const pending = (pendingRaw || []) as { full_name: string; email: string }[];

  const byEmail = new Map<string, string>();
  for (const p of [...accepted, ...pending]) {
    byEmail.set(p.email.toLowerCase(), p.full_name || p.email);
  }

  if (byEmail.size > 1) {
    await sendDuplicateRoleAlertEmail({
      to: notifyEmail,
      branchName,
      roleLabel: BRANCH_ROLE_LABELS[role],
      people: Array.from(byEmail.values()),
    });
  }
}

export async function cancelInvite(formData: FormData) {
  const { user } = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await requireSubAdmin(branchId, user.id, admin);

  const inviteId = String(formData.get("invite_id") || "");
  const { error } = await admin.from("pending_invites").delete().eq("id", inviteId).eq("branch_id", branchId);
  if (error) throw error;

  revalidatePath("/dashboard/branch");
  redirect("/dashboard/branch?cancelled=1");
}

export async function addFund(formData: FormData) {
  const { user } = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await requireSubAdmin(branchId, user.id, admin);

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Fund name can't be empty");

  const { data: existing } = await admin.from("branch_funds")
    .select("id").eq("branch_id", branchId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = existing ? undefined : 1;

  const { error } = await admin.from("branch_funds").insert({
    branch_id: branchId, name, sort_order: nextOrder ?? 99, active: true,
  });
  if (error) throw error;

  revalidatePath("/dashboard/branch");
}

export async function toggleFund(formData: FormData) {
  const { user } = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await requireSubAdmin(branchId, user.id, admin);

  const fundId = String(formData.get("fund_id") || "");
  const active = formData.get("active") === "true";

  const { error } = await admin.from("branch_funds").update({ active: !active }).eq("id", fundId).eq("branch_id", branchId);
  if (error) throw error;

  revalidatePath("/dashboard/branch");
}
