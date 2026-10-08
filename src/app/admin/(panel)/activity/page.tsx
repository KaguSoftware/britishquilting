import Link from "next/link";
import { ownerDb } from "@/lib/actions/admin/guard";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/components/admin/format";

export const metadata = { title: "Activity log" };

const LABELS: Record<string, string> = {
  "order.status": "changed an order's status",
  "order.shipped": "marked an order as sent",
  "order.invoice_paid": "marked an invoice as paid",
  "order.note": "edited an order note",
  "order.refund": "refunded an order",
  "order.cancel": "cancelled an order",
  "category.restore": "restored a category",
  "discount.restore": "restored a discount code",
  "discount.enable": "switched on a discount code",
  "discount.disable": "switched off a discount code",
  "expense.create": "added an expense",
  "expense.update": "edited an expense",
  "expense.delete": "deleted an expense",
  "expense.restore": "restored an expense",
  "finance.settings": "changed fee rates",
  "review.delete": "deleted a review",
  "newsletter.resubscribe": "resubscribed someone to the newsletter",
  "newsletter.unsubscribe": "unsubscribed someone from the newsletter",
  "product.create": "added a product",
  "product.update": "edited a product",
  "product.delete": "deleted a product",
  "product.show": "put a product on the shop",
  "product.hide": "hid a product",
  "product.stock": "changed stock",
  "category.create": "added a category",
  "category.update": "edited a category",
  "category.delete": "deleted a category",
  "category.reorder": "reordered categories",
  "staff.promote": "gave someone back office access",
  "staff.remove": "removed someone's back office access",
  "discount.create": "created a discount code",
  "discount.update": "edited a discount code",
  "discount.delete": "deleted a discount code",
  "shipping.update": "changed delivery options",
  "settings.update": "changed settings",
  "post.create": "started a journal post",
  "post.update": "edited a journal post",
  "post.publish": "published a journal post",
  "post.delete": "deleted a journal post",
};

function link(entity: string, id: string | null) {
  if (!id) return null;
  if (entity === "order") return `/admin/orders/${id}`;
  if (entity === "product") return `/admin/products/${id}`;
  if (entity === "post") return `/admin/journal/${id}`;
  if (entity === "profile") return `/admin/customers/${id}`;
  return null;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const sp = await searchParams;
  const limit = Math.min(Number(sp.limit) || 100, 1000);
  const { db } = await ownerDb();
  const { data } = await db.from("audit_log").select("*, actor:profiles(full_name, email)").order("created_at", { ascending: false }).limit(limit);
  const rows = data ?? [];
  // Deleted things have nothing to open, so their rows don't link.
  const latest = new Map<string, string>();
  for (const r of rows) if (!latest.has(`${r.entity}:${r.entity_id}`)) latest.set(`${r.entity}:${r.entity_id}`, String(r.action));
  const deleted = new Set([...latest].filter(([, action]) => action.endsWith(".delete")).map(([key]) => key));
  return (
    <div>
      <PageHeader title="Activity log" description="Who changed what, and when. Useful if something looks different and you want to know why." />
      {rows.length === 0 ? (
        <EmptyState title="Nothing yet" description="Changes made in the back office will be listed here." />
      ) : (
        <ol className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          {rows.map((r) => {
            const href = deleted.has(`${r.entity}:${r.entity_id}`) ? null : link(r.entity, r.entity_id);
            const detail = (r.data?.name ?? r.data?.code ?? r.data?.company ?? r.data?.email ?? null) as string | null;
            return (
              <li key={r.id} className="flex flex-col gap-0.5 border-b border-ink/10 px-4 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-4 md:px-5">
                <span className="w-36 shrink-0 text-xs tabular-nums text-stone-500">{formatDateTime(r.created_at)}</span>
                <span className="text-sm">
                  <span className="font-medium">{r.actor?.full_name ?? r.actor?.email ?? "Someone"}</span> {LABELS[r.action] ?? r.action}
                  {detail && <span className="text-ink-soft"> &middot; {detail}</span>}
                  {href && (
                    <Link href={href} className="ml-2 text-aubergine-700 underline-offset-2 hover:underline">
                      View
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length === limit && (
        <p className="mt-4 text-center">
          <Link href={`/admin/activity?limit=${limit + 200}`} className="text-sm text-aubergine-700 underline">
            Show older
          </Link>
        </p>
      )}
    </div>
  );
}
