import { AdminShell } from "@/components/admin/shell";
import { staffDb } from "@/lib/actions/admin/guard";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { db, viewer } = await staffDb();
  const [toPack, reviews] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing"]),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return (
    <AdminShell
      isOwner={viewer.role === "owner"}
      name={viewer.fullName || viewer.email || "you"}
      counts={{ toPack: toPack.count ?? 0, reviews: reviews.count ?? 0 }}
    >
      {children}
    </AdminShell>
  );
}
