import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { signedPhotoUrl } from "@/lib/storage";
import { signServiceRecord } from "../actions";
import {
  SIGNOFF_STAGES, SIGNOFF_STAGE_LABELS, ROLE_TO_STAGE, nextStage, statusLabel, type SignoffStage,
} from "@/lib/roles";

type Signoffs = {
  counters_signed_at: string;
  accountant_signed_at: string | null; accountant_signed_by: string | null;
  admin_signed_at: string | null; admin_signed_by: string | null;
  assembly_pastor_signed_at: string | null; assembly_pastor_signed_by: string | null;
  regional_overseer_signed_at: string | null; regional_overseer_signed_by: string | null;
};

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: record } = await admin.from("service_records").select("*").eq("id", id).maybeSingle();
  if (!record) notFound();

  const { data: profile } = await supabase.from("app_users").select("platform_role").eq("id", user.id).maybeSingle();
  const isSuperAdmin = profile?.platform_role === "super_admin";

  const { data: myStaff } = await admin.from("branch_staff")
    .select("role").eq("branch_id", record.branch_id).eq("user_id", user.id);
  const myRoles = (myStaff || []).map((s) => s.role);
  if (!isSuperAdmin && myRoles.length === 0) redirect("/dashboard/branch/services");

  const { data: branch } = await admin.from("church_branches").select("name").eq("id", record.branch_id).single();
  const { data: countsRaw } = await admin.from("service_cash_counts")
    .select("fund_name, total").eq("service_record_id", id).order("fund_name");
  const { data: signoffsRaw } = await admin.from("service_signoffs").select("*").eq("service_record_id", id).maybeSingle();
  const signoffs = signoffsRaw as Signoffs | null;

  const signerIds = [
    signoffs?.accountant_signed_by, signoffs?.admin_signed_by,
    signoffs?.assembly_pastor_signed_by, signoffs?.regional_overseer_signed_by,
  ].filter(Boolean) as string[];
  const { data: signersRaw } = signerIds.length
    ? await admin.from("app_users").select("id, full_name").in("id", signerIds)
    : { data: [] };
  const signerName = (id: string | null) => signersRaw?.find((s) => s.id === id)?.full_name || "";

  const photoUrl = await signedPhotoUrl(record.paper_form_photo_path);
  const expectedStage = nextStage(record.status);

  const stageInfo: Record<SignoffStage, { signedAt: string | null; signerId: string | null }> = {
    accountant: { signedAt: signoffs?.accountant_signed_at ?? null, signerId: signoffs?.accountant_signed_by ?? null },
    admin: { signedAt: signoffs?.admin_signed_at ?? null, signerId: signoffs?.admin_signed_by ?? null },
    assembly_pastor: { signedAt: signoffs?.assembly_pastor_signed_at ?? null, signerId: signoffs?.assembly_pastor_signed_by ?? null },
    regional_overseer: { signedAt: signoffs?.regional_overseer_signed_at ?? null, signerId: signoffs?.regional_overseer_signed_by ?? null },
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Link href="/dashboard/branch/services" className="text-[12.5px] text-[var(--slate)] underline underline-offset-2">
          &larr; All service records
        </Link>
        <h1 className="text-[22px] font-semibold mt-2">
          {branch?.name} &middot; {record.service_date}
        </h1>
        <p className="text-sm text-[var(--slate)] mt-1">
          {record.service_type === "sunday" ? "Sunday service" : "Mid-week service"} &middot; {statusLabel(record.status)}
        </p>
      </div>

      <section className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5 space-y-1">
        <Row label="Minister" value={record.minister || "—"} />
        <Row label="Sermon" value={record.sermon_title || "—"} />
        <Row label="Attendance" value={`${record.attendance_total} (M ${record.male} · F ${record.female} · Ch ${record.children} · Tn ${record.teenage})`} />
        <Row label="Counters" value={[record.counter1_name, record.counter2_name, record.counter3_name].filter(Boolean).join(", ") || "—"} />
      </section>

      <section className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
        <h2 className="text-[15px] font-semibold mb-3">Cash Analysis</h2>
        {(countsRaw || []).map((c) => (
          <Row key={c.fund_name} label={c.fund_name} value={`₦${Number(c.total).toLocaleString()}`} />
        ))}
        <div className="border-t border-[var(--line)] mt-2 pt-2">
          <Row label="Grand total" value={`₦${Number(record.grand_total).toLocaleString()}`} bold />
        </div>
      </section>

      {photoUrl && (
        <section className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
          <h2 className="text-[15px] font-semibold mb-3">Paper form evidence</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Paper Cash Analysis / Record of Activities form" className="max-h-96 rounded-lg border border-[var(--line)]" />
        </section>
      )}

      <section className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
        <h2 className="text-[15px] font-semibold mb-3">Sign-off chain</h2>
        <div className="space-y-2.5">
          <TimelineRow label="Counters (in person)" done at={signoffs?.counters_signed_at} name="" />
          {SIGNOFF_STAGES.map((stage) => (
            <TimelineRow
              key={stage}
              label={SIGNOFF_STAGE_LABELS[stage]}
              done={!!stageInfo[stage].signedAt}
              at={stageInfo[stage].signedAt}
              name={signerName(stageInfo[stage].signerId)}
            />
          ))}
        </div>

        {expectedStage && (isSuperAdmin || myRoles.includes(expectedStage) || myRoles.some((r) => ROLE_TO_STAGE[r as keyof typeof ROLE_TO_STAGE] === expectedStage)) && (
          <form action={signServiceRecord} className="mt-4">
            <input type="hidden" name="service_record_id" value={record.id} />
            <input type="hidden" name="stage" value={expectedStage} />
            <button className="rounded-lg bg-[var(--brass)] text-[#1B2233] font-semibold px-5 py-2.5 text-[14px]">
              Sign as {SIGNOFF_STAGE_LABELS[expectedStage]}
            </button>
          </form>
        )}
        {expectedStage && !(isSuperAdmin || myRoles.some((r) => ROLE_TO_STAGE[r as keyof typeof ROLE_TO_STAGE] === expectedStage)) && (
          <p className="text-[13px] text-[var(--slate)] mt-4">
            Waiting on this branch&apos;s {SIGNOFF_STAGE_LABELS[expectedStage]} to sign.
          </p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13.5px] text-[var(--slate)]">{label}</span>
      <span className={`text-[13.5px] ${bold ? "font-semibold text-[var(--navy)]" : ""}`}>{value}</span>
    </div>
  );
}

function TimelineRow({ label, done, at, name }: { label: string; done: boolean; at?: string | null; name: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${done ? "bg-[var(--good)]" : "bg-[var(--line)]"}`} />
      <span className="text-[13.5px] flex-1">{label}</span>
      <span className="text-[12px] text-[var(--slate)]">
        {done && at ? `${new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}${name ? " · " + name : ""}` : "Pending"}
      </span>
    </div>
  );
}
