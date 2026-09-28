"use client";

import Link from "next/link";
import { IconArrowRight, IconScissors } from "@/components/icons";
import { setOrderStatus } from "@/lib/actions/admin/orders";
import { formatPence } from "@/lib/utils";
import { cutInstruction, timeAgo } from "../format";
import { useAction } from "../controls";
import { Button, ButtonLink } from "../ui";

export type BoardOrder = {
  id: string;
  number: number;
  email: string;
  status: string;
  total_pence: number;
  created_at: string;
  fulfilment: "delivery" | "collection";
  shipping_name: string | null;
  shipping_address: { full_name?: string } | null;
  customer_note: string | null;
  is_trade: boolean;
  order_items: { name: string; length_m: number | null; quantity: number; sale_mode: string; is_swatch: boolean }[];
};

export function PackBoard({ orders }: { orders: BoardOrder[] }) {
  const cols = [
    { key: "paid", title: "New", hint: "Paid, not started" },
    { key: "processing", title: "Being packed", hint: "Cutting and wrapping" },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {cols.map((c) => {
        const list = orders.filter((o) => o.status === c.key);
        return (
          <section key={c.key}>
            <div className="mb-3 flex items-baseline justify-between border-b border-ink/80 pb-2">
              <h2 className="font-display text-2xl text-aubergine-900">{c.title}</h2>
              <span className="text-sm text-stone-500">
                {list.length} · {c.hint}
              </span>
            </div>
            <div className="space-y-3">
              {list.length === 0 && <p className="border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-stone-500">Nothing here.</p>}
              {list.map((o) => (
                <BoardCard key={o.id} o={o} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BoardCard({ o }: { o: BoardOrder }) {
  const { run, pending } = useAction();
  return (
    <article className="rounded-[3px] border border-ink/12 bg-cream-50 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/admin/orders/${o.id}`} className="font-display text-xl text-aubergine-900 hover:underline">
            #{o.number}
          </Link>
          <p className="text-sm text-ink-soft">
            {o.shipping_address?.full_name ?? o.email} · {timeAgo(o.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm tabular-nums">{formatPence(o.total_pence)}</p>
          <p className="text-xs text-stone-500">{o.fulfilment === "collection" ? "Collecting" : o.shipping_name ?? "Delivery"}</p>
        </div>
      </header>
      <ul className="mt-3 divide-y divide-dashed divide-ink/15 border-y border-ink/10">
        {o.order_items.map((i, n) => (
          <li key={n} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate text-sm">{i.name}</span>
            <span className="shrink-0 font-display text-lg tabular-nums text-aubergine-800">{cutInstruction(i)}</span>
          </li>
        ))}
      </ul>
      {o.customer_note && <p className="mt-2 border-l-2 border-gold-500 pl-2 text-sm italic text-ink-soft">&ldquo;{o.customer_note}&rdquo;</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {o.status === "paid" ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => setOrderStatus(o.id, "processing"), {
                success: `Started packing #${o.number}`,
                undo: () => setOrderStatus(o.id, "paid", "Moved back to new"),
              })
            }
          >
            <IconScissors className="size-4" /> Start packing
          </Button>
        ) : (
          <ButtonLink size="sm" href={`/admin/orders/${o.id}`}>
            {o.fulfilment === "collection" ? "Mark ready to collect" : "Add tracking and send"} <IconArrowRight className="size-4" />
          </ButtonLink>
        )}
        <ButtonLink size="sm" variant="secondary" href={`/admin/orders/${o.id}/print`} target="_blank">
          Packing slip
        </ButtonLink>
      </div>
    </article>
  );
}
