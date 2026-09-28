import Link from "next/link";
import { IconTape } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { TradeCard, type TradeApp } from "@/components/admin/trade-card";

export const metadata = { title: "Trade applications" };

export default async function TradePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "pending" } = await searchParams;
  const { db } = await staffDb();
  let q = db
    .from("trade_applications")
    .select("*, profile:profiles!trade_applications_user_id_fkey(full_name, email, phone)")
    .order("created_at", { ascending: show === "pending" });
  if (show !== "all") q = q.eq("status", show === "pending" ? "pending" : show);
  const { data, error } = await q.limit(200);
  if (error) console.error(error);
  const apps = (data ?? []) as TradeApp[];

  const tabs = [
    { key: "pending", label: "Waiting" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Declined" },
    { key: "all", label: "All" },
  ];

  return (
    <div>
      <PageHeader title="Trade applications" description="Curtain makers and interior designers asking for trade prices. Approving gives them trade prices straight away and emails them." />
      <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/trade?show=${t.key}`}
            className={cn("min-h-11 shrink-0 border-b-2 px-3 py-2.5 text-sm", t.key === show ? "border-aubergine-800 font-medium text-aubergine-900" : "border-transparent text-ink-soft")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {apps.length === 0 ? (
        <EmptyState icon={<IconTape />} title={show === "pending" ? "No one waiting" : "Nothing here"} description={show === "pending" ? "New applications will appear here." : undefined} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {apps.map((a) => (
            <TradeCard key={a.id} app={a} />
          ))}
        </div>
      )}
    </div>
  );
}
