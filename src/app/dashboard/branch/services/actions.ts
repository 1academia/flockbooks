"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { uploadServicePhoto } from "@/lib/storage";
import { sendSignoffAlertEmail } from "@/lib/resend";
import {
  SIGNOFF_STAGES, SIGNOFF_STATUS_FOR_STAGE, SIGNOFF_STAGE_LABELS,
  ROLE_TO_STAGE, nextStage, type SignoffStage,
} from "@/lib/roles";
import { currentUser as getCurrentUser, requireBranchStaff, requireSignoffAuthority } from "@/lib/authz";

const DENOMS = ["q1000", "q500", "q200", "q100", "q50", "q20", "q10"] as const;

function num(formData: FormData, key: string): number {
  return Number(formData.get(key) || 0) || 0;
}

async function currentUser() {
  const supabase = await createClient();
  const { id, fullName } = await getCurrentUser(supabase);
  return { user: { id }, fullName };
}

function fundTotal(formData: FormData, fundId: string): number {
  let total = 0;
  const values: Record<string, number> = { q1000: 1000, q500: 500, q200: 200, q100: 100, q50: 50, q20: 20, q10: 10 };
  for (const d of DENOMS) total += num(formData, `fund_${fundId}_${d}`) * values[d];
  total += num(formData, `fund_${fundId}_coins`);
  return total;
}

