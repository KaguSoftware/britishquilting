"use client";

import { useActionState } from "react";
import { IconCheck, IconExternal } from "@/components/icons";
import { trackOrder, type TrackResult } from "@/lib/actions/shop";
import { cn } from "@/lib/utils";
import { Label, btnPrimary, inputCls } from "./bits";

const STAGES_DELIVERY = [
  ["placed", "Order placed"],
  ["paid", "Payment confirmed"],
  ["processing", "Measuring & cutting"],
  ["shipped", "On its way"],
  ["delivered", "Delivered"],
] as const;
const STAGES_COLLECTION = [
  ["placed", "Order placed"],
  ["paid", "Payment confirmed"],
  ["processing", "Measuring & cutting"],
  ["ready_for_collection", "Ready to collect"],
  ["collected", "Collected"],
] as const;

const RANK: Record<string, number> = {
  pending: 0, awaiting_payment: 0, paid: 1, processing: 2, shipped: 3, ready_for_collection: 3, delivered: 4, collected: 4,
};

const fmt = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackResult, FormData>(trackOrder, null);

  return (
    <div className="grid gap-14 lg:grid-cols-[380px_1fr] lg:gap-20">
      <form action={action} className="space-y-5 lg:sticky lg:top-28 lg:self-start" noValidate={false}>
        <div>
          <Label htmlFor="t-number" hint="From your confirmation email">Order number</Label>
          <input id="t-number" name="number" required inputMode="numeric" autoComplete="off" placeholder="e.g. 10423" className={cn(inputCls, "font-display text-2xl md:text-2xl tabular-nums")} />
        </div>
        <div>
          <Label htmlFor="t-email">Email used at checkout</Label>
          <input id="t-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={inputCls} />
        </div>
        <button className={cn(btnPrimary, "w-full")} disabled={pending}>{pending ? "Looking it up..." : "Track order"}</button>
        {state && !state.ok && (
          <p role="alert" className="border-l-2 border-danger pl-4 text-sm text-ink-soft">{state.message}</p>
        )}
      </form>

      <div aria-live="polite">
        {state?.ok ? <Timeline o={state.order} /> : <Placeholder />}
      </div>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="border border-dashed border-stone-300 p-10 text-ink-soft md:p-14">
      <p className="font-display text-3xl text-ink">Where your cloth is, at a glance.</p>
      <p className="mt-3 max-w-md">Enter your order number and email to see each step, from our cutting table to your door. Signed-in customers can also see every order under their account.</p>
    </div>
  );
}

function Timeline({ o }: { o: Extract<TrackResult, { ok: true }>["order"] }) {
  const cancelled = o.status === "cancelled" || o.status === "refunded";
  const stages = o.fulfilment === "collection" ? STAGES_COLLECTION : STAGES_DELIVERY;
  const rank = RANK[o.status] ?? 0;
  const statusLabel = cancelled ? (o.status === "cancelled" ? "Cancelled" : "Refunded") : stages[rank][1];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-stone-300 pb-6">
        <h2 className="font-display text-4xl md:text-5xl">Order <span className="tabular-nums">#{o.number}</span></h2>
        <p className="text-ink-soft">Placed {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <p className="mt-6 text-lg">
        Status: <span className={cn("font-medium", cancelled ? "text-danger" : "text-aubergine-700")}>{statusLabel}</span>
      </p>

      {!cancelled && (
        <ol className="mt-10">
          {stages.map(([key, label], i) => {
            const done = i <= rank;
            const current = i === rank;
            return (
              <li key={key} className="relative flex gap-6 pb-10 last:pb-0">
                {i < stages.length - 1 && (
                  <span aria-hidden className={cn("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px", i < rank ? "bg-aubergine-700" : "bg-[repeating-linear-gradient(180deg,var(--color-stone-300)_0_4px,transparent_4px_8px)]")} />
                )}
                <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center border text-xs tabular-nums", done ? "border-aubergine-700 bg-aubergine-700 text-cream-50" : "border-stone-300 bg-cream-100 text-stone-500")}>
                  {done && !current ? <IconCheck className="size-3.5" /> : i + 1}
                </span>
                <div className="pt-1">
                  <p className={cn("font-display text-2xl leading-none", !done && "text-stone-500")}>{label}</p>
                  {current && <p className="mt-2 text-sm text-ink-soft">This is where your order is now.</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {o.shipments.length > 0 && (
        <div className="mt-12 border-t border-stone-300 pt-8">
          <h3 className="font-display text-2xl">Tracking</h3>
          <ul className="mt-4 divide-y divide-stone-300 border-y border-stone-300">
            {o.shipments.map((s) => (
              <li key={s.trackingNumber} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                <span><span className="capitalize">{s.carrier.replace(/_/g, " ")}</span> <span className="text-ink-soft tabular-nums">{s.trackingNumber}</span></span>
                {s.trackingUrl && (
                  <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-aubergine-700 hover:underline">
                    Track with carrier <IconExternal className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {o.events.filter((e) => e.message).length > 0 && (
        <div className="mt-12">
          <h3 className="font-display text-2xl">Updates from us</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {o.events.filter((e) => e.message).map((e, i) => (
              <li key={i} className="grid grid-cols-[110px_1fr] gap-4 border-b border-stone-300/70 pb-3">
                <time className="text-stone-500 tabular-nums" dateTime={e.createdAt}>{fmt(e.createdAt)}</time>
                <span className="text-ink-soft">{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
