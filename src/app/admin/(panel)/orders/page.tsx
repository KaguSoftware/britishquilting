import Link from "next/link";
import { IconChevronLeft, IconChevronRight, IconParcel } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { cn, formatPence } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/admin/ui";
import { ORDER_STATUS, ORDER_TABS, cutInstruction, formatDate, timeAgo, type OrderStatus } from "@/components/admin/format";
import { OrderSearch } from "@/components/admin/orders/order-search";
import { PackBoard, type BoardOrder } from "@/components/admin/orders/pack-board";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 50;

type SP = Promise<{ tab?: string; q?: string; view?: string; page?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tabKey = ORDER_TABS.some((t) => t.key === sp.tab) ? sp.tab! : sp.q ? "all" : "to_pack";
  const tab = ORDER_TABS.find((t) => t.key === tabKey)!;
  const q = (sp.q ?? "").trim().replace(/[%,()]/g, "");
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const board = tabKey === "to_pack" && sp.view === "board";
  const { db } = await staffDb();

  // Same tab/search filters on both queries, so the count matches exactly what the row query returns.
  let rowsQuery = db
    .from("orders")
    .select(
      "id, number, email, status, total_pence, created_at, fulfilment, payment_provider, paid_at, shipping_address, shipping_name, is_trade, customer_note, order_items(name, length_m, quantity, sale_mode, is_swatch)",
    )
    .order("created_at", { ascending: tabKey === "to_pack" })
    .range(offset, offset + PAGE_SIZE - 1);
  let countQuery = db.from("orders").select("id", { count: "exact", head: true });
  if (tab.statuses.length) {
    rowsQuery = rowsQuery.in("status", tab.statuses as unknown as string[]);
    countQuery = countQuery.in("status", tab.statuses as unknown as string[]);
  }
  if (tabKey === "invoice_unpaid") {
    rowsQuery = rowsQuery.eq("payment_provider", "invoice").is("paid_at", null).not("status", "in", "(cancelled,refunded,pending)");
    countQuery = countQuery.eq("payment_provider", "invoice").is("paid_at", null).not("status", "in", "(cancelled,refunded,pending)");
  }
  if (q) {
    const n = q.replace(/^#/, "");
    if (/^\d+$/.test(n)) {
      rowsQuery = rowsQuery.eq("number", Number(n));
      countQuery = countQuery.eq("number", Number(n));
    } else {
      rowsQuery = rowsQuery.or(`email.ilike.%${q}%,shipping_address->>full_name.ilike.%${q}%`);
      countQuery = countQuery.or(`email.ilike.%${q}%,shipping_address->>full_name.ilike.%${q}%`);
    }
  }

  const [{ data: orders }, { count: totalCount }, ...counts] = await Promise.all([
    rowsQuery,
    countQuery,
    db.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing"]),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "ready_for_collection"),
    db.from("orders").select("id", { count: "exact", head: true }).eq("payment_provider", "invoice").is("paid_at", null).not("status", "in", "(cancelled,refunded,pending)"),
  ]);
  const badge: Record<string, number> = { to_pack: counts[0].count ?? 0, ready_for_collection: counts[1].count ?? 0, invoice_unpaid: counts[2].count ?? 0 };
  const rows = orders ?? [];
  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));

  const href = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { tab: tabKey, q: sp.q, view: sp.view, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `/admin/orders?${u}`;
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Everything customers have bought. Start with the ones to pack."
        actions={
          tabKey === "to_pack" ? (
            <div className="flex rounded-[3px] border border-ink/15 bg-cream-50 p-0.5 text-sm">
              <Link href={href({ view: undefined })} className={cn("rounded-[2px] px-3 py-1.5", !board ? "bg-aubergine-800 text-cream-50" : "text-ink-soft")}>
                List
              </Link>
              <Link href={href({ view: "board" })} className={cn("rounded-[2px] px-3 py-1.5", board ? "bg-aubergine-800 text-cream-50" : "text-ink-soft")}>
                Packing board
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" aria-label="Order status">
          {ORDER_TABS.map((t) => (
            <Link
              key={t.key}
              href={href({ tab: t.key, view: t.key === "to_pack" ? sp.view : undefined, page: undefined })}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                t.key === tabKey ? "border-aubergine-800 font-medium text-aubergine-900" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {t.label}
              {!!badge[t.key] && <span className="rounded-[2px] bg-gold-500 px-1.5 text-[0.7rem] font-semibold tabular-nums text-aubergine-950">{badge[t.key]}</span>}
            </Link>
          ))}
        </nav>
        <OrderSearch initial={sp.q ?? ""} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconParcel />}
          title={q ? "No orders match that search" : tabKey === "to_pack" ? "All packed" : "Nothing here"}
          description={q ? "Try the order number on its own, e.g. 10023, or part of the customer's email." : tabKey === "to_pack" ? "New paid orders will appear here as they come in." : "No orders in this list right now."}
          action={q ? <ButtonLink href="/admin/orders?tab=all" variant="secondary">Clear the search</ButtonLink> : undefined}
        />
      ) : board ? (
        <PackBoard orders={rows as unknown as BoardOrder[]} />
      ) : (
        <div className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          <table className="w-full text-sm">
            <thead className="hidden border-b border-ink/15 text-left text-xs text-stone-500 md:table-header-group">
              <tr>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">What they bought</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((o) => {
                const s = ORDER_STATUS[o.status as OrderStatus];
                const items = (o.order_items ?? []) as { name: string; length_m: number | null; quantity: number; sale_mode: string; is_swatch: boolean }[];
                const link = `/admin/orders/${o.id}`;
                return (
                  <tr key={o.id} className="group relative block px-4 py-3 hover:bg-cream-100 md:table-row md:p-0">
                    <td className="block md:table-cell md:px-5 md:py-3.5">
                      <Link href={link} className="after:absolute after:inset-0">
                        <span className="font-display text-lg tabular-nums text-aubergine-900">#{o.number}</span>
                      </Link>
                      <span className="ml-2 text-xs text-stone-500 md:ml-0 md:block">{timeAgo(o.created_at)}</span>
                    </td>
                    <td className="block md:table-cell md:px-3 md:py-3.5">
                      <span className="font-medium">{o.shipping_address?.full_name ?? o.email}</span>
                      <span className="block text-xs text-stone-500">
                        {o.fulfilment === "collection" ? "Collecting in person" : o.shipping_name ?? "Delivery"}
                        {o.is_trade ? " · Trade" : ""}
                        {o.payment_provider === "invoice" ? (o.paid_at ? " · Invoice paid" : " · On invoice") : ""}
                      </span>
                    </td>
                    <td className="mt-1 block text-ink-soft md:mt-0 md:table-cell md:max-w-xs md:px-3 md:py-3.5">
                      <span className="line-clamp-2">
                        {items.map((i) => `${i.name} (${cutInstruction(i)})`).join(", ")}
                      </span>
                    </td>
                    <td className="mt-2 inline-block md:mt-0 md:table-cell md:px-3 md:py-3.5">
                      <Badge tone={s?.tone}>{s?.label ?? o.status}</Badge>
                    </td>
                    <td className="absolute right-4 top-3 font-medium tabular-nums md:static md:table-cell md:px-5 md:py-3.5 md:text-right">
                      {formatPence(o.total_pence)}
                      <span className="hidden text-xs font-normal text-stone-500 md:block">{formatDate(o.created_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-sm text-stone-500">
            Page {page} of {totalPages} &middot; {totalCount ?? 0} order{totalCount === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <ButtonLink
              href={href({ page: page > 1 ? String(page - 1) : undefined })}
              variant="secondary"
              size="sm"
              className={cn(page <= 1 && "pointer-events-none opacity-40")}
            >
              <IconChevronLeft className="size-4" /> Previous
            </ButtonLink>
            <ButtonLink
              href={href({ page: page < totalPages ? String(page + 1) : undefined })}
              variant="secondary"
              size="sm"
              className={cn(page >= totalPages && "pointer-events-none opacity-40")}
            >
              Next <IconChevronRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
