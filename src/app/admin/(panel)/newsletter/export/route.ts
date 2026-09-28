import { staffDb } from "@/lib/actions/admin/guard";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Guard against spreadsheet formula injection and escape quotes
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const { db } = await staffDb();
  const all = new URL(request.url).searchParams.get("all") === "1";
  let q = db.from("newsletter_subscribers").select("email, source, created_at, unsubscribed_at").order("created_at", { ascending: false });
  if (!all) q = q.is("unsubscribed_at", null);
  const { data, error } = await q;
  if (error) return new Response("Couldn't export subscribers", { status: 500 });
  const lines = [
    ["Email", "Signed up from", "Signed up on", "Unsubscribed on"].map(cell).join(","),
    ...(data ?? []).map((r) => [r.email, r.source, r.created_at?.slice(0, 10), r.unsubscribed_at?.slice(0, 10)].map(cell).join(",")),
  ];
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="british-quilting-subscribers-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
