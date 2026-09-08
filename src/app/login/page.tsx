"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/login/verify?email=${encodeURIComponent(email)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px] bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-7 shadow-sm">
        <h1 className="text-[19px] font-semibold mb-1">Sign in to FlockBooks</h1>
        <p className="text-sm text-[var(--slate)] mb-6">
          No password to remember — we&apos;ll send a one-time code to your email.
        </p>
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--slate)] mb-1.5">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@church.org"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--ice)] px-3.5 py-3 text-[15px] outline-none focus:border-[var(--navy)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-3 text-[15px] disabled:opacity-60"
          >
            {sending ? "Sending code…" : "Send me a code"}
          </button>
        </form>
      </div>
    </main>
  );
}
