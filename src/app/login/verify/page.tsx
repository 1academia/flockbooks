"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setVerifying(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    if (otpError) {
      setVerifying(false);
      setError("That code didn't work — check it and try again, or request a new one.");
      return;
    }

    const res = await fetch("/api/auth/provision", { method: "POST" });
    const body = await res.json();
    setVerifying(false);

    if (!res.ok) {
      await supabase.auth.signOut();
      setError(body.error || "Something went wrong signing you in.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px] bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-7 shadow-sm">
        <h1 className="text-[19px] font-semibold mb-1">Enter your code</h1>
        <p className="text-sm text-[var(--slate)] mb-6">
          We sent a code to <b className="text-[var(--ink)]">{email}</b>. It may be 6 or 8 digits
          depending on how it was sent — type in exactly what the email shows.
        </p>
        <form onSubmit={verify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter the code"
            className="w-full text-center tracking-[0.4em] text-xl rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3.5 py-3 outline-none focus:border-[var(--navy)]"
          />
          {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
          <button
            type="submit"
            disabled={verifying}
            className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-3 text-[15px] disabled:opacity-60"
          >
            {verifying ? "Checking…" : "Continue"}
          </button>
        </form>
        <Link
          href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
          className="mt-4 inline-block text-[13px] text-[var(--slate)] underline underline-offset-2"
        >
          &larr; Use a different email, or send a new code
        </Link>
      </div>
    </main>
  );
}
