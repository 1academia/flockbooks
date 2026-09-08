"use client";

import { useEffect } from "react";
import Link from "next/link";

// Catches anything thrown inside a page or server action that isn't already
// handled — a validation message ("Amount must be greater than zero"), a
// duplicate-record error, a storage upload failure, or something
// unexpected. Without this, Next.js falls back to its own generic,
// unstyled error screen, which reads as "the app is broken" to someone
// non-technical rather than "fix this one thing and try again".
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Server action throws in this app are almost always a plain, readable
  // sentence written for the person using it ("Only that branch's Sub Admin
  // can do this"), so show it directly rather than hiding it behind a
  // generic message.
  const message = error?.message || "Something unexpected happened.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ice)] px-4">
      <div className="max-w-sm w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl p-6 text-center">
        <p className="text-[15px] font-semibold text-[var(--navy)]">Something went wrong</p>
        <p className="text-[13.5px] text-[var(--slate)] mt-2">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => reset()}
            className="w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-2.5 text-[14.5px]"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="w-full rounded-lg border border-[var(--line)] text-[var(--navy)] font-semibold py-2.5 text-[14.5px]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
