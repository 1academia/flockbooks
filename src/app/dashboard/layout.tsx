import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { acceptPendingInvites } from "@/lib/invites";
import SignOutButton from "./sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select("full_name, platform_role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");

  // Picks up any role someone invited this person to after they were already
  // signed in — without this, it would only apply on their next fresh login.
  if (user.email) {
    await acceptPendingInvites(createAdminClient(), user.id, user.email);
  }

  return (
    <div className="min-h-screen">
      <header className="bg-[var(--navy)] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-[18px] font-semibold leading-tight" style={{ fontFamily: "Spectral, Georgia, serif" }}>
              FlockBooks
            </p>
            <p className="text-[11.5px] text-[#C7CEDD]">
              {profile.full_name} &middot; <span className="mono uppercase tracking-wide">{profile.platform_role.replace("_", " ")}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard/profile" className="text-[13px] text-[#C7CEDD] underline underline-offset-2">
              My Profile
            </a>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