// Creates the service record, its per-fund cash counts, and the sign-off
// row that starts the chain — all in one submit, after the entry-form's
// review step. obj shape driven by the dynamic fund fields the form renders
// (fund_<fundId>_q1000 etc), so this reads the branch's own active funds
// rather than a fixed list.
export async function createServiceRecord(formData: FormData) {
  const { user } = await currentUser();
  const admin = createAdminClient();
  const branchId = String(formData.get("branch_id") || "");
  await requireBranchStaff(branchId, user.id, admin);

  const serviceDate = String(formData.get("service_date") || "");
  const serviceType = String(formData.get("service_type") || "sunday");
  if (!serviceDate) throw new Error("Service date is required");

  const { data: funds } = await admin.from("branch_funds")
    .select("id, name").eq("branch_id", branchId).eq("active", true);

  const photoFile = formData.get("paper_form_photo") as File | null;
  const photoPath = await uploadServicePhoto(branchId, serviceDate, photoFile);

  const { data: record, error } = await admin.from("service_records").insert({
    branch_id: branchId,
    service_date: serviceDate,
    service_type: serviceType,
    minister: String(formData.get("minister") || "").trim() || null,
    sermon_title: String(formData.get("sermon_title") || "").trim() || null,
    male: num(formData, "male"),
    female: num(formData, "female"),
    children: num(formData, "children"),
    teenage: num(formData, "teenage"),
    paper_form_photo_path: photoPath,
    counter1_name: String(formData.get("counter1_name") || "").trim() || null,
    counter2_name: String(formData.get("counter2_name") || "").trim() || null,
    counter3_name: String(formData.get("counter3_name") || "").trim() || null,
    submitted_by: user.id,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("A service record for this branch and date already exists.");
    throw error;
  }

  let grandTotal = 0;
  for (const fund of funds || []) {
    const total = fundTotal(formData, fund.id);
    grandTotal += total;
    await admin.from("service_cash_counts").insert({
      service_record_id: record.id,
      fund_id: fund.id,
      fund_name: fund.name,
      q1000: num(formData, `fund_${fund.id}_q1000`),
      q500: num(formData, `fund_${fund.id}_q500`),
      q200: num(formData, `fund_${fund.id}_q200`),
      q100: num(formData, `fund_${fund.id}_q100`),
      q50: num(formData, `fund_${fund.id}_q50`),
      q20: num(formData, `fund_${fund.id}_q20`),
      q10: num(formData, `fund_${fund.id}_q10`),
      coins: num(formData, `fund_${fund.id}_coins`),
    });
  }

  await admin.from("service_records").update({ grand_total: grandTotal }).eq("id", record.id);
  await admin.from("service_signoffs").insert({ service_record_id: record.id });

  const { data: branch } = await admin.from("church_branches").select("name").eq("id", branchId).single();
  const { data: accountant } = await admin.from("branch_staff")
    .select("app_users!branch_staff_user_id_fkey(email)").eq("branch_id", branchId).eq("role", "accountant").maybeSingle();
  const accountantEmail = (accountant?.app_users as unknown as { email: string } | null)?.email;
  if (accountantEmail) {
    await sendSignoffAlertEmail({
      to: accountantEmail, branchName: branch?.name || "your branch", serviceDate,
      grandTotal, roleLabel: "Accountant", serviceRecordId: record.id,
    });
  }

  revalidatePath("/dashboard/branch/services");
  redirect(`/dashboard/branch/services/${record.id}`);
}

// One stage of the sign-off chain. Enforces both that it's actually this
// stage's turn (server-side, regardless of what the UI shows) and that the
// signer holds the matching role at this record's branch.
export async function signServiceRecord(formData: FormData) {
  const { user } = await currentUser();
  const admin = createAdminClient();
  const recordId = String(formData.get("service_record_id") || "");
  const stage = String(formData.get("stage") || "") as SignoffStage;
  if (!SIGNOFF_STAGES.includes(stage)) throw new Error("Unknown sign-off stage");

  const { data: record } = await admin.from("service_records")
    .select("id, branch_id, service_date, status, grand_total").eq("id", recordId).single();
  if (!record) throw new Error("Record not found");

  const expected = nextStage(record.status);
  if (expected !== stage) throw new Error("It's not this stage's turn yet.");

  const requiredRole = Object.keys(ROLE_TO_STAGE).find((r) => ROLE_TO_STAGE[r as keyof typeof ROLE_TO_STAGE] === stage)!;
  await requireSignoffAuthority(
    record.branch_id, user.id, requiredRole, admin,
    `Only this branch's ${SIGNOFF_STAGE_LABELS[stage]} can sign this stage`
  );

  const columnByStage: Record<SignoffStage, { at: string; by: string }> = {
    accountant: { at: "accountant_signed_at", by: "accountant_signed_by" },
    admin: { at: "admin_signed_at", by: "admin_signed_by" },
    assembly_pastor: { at: "assembly_pastor_signed_at", by: "assembly_pastor_signed_by" },
    regional_overseer: { at: "regional_overseer_signed_at", by: "regional_overseer_signed_by" },
  };
  const col = columnByStage[stage];
  await admin.from("service_signoffs").update({ [col.at]: new Date().toISOString(), [col.by]: user.id }).eq("service_record_id", recordId);

  const idx = SIGNOFF_STAGES.indexOf(stage);
  const nextStageName = SIGNOFF_STAGES[idx + 1];
  const newStatus = nextStageName ? SIGNOFF_STATUS_FOR_STAGE[nextStageName] : "closed";
  await admin.from("service_records").update({ status: newStatus }).eq("id", recordId);

  if (nextStageName) {
    const { data: branch } = await admin.from("church_branches").select("name").eq("id", record.branch_id).single();
    const { data: nextPerson } = await admin.from("branch_staff")
      .select("app_users!branch_staff_user_id_fkey(email)").eq("branch_id", record.branch_id).eq("role", nextStageName).maybeSingle();
    const nextEmail = (nextPerson?.app_users as unknown as { email: string } | null)?.email;
    if (nextEmail) {
      await sendSignoffAlertEmail({
        to: nextEmail, branchName: branch?.name || "your branch", serviceDate: record.service_date,
        grandTotal: Number(record.grand_total), roleLabel: SIGNOFF_STAGE_LABELS[nextStageName], serviceRecordId: recordId,
      });
    }
  }

  revalidatePath(`/dashboard/branch/services/${recordId}`);
  revalidatePath("/dashboard/branch/services");
}
