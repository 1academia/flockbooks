"use client";

// Only fires if the root layout itself throws (e.g. the sign-in check or
// invite-acceptance step in dashboard/layout.tsx) — rare, but without this
// file that failure mode has no styled fallback at all, not even the one
// error.tsx provides. Next.js requires this file to render its own
// <html>/<body> since it replaces the root layout.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#EDF1F8",
            padding: 16,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 380,
              width: "100%",
              background: "#FBFCFE",
              border: "1px solid #DCE1EA",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 600, color: "#16223F", margin: 0 }}>Something went wrong</p>
            <p style={{ fontSize: 13.5, color: "#5B6478", marginTop: 8 }}>
              FlockBooks hit a problem loading this page. Try again, or come back in a moment.
            </p>
            <button
              onClick={() => reset()}
              style={{
                marginTop: 20,
                width: "100%",
                borderRadius: 8,
                background: "#16223F",
                color: "white",
                fontWeight: 600,
                padding: "10px 0",
                fontSize: 14.5,
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
