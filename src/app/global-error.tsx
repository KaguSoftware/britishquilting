"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ background: "#f7f2e9", color: "#1c0a24", fontFamily: "Georgia, serif" }}>
        <div
          style={{
            minHeight: "100svh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Something came loose</h1>
          <p style={{ marginTop: "0.75rem", maxWidth: 420, lineHeight: 1.6 }}>
            The page couldn&apos;t load. Please try again; if it persists, call us on 07710 131416.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              minHeight: 44,
              padding: "0 1.5rem",
              background: "#1c0a24",
              color: "#f7f2e9",
              border: "none",
              borderRadius: 2,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
