import { createAdminClient } from "@/lib/supabase/server";

// Turns every not-yet-accepted pending_invites row for this email into a
// branch_staff row. Called both right after login (see /api/auth/provision)
// and on every dashboard page load, so someone invited to a new role while
// they're already signed in doesn't have to log out and back in to see it.
export async function acceptPendingInvites(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string
): Promise<number> {
  const { data: invites } = await admin
    .from("pending_invites")
    .select("*")
    .eq("email", email.toLowerCase())
    .is("accepted_at", null);
  if (!invites || invites.length === 0) return 0;

  let accepted = 0;
  for (const invite of invites) {
    const { error } = await admin.from("branch_staff").insert({
      branch_id: invite.branch_id, user_id: userId, role: invite.role, invited_by: invite.invited_by,
      accepted_at: new Date().toISOString(),
    });
    // A duplicate (branch_id, user_id, role) means this role was somehow
    // already granted — still mark the invite accepted so it stops showing
    // as pending, but don't count it as a new acceptance.
    if (!error || error.code === "23505") {
      await admin.from("pending_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
      if (!error) accepted++;
    }
  }
  return accepted;
}
