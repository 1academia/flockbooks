"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { uploadReceiptFile, signedPhotoUrl } from "@/lib/storage";
import { currentUser as getCurrentUser, requireBranchStaff } from "@/lib/authz";

async function currentUser() {
  const supabase = await createClient();
  const { id } = await getCurrentUser(supabase);
  return { id };
}

// Records one expense — always with a receipt/voucher photo as evidence,
// same as everywhere else money is recorded in FlockBooks.
export async function recordOutflow(formData: FormData) {
  const user = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await requireBranchStaff(branchId, user.id, admin);

  const expenseDate = String(formData.get("expense_date") || "");
  if (!expenseDate) throw new Error("Date is required");
  const amount = Number(formData.get("amount") || 0) || 0;
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  const paidTo = String(formData.get("paid_to") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const paymentMethod = String(formData.get("payment_method") || "cash");
  const fundId = String(formData.get("fund_id") || "") || null;

  const photoFile = formData.get("receipt_photo") as File | null;
  const photoPath = await uploadReceiptFile(branchId, expenseDate, photoFile);

  const { error } = await admin.from("outflows").insert({
    branch_id: branchId,
    fund_id: fundId,
    expense_date: expenseDate,
    amount,
    paid_to: paidTo,
    reason,
    payment_method: paymentMethod,
    receipt_photo_path: photoPath,
    recorded_by: user.id,
  });
  if (error) throw error;

  revalidatePath("/dashboard/branch/outflows");
  redirect("/dashboard/branch/outflows");
}

// Removes an incorrectly-entered expense. Any of the branch's own staff can
// do this (same as recording one) — it's operational bookkeeping, not a
// Sub Admin-gated action.
export async function deleteOutflow(formData: FormData) {
  const user = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await requireBranchStaff(branchId, user.id, admin);

  const outflowId = String(formData.get("outflow_id") || "");
  const { error } = await admin.from("outflows").delete().eq("id", outflowId).eq("branch_id", branchId);
  if (error) throw error;

  revalidatePath("/dashboard/branch/outflows");
  redirect("/dashboard/branch/outflows?deleted=1");
}

// Generates a signed receipt URL only when someone actually clicks
// "Receipt" and redirects straight to it, rather than the list page
// signing every row's photo on every visit (most receipts are never
// opened — that was up to 100 signed-URL calls per page load).
export async function viewReceipt(formData: FormData) {
  const user = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await requireBranchStaff(branchId, user.id, admin);

  const outflowId = String(formData.get("outflow_id") || "");
  const { data: outflow } = await admin
    .from("outflows")
    .select("receipt_photo_path")
    .eq("id", outflowId)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (!outflow?.receipt_photo_path) throw new Error("No receipt on file for this expense");

  const url = await signedPhotoUrl(outflow.receipt_photo_path);
  if (!url) throw new Error("Couldn't generate a link to that receipt — try again");
  redirect(url);
}
