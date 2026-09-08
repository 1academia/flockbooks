import Link from "next/link";

// A consistent "go back" link for pages that are a step or more into the
// app — the browser's own back button covers this, but not everyone
// notices it (especially opened from a bookmark or a shared link), so
// every page that isn't a top-level dashboard gets one of these.
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[12.5px] text-[var(--slate)] underline underline-offset-2 hover:text-[var(--navy)]"
    >
      &larr; {label}
    </Link>
  );
}
