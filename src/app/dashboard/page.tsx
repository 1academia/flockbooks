import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardRoot() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("app_users")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.platform_role === "super_admin") redirect("/dashboard/super-admin");
  redirect("/dashboard/branch");
}
