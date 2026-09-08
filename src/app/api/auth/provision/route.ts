import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { acceptPendingInvites } from "@/lib/invites";

// Runs right after a code is verified, on every login. First login ever for
// this email: turns a pending invite (or the bootstrap Super Admin email)
// into a real app_users row. Every login (first or not) also picks up any
// pending_invites for this email that haven't been turned into branch_staff
// rows yet — so someone already provisioned (e.g. already staff at one
// branch, or the Super Admin) still gets a role they're invited to later.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const email = user.email.toLowerCase();

  const { data: existing } = await supabase
    .from("app_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    const accepted = await acceptPendingInvites(admin, user.id, email);
    return NextResponse.json({ ok: true, status: accepted > 0 ? "invites_synced" : "already_provisioned", accepted });
  }

  // Bootstrap: the one email allowed to become Super Admin with no invite.
  const bootstrapEmail = process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL?.toLowerCase();
  if (bootstrapEmail && email === bootstrapEmail) {
    await admin.from("app_users").insert({
      id: user.id, email, full_name: "Super Admin", platform_role: "super_admin",
    });
    return NextResponse.json({ ok: true, status: "super_admin_created" });
  }

  // Otherwise: this email must have a pending invite waiting for it.
  const { data: invites } = await admin
    .from("pending_invites")
    .select("*")
    .eq("email", email)
    .is("accepted_at", null);

  if (!invites || invites.length === 0) {
    return NextResponse.json(
      { error: "This email hasn't been added to a church yet. Ask your Pastor or Super Admin to add you first." },
      { status: 403 }
    );
  }

  const platformRole = invites.some((i: { role: string }) => i.role === "sub_admin") ? "sub_admin" : "staff";
  await admin.from("app_users").insert({
    id: user.id, email, full_name: invites[0].full_name, platform_role: platformRole,
  });

  await acceptPendingInvites(admin, user.id, email);

  return NextResponse.json({ ok: true, status: "invite_accepted" });
}
