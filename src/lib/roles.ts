export type PlatformRole = "super_admin" | "sub_admin" | "staff";

export type BranchRole =
  | "sub_admin"
  | "accountant"
  | "admin"
  | "assembly_pastor"
  | "regional_overseer";

export const BRANCH_ROLE_LABELS: Record<BranchRole, string> = {
  sub_admin: "Pastor / Sub Admin",
  accountant: "Accountant",
  admin: "Admin",
  assembly_pastor: "Assembly Pastor",
  regional_overseer: "Regional Overseer",
};

// Roles a Sub Admin is allowed to add to their own branch.
// (Sub Admin/Pastor and Regional Overseer are assigned by Super Admin, not by a Sub Admin.)
export const SUB_ADMIN_ASSIGNABLE_ROLES: BranchRole[] = [
  "accountant",
  "admin",
  "assembly_pastor",
];

export const WEEKDAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

// The sign-off chain a service record moves through, in order, after the
// counters submit it. Each stage's status value is what service_records.status
// holds while that stage is the one waiting to act.
export type SignoffStage = "accountant" | "admin" | "assembly_pastor" | "regional_overseer";

export const SIGNOFF_STAGES: SignoffStage[] = ["accountant", "admin", "assembly_pastor", "regional_overseer"];

export const SIGNOFF_STATUS_FOR_STAGE: Record<SignoffStage, string> = {
  accountant: "waiting_on_accountant",
  admin: "waiting_on_admin",
  assembly_pastor: "waiting_on_assembly_pastor",
  regional_overseer: "waiting_on_regional_overseer",
};

export const SIGNOFF_STAGE_LABELS: Record<SignoffStage, string> = {
  accountant: "Accountant",
  admin: "Admin",
  assembly_pastor: "Assembly Pastor",
  regional_overseer: "Regional Overseer",
};

// A branch_staff role matches exactly one sign-off stage.
export const ROLE_TO_STAGE: Partial<Record<BranchRole, SignoffStage>> = {
  accountant: "accountant",
  admin: "admin",
  assembly_pastor: "assembly_pastor",
  regional_overseer: "regional_overseer",
};

export function nextStage(status: string): SignoffStage | null {
  if (status === "waiting_on_accountant") return "accountant";
  if (status === "waiting_on_admin") return "admin";
  if (status === "waiting_on_assembly_pastor") return "assembly_pastor";
  if (status === "waiting_on_regional_overseer") return "regional_overseer";
  return null; // "closed"
}

export function statusLabel(status: string): string {
  if (status === "closed") return "Closed — fully signed off";
  const stage = nextStage(status);
  return stage ? `Waiting on ${SIGNOFF_STAGE_LABELS[stage]}` : status;
}
