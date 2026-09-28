import Link from "next/link";
import { IconStar } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { ReviewCard, type ReviewRow } from "@/components/admin/review-card";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "pending" } = await searchParams;
  const status = ["pending", "approved", "rejected"].includes(show) ? show : "pending";
  const { db } = await staffDb();
  const { data } = await db
    .from("reviews")
    .select("id, author_name, rating, title, body, verified_purchase, status, created_at, product:products(id, name)")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(200);
  const rows = (data ?? []) as unknown as ReviewRow[];
  const tabs = [
    { key: "pending", label: "To check" },
    { key: "approved", label: "Live" },
    { key: "rejected", label: "Hidden" },
  ];
  return (
    <div>
      <PageHeader title="Reviews" description="New reviews wait here until you approve them, so nothing goes live without you seeing it." />
      <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {tabs.map((t) => (
          <Link key={t.key} href={`/admin/reviews?show=${t.key}`} className={cn("min-h-11 shrink-0 border-b-2 px-3 py-2.5 text-sm", t.key === status ? "border-aubergine-800 font-medium text-aubergine-900" : "border-transparent text-ink-soft")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={<IconStar />} title={status === "pending" ? "All caught up" : "Nothing here"} description={status === "pending" ? "New reviews will appear here for you to approve." : undefined} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
}
