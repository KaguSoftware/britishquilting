import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { OrderStatusBadge } from "@/components/ui/badge";
import { formatShortDate, orderRef, type OrderSummary } from "@/lib/data/account";
import { formatPence } from "@/lib/utils";

/** Orders set out like a tailor's ledger: hairline rules, tabular figures. */
export function OrderLedger({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="border-t-2 border-aubergine-900">
      {/* Column heads, desktop only */}
      <div className="hidden grid-cols-[7rem_9rem_minmax(0,1fr)_8rem_7rem_1.5rem] gap-4 border-b border-stone-300 py-3 text-xs text-stone-500 md:grid">
        <span>Order</span>
        <span>Placed</span>
        <span>Status</span>
        <span>Items</span>
        <span className="text-right">Total</span>
        <span />
      </div>
      <ul>
        {orders.map((o) => (
          <li key={o.id} className="border-b border-stone-300">
            <Link
              href={`/account/orders/${o.number}`}
              className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-5 transition-colors duration-300 hover:bg-cream-50 md:grid-cols-[7rem_9rem_minmax(0,1fr)_8rem_7rem_1.5rem] md:py-4"
            >
              <span className="font-display text-xl text-aubergine-900 md:text-lg">{orderRef(o.number)}</span>
              <span className="text-right text-sm tabular-nums md:order-none md:text-left md:text-ink-soft">
                <span className="md:hidden">{formatPence(o.total_pence)}</span>
                <span className="hidden md:inline">{formatShortDate(o.created_at)}</span>
              </span>
              <span className="col-span-2 flex flex-wrap items-center gap-3 md:col-span-1">
                <OrderStatusBadge status={o.status} />
                <span className="text-xs text-ink-soft md:hidden">{formatShortDate(o.created_at)}</span>
              </span>
              <span className="hidden text-sm text-ink-soft md:block">
                {o.item_count} {o.item_count === 1 ? "line" : "lines"}
                {o.fulfilment === "collection" && <span className="block text-xs">Collection</span>}
              </span>
              <span className="hidden text-right text-sm tabular-nums md:block">{formatPence(o.total_pence)}</span>
              <IconChevronRight className="hidden size-4 text-stone-500 transition-transform duration-300 ease-(--ease-silk) group-hover:translate-x-0.5 group-hover:text-aubergine-700 md:block" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
