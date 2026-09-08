import Link from "next/link";

// A stale link (a deleted service record, an old invite link, a typo'd
// URL) previously fell through to Next.js's bare "404" text. This gives
// it the same look as the rest of the app and a way back.
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ice)] px-4">
      <div className="max-w-sm w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl p-6 text-center">
        <p className="text-[15px] font-semibold text-[var(--navy)]">Page not found</p>
        <p className="text-[13.5px] text-[var(--slate)] mt-2">
          That page doesn&apos;t exist, or it&apos;s been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block w-full rounded-lg bg-[var(--navy)] text-white font-semibold py-2.5 text-[14.5px]"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
