import { staffDb } from "@/lib/actions/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { DiscountManager } from "@/components/admin/discount-manager";
import type { DiscountRow } from "@/components/admin/format";

export const metadata = { title: "Discounts" };

export default async function DiscountsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const { db } = await staffDb();
  const { data } = await db.from("discount_codes").select("*").order("created_at", { ascending: false });
  return (
    <div>
      <PageHeader title="Discounts" description="Codes customers type at checkout. Switch one off at any time." />
      <DiscountManager discounts={(data ?? []) as DiscountRow[]} startNew={Boolean(sp.new)} />
    </div>
  );
}
