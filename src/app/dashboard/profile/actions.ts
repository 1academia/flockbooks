"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { currentUser as getCurrentUser } from "@/lib/authz";

async function currentUser() {
  const supabase = await createClient();
  const { id } = await getCurrentUser(supabase);
  return { supabase, user: { id } };
}

// Name and phone are self-service — no re-verification needed for either.
export async function updateProfile(formData: FormData) {
  const { user } = await currentUser();
  const fullName = String(formData.get("full_name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (!fullName) throw new Error("Full name can't be empty");

  const admin = createAdminClient();
  const { error } = await admin
    .from("app_users")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
}

// Step 1 of an email change: since email is also the login identity, this
// sends a one-time code to the NEW address to prove it's really theirs
// before anything switches over — same code-based pattern as login itself.
export async function requestEmailChange(formData: FormData) {
  const { supabase } = await currentUser();
  const newEmail = String(formData.get("new_email") || "").trim().toLowerCase();
  if (!newEmail) throw new Error("Enter a new email address");

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;

  redirect(`/dashboard/profile?step=verify&new_email=${encodeURIComponent(newEmail)}`);
}

// Step 2: the code from the new inbox confirms it, then app_users is kept
// in sync with Supabase's own auth record.
export async function confirmEmailChange(formData: FormData) {
  const { supabase } = await currentUser();
  const newEmail = String(formData.get("new_email") || "").trim().toLowerCase();
  const code = String(formData.get("code") || "").trim();
  if (!newEmail || !code) throw new Error("Enter the code from your new email");

  const { data, error } = await supabase.auth.verifyOtp({ email: newEmail, token: code, type: "email_change" });
  if (error) throw error;

  const userId = data.user?.id;
  if (userId) {
    const admin = createAdminClient();
    await admin.from("app_users").update({ email: newEmail }).eq("id", userId);
  }

  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile");
}
