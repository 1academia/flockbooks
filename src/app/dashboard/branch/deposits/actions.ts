"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { uploadDepositPhoto, uploadStatementFile } from "@/lib/storage";
import { currentUser as getCurrentUser, requireBranchStaff } from "@/lib/authz";

async function currentUser() {
  const supabase = await createClient();
  const { id } = await getCurrentUser(supabase);
  return { id };
}

// Records (or corrects) the cash total actually deposited for one week.
// One row per branch per week — re-submitting the same week updates it
// rather than creating a duplicate. A new photo replaces the old one; if
// none is given on an edit, the existing evidence photo is kept as-is.
export async function recordDeposit(formData: FormData) {
  const user = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  const weekStart = String(formData.get("week_start") || "");
  if (!weekStart) throw new Error("Week is required");
  await requireBranchStaff(branchId, user.id, admin);

  const amount = Number(formData.get("amount") || 0) || 0;
  const tellerAttached = formData.get("teller_attached") === "on";
  const photoFile = formData.get("teller_slip_photo") as File | null;
  const newPhotoPath = await uploadDepositPhoto(branchId, weekStart, photoFile);

  const { data: existing } = await admin.from("weekly_cash_deposits")
    .select("id, teller_slip_photo_path, statement_uploaded, statement_amount")
    .eq("branch_id", branchId).eq("week_start", weekStart).maybeSingle();

  // If a statement was already checked against this week, correcting the
  // deposit amount now could silently make that check stale (a "verified"
  // week whose amount just changed shouldn't keep saying verified) — so
  // re-compare against what the statement already on file says.
  const statusUpdate = existing?.statement_uploaded
    ? { status: Math.abs(Number(existing.statement_amount) - amount) < 0.01 ? "verified" : "mismatch" }
    : {};

  const { error } = await admin.from("weekly_cash_deposits").upsert({
    branch_id: branchId,
    week_start: weekStart,
    amount,
    teller_attached: tellerAttached,
    teller_attached_at: tellerAttached ? new Date().toISOString() : null,
    teller_slip_photo_path: newPhotoPath || existing?.teller_slip_photo_path || null,
    deposited_by: user.id,
    deposited_at: new Date().toISOString(),
    ...statusUpdate,
  }, { onConflict: "branch_id,week_start" });
  if (error) throw error;

  revalidatePath("/dashboard/branch/deposits");
  redirect("/dashboard/branch/deposits");
}

// Checks a week's recorded deposit against the actual bank statement. The
// sub admin/accountant types in what the statement shows for that week and
// (usually) attaches a photo or PDF of it; if the amount matches what was
// recorded, the week is marked verified — if not, it's flagged as a
// mismatch so it doesn't quietly get missed.
export async function verifyStatement(formData: FormData) {
  const user = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  const weekStart = String(formData.get("week_start") || "");
  if (!weekStart) throw new Error("Week is required");
  await requireBranchStaff(branchId, user.id, admin);

  const { data: deposit } = await admin.from("weekly_cash_deposits")
    .select("id, amount, statement_photo_path")
    .eq("branch_id", branchId).eq("week_start", weekStart).maybeSingle();
  if (!deposit) throw new Error("Record this week's deposit before verifying it against a statement");

  const statementAmount = Number(formData.get("statement_amount") || 0) || 0;
  const photoFile = formData.get("statement_file") as File | null;
  const newPhotoPath = await uploadStatementFile(branchId, weekStart, photoFile);

  const matched = Math.abs(statementAmount - Number(deposit.amount)) < 0.01;

  const { error } = await admin.from("weekly_cash_deposits").update({
    statement_uploaded: true,
    statement_uploaded_at: new Date().toISOString(),
    statement_uploaded_by: user.id,
    statement_amount: statementAmount,
    statement_photo_path: newPhotoPath || deposit.statement_photo_path,
    status: matched ? "verified" : "mismatch",
  }).eq("id", deposit.id);
  if (error) throw error;

  revalidatePath("/dashboard/branch/deposits");
  redirect(`/dashboard/branch/deposits/${weekStart}`);
}
