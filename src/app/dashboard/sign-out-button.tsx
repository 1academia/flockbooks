"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="text-[13px] font-medium text-[#C7CEDD] hover:text-white shrink-0"
    >
      Sign out
    </button>
  );
}
