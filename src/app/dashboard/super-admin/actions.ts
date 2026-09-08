"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/resend";
import { requireSuperAdmin as requireSuperAdminAuthz } from "@/lib/authz";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { id, fullName } = await requireSuperAdminAuthz(supabase);
  return { user: { id }, fullName };
}

export async function createBranch(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const regionName = String(formData.get("region") || "").trim();
  let regionId: string | null = null;
  if (regionName) {
    const { data: existingRegion } = await admin.from("regions").select("id").eq("name", regionName).maybeSingle();
    if (existingRegion) {
      regionId = existingRegion.id;
    } else {
      const { data: newRegion, error } = await admin.from("regions").insert({ name: regionName }).select("id").single();
      if (error) throw error;
      regionId = newRegion.id;
    }
  }

  const { error } = await admin.from("church_branches").insert({
    name: String(formData.get("name") || "").trim(),
    address: String(formData.get("address") || "").trim() || null,
    closest_bus_stop: String(formData.get("bus_stop") || "").trim() || null,
    region_id: regionId,
    created_via: "super_admin",
    created_by: user.id,
  });
  if (error) throw error;

  revalidatePath("/dashboard/super-admin");
}

export async function invitePastor(formData: FormData) {
  const { user, fullName } = await requireSuperAdmin();
  const admin = createAdminClient();

  const branchId = String(formData.get("branch_id") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();

  const { data: branch } = await admin.from("church_branches").select("name").eq("id", branchId).single();

  const { error } = await admin.from("pending_invites").insert({
    branch_id: branchId, email, full_name: name, role: "sub_admin", invited_by: user.id,
  });
  if (error) throw error;

  await sendInviteEmail({
    to: email, fullName: name, role: "sub_admin", branchName: branch?.name || "your branch", invitedByName: fullName,
  });

  revalidatePath("/dashboard/super-admin");
}
