"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { currentUser as getCurrentUser, requireSubAdmin } from "@/lib/authz";

async function currentUser() {
  const supabase = await createClient();
  const { id } = await getCurrentUser(supabase);
  return { id };
}

async function assertSubAdmin(branchId: string, userId: string, admin: ReturnType<typeof createAdminClient>) {
  await requireSubAdmin(branchId, userId, admin, "Only that branch's Sub Admin can enter historical totals");
}

// Replaces whatever's on file for this branch+month with the new numbers —
// re-submitting the same month corrects it rather than piling up
// duplicates, since this is a hand-entered summary, not a running log.
export async function saveHistoricalMonth(formData: FormData) {
  const user = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await assertSubAdmin(branchId, user.id, admin);

  const monthInput = String(formData.get("month") || ""); // "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(monthInput)) throw new Error("Pick a month");
  const month = `${monthInput}-01`;

  const { data: funds } = await admin.from("branch_funds").select("id, name").eq("branch_id", branchId);

  const rows: {
    branch_id: string; month: string; kind: "income" | "expense";
    fund_id: string | null; fund_name: string | null; amount: number; recorded_by: string;
  }[] = [];
  for (const f of funds || []) {
    const amount = Number(formData.get(`fund_${f.id}`) || 0) || 0;
    if (amount > 0) {
      rows.push({ branch_id: branchId, month, kind: "income", fund_id: f.id, fund_name: f.name, amount, recorded_by: user.id });
    }
  }
  const expenseAmount = Number(formData.get("expenses") || 0) || 0;
  if (expenseAmount > 0) {
    rows.push({ branch_id: branchId, month, kind: "expense", fund_id: null, fund_name: null, amount: expenseAmount, recorded_by: user.id });
  }

  // Soft-delete whatever was previously on file for this month rather than
  // hard-deleting it — a financial number someone typed in should stay
  // recoverable even after it's corrected, not vanish with no trace of what
  // it used to say. Reads only ever look at rows where superseded_at is
  // still null, so this is invisible from the app's own point of view.
  const now = new Date().toISOString();
  await admin.from("historical_monthly_totals")
    .update({ superseded_at: now })
    .eq("branch_id", branchId).eq("month", month).is("superseded_at", null);
  if (rows.length > 0) {
    const { error } = await admin.from("historical_monthly_totals").insert(rows);
    if (error) throw error;
  }

  revalidatePath("/dashboard/branch/historical");
  revalidatePath("/dashboard/branch/analytics");
  redirect(`/dashboard/branch/historical?saved=${monthInput}`);
}

// Clears a month entirely — for when it was entered by mistake. Soft-delete
// only, same reasoning as saveHistoricalMonth above.
export async function deleteHistoricalMonth(formData: FormData) {
  const user = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await assertSubAdmin(branchId, user.id, admin);

  const month = String(formData.get("month") || "");
  await admin.from("historical_monthly_totals")
    .update({ superseded_at: new Date().toISOString() })
    .eq("branch_id", branchId).eq("month", month).is("superseded_at", null);

  revalidatePath("/dashboard/branch/historical");
  revalidatePath("/dashboard/branch/analytics");
  redirect("/dashboard/branch/historical?deleted=1");
}
