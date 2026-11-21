import { staffDb } from "@/lib/actions/admin/guard";
import { DiscountManager } from "@/components/admin/discount-manager";
import type { DiscountRow } from "@/components/admin/format";

export const metadata = { title: "Discount codes" };

export default async function DiscountCodesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const { db } = await staffDb();
  const { data } = await db.from("discount_codes").select("*").order("created_at", { ascending: false });
  return (
    <div>
      <p className="mb-5 max-w-2xl text-[0.95rem] text-ink-soft">Codes customers type at checkout. Switch one off at any time.</p>
      <DiscountManager discounts={(data ?? []) as DiscountRow[]} startNew={Boolean(sp.new)} />
    </div>
  );
}
