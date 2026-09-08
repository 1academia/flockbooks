// Every authorization check in the app, in one place.
//
// Before this file, each actions.ts re-implemented its own currentUser /
// assertSubAdmin / assertBranchStaff (or, in super-admin/actions.ts, an
// inline requireSuperAdmin) — seven near-identical copies across seven
// files, each one a place a future edit could subtly get the check wrong
// with nothing to catch it. Consolidating means there's exactly one
// implementation of "is this person allowed to do this", and it's the one
// covered by authz.test.ts.
//
// Every server action still calls these explicitly at the top of the
// function — this doesn't make anything automatically secure, it just
// means the logic for each check is written and tested once.

import type { SupabaseClient } from "@supabase/supabase-js";

// Minimal shape both createClient() (RLS-respecting) and createAdminClient()
// (service-role) satisfy — lets these helpers accept either without
// depending on this app's specific Supabase client wrapper types.
type AnyClient = Pick<SupabaseClient, "auth" | "from">;

export class AuthzError extends Error {}

// Who's signed in, plus their display name (used in emails/notices).
// Throws if nobody is signed in.
export async function currentUser(supabase: AnyClient): Promise<{ id: string; email: string | null; fullName: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthzError("Not signed in");
  const { data: profile } = await supabase
    .from("app_users").select("full_name").eq("id", user.id).maybeSingle();
  return { id: user.id, email: user.email ?? null, fullName: (profile?.full_name as string) || "" };
}

// Platform-wide Super Admin — sees and manages every branch.
export async function requireSuperAdmin(supabase: AnyClient): Promise<{ id: string; email: string | null; fullName: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthzError("Not signed in");
  const { data: profile } = await supabase
    .from("app_users").select("platform_role, full_name").eq("id", user.id).maybeSingle();
  if (profile?.platform_role !== "super_admin") throw new AuthzError("Super Admin only");
  return { id: user.id, email: user.email ?? null, fullName: (profile?.full_name as string) || "" };
}

// Any staff member of the given branch (Pastor, Accountant, Admin, Assembly
// Pastor, or Regional Overseer at that branch) — the baseline check for
// day-to-day recording (services, deposits, outflows).
export async function requireBranchStaff(
  branchId: string, userId: string, admin: AnyClient,
  message = "You're not on staff at this branch"
): Promise<void> {
  const { data: staff } = await admin.from("branch_staff")
    .select("id").eq("branch_id", branchId).eq("user_id", userId).maybeSingle();
  if (!staff) throw new AuthzError(message);
}

// Specifically that branch's Sub Admin (Pastor) — gates branch-management
// actions: inviting/removing staff, managing funds, entering historical
// totals. `message` lets call sites keep their own wording (e.g. "...can
// invite staff" vs "...can enter historical totals") while sharing the
// same underlying check.
export async function requireSubAdmin(
  branchId: string, userId: string, admin: AnyClient,
  message = "Only that branch's Sub Admin can do this"
): Promise<void> {
  const { data: staff } = await admin.from("branch_staff")
    .select("id").eq("branch_id", branchId).eq("user_id", userId).eq("role", "sub_admin").maybeSingle();
  if (!staff) throw new AuthzError(message);
}

// One stage of a service record's sign-off chain — the person holding
// `requiredRole` at this branch, or Super Admin (who can sign on anyone's
// behalf). This is the check standing between "the numbers are approved"
// and "anyone who happened to be signed in could approve them", so it's
// deliberately its own function rather than folded into requireBranchStaff.
export async function requireSignoffAuthority(
  branchId: string, userId: string, requiredRole: string, admin: AnyClient,
  message = "You don't have authority to sign this stage"
): Promise<void> {
  const { data: profile } = await admin.from("app_users").select("platform_role").eq("id", userId).maybeSingle();
  if ((profile as { platform_role?: string } | null)?.platform_role === "super_admin") return;
  const { data: staff } = await admin.from("branch_staff")
    .select("id").eq("branch_id", branchId).eq("user_id", userId).eq("role", requiredRole).maybeSingle();
  if (!staff) throw new AuthzError(message);
}
