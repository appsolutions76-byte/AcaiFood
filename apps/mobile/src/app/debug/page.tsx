"use client";

export default function DebugPage() {
  return (
    <div style={{ padding: 20, color: "black", background: "white", minHeight: "100vh" }}>
      <h1>Debug Environment Variables</h1>
      <pre>
        {JSON.stringify({
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "EXISTS" : "MISSING",
        }, null, 2)}
      </pre>
    </div>
  );
}
