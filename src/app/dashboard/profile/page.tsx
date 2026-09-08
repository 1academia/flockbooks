import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, requestEmailChange, confirmEmailChange } from "./actions";
import BackLink from "../back-link";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; new_email?: string }>;
}) {
  const { step, new_email: newEmail } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select("full_name, email, phone, platform_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  const awaitingCode = step === "verify" && !!newEmail;

  return (
    <div className="space-y-8 max-w-[520px]">
      <BackLink href="/dashboard" label="Dashboard" />
      <div>
        <h1 className="text-[24px] font-semibold">My Profile</h1>
        <p className="text-sm text-[var(--slate)] mt-1">Update your own name, phone, and email address.</p>
      </div>

      <section className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-3">Your details</h2>
        <form action={updateProfile} className="space-y-3">
          <Field label="Full name" name="full_name" defaultValue={profile.full_name} required />
          <Field label="Phone number" name="phone" type="tel" placeholder="0803 000 0000" defaultValue={profile.phone || ""} />
          <button className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-2.5 text-[14.5px]">
            Save changes
          </button>
        </form>
      </section>

      <section className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-5">
        <h2 className="text-[16px] font-semibold mb-1">Email address</h2>
        <p className="text-[13px] text-[var(--slate)] mb-3">
          Current: <b className="text-[var(--ink)]">{profile.email}</b>
        </p>

        {awaitingCode ? (
          <>
            <p className="text-[13px] text-[var(--slate)] mb-3">
              We sent a 6-digit code to <b className="text-[var(--ink)]">{newEmail}</b>. Enter it below to
              switch your sign-in email — until then, keep signing in with your current address.
            </p>
            <form action={confirmEmailChange} className="space-y-3">
              <input type="hidden" name="new_email" value={newEmail} />
              <Field label="Code from your new inbox" name="code" placeholder="123456" required />
              <button className="w-full rounded-lg bg-[var(--brass)] text-[#1B2233] font-semibold py-2.5 text-[14.5px]">
                Confirm new email
              </button>
            </form>
            <a href="/dashboard/profile" className="block text-center text-[13px] text-[var(--slate)] mt-3 underline">
              Cancel
            </a>
          </>
        ) : (
          <form action={requestEmailChange} className="space-y-3">
            <Field label="New email address" name="new_email" type="email" placeholder="you@church.org" required />
            <button className="w-full rounded-lg bg-[var(--brass)] text-[#1B2233] font-semibold py-2.5 text-[14.5px]">
              Send me a code
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function Field(props: { label: string; name: string; placeholder?: string; required?: boolean; type?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[var(--slate)] mb-1.5">{props.label}</label>
      <input
        name={props.name}
        type={props.type || "text"}
        placeholder={props.placeholder}
        required={props.required}
        defaultValue={props.defaultValue}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3 py-2.5 text-[14.5px] outline-none focus:border-[var(--navy)]"
      />
    </div>
  );
}
