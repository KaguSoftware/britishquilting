import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { finaliseOrder } from "@/lib/checkout/finalise";
import { safeEqual } from "@/lib/checkout/helpers";
import { itemDetailText } from "./format";
import { ButtonLink } from "@/components/ui/button";
import { IconCheck, IconClock, IconWarning } from "@/components/icons";
import { cn, formatPence, storageUrl } from "@/lib/utils";
import { ClearCart } from "./clear-cart";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Order = {
  id: string;
  number: number;
  email: string;
  status: string;
  user_id: string | null;
  payment_provider: "stripe" | "paypal" | "invoice" | null;
  payment_ref: string | null;
  fulfilment: "delivery" | "collection";
  shipping_address: { fullName?: string; line1?: string; line2?: string; city?: string; postcode?: string } | null;
  shipping_name: string | null;
  subtotal_pence: number;
  discount_pence: number;
  shipping_pence: number;
  total_pence: number;
  vat_included_pence: number;
  discount_code: string | null;
  invoice_due_at: string | null;
  access_token: string;
};

type State = "paid" | "processing" | "failed" | "invoice";

async function load(orderId: string | undefined, token: string | undefined) {
  if (!orderId || !token || !/^[0-9a-f-]{36}$/i.test(orderId) || token.length > 100) return null;
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle<Order>();
  if (!order || !safeEqual(order.access_token, token)) return null;

  let state: State = order.payment_provider === "invoice" ? "invoice" : "paid";
  if (order.status === "awaiting_payment" || order.status === "pending") {
    state = "processing";
    // The webhook may not have landed yet: check Stripe directly and finalise (idempotent).
    if (order.payment_provider === "stripe" && order.payment_ref?.startsWith("pi_")) {
      const pi = await getStripe()?.paymentIntents.retrieve(order.payment_ref).catch(() => null);
      if (pi?.status === "succeeded" && pi.amount_received === order.total_pence && pi.currency === "gbp") {
        await finaliseOrder(order.id, "stripe", pi.id).catch((e) => console.error("success finalise", e));
        state = "paid";
      } else if (pi && ["requires_payment_method", "canceled"].includes(pi.status)) {
        state = "failed";
      }
    }
  } else if (order.status === "cancelled") {
    state = "failed";
  }

  const { data: items } = await db
    .from("order_items")
    .select("id, name, image_path, sale_mode, is_swatch, length_m, quantity, line_total_pence")
    .eq("order_id", order.id);
  return { order, items: items ?? [], state };
}

export default async function SuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const data = await load(one(sp.order), one(sp.token));

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-6 pb-28 pt-36 text-center md:pb-36 md:pt-44">
        <IconWarning className="mx-auto size-9 text-gold-600" strokeWidth={1.2} />
        <h1 className="font-display mt-6 text-4xl">We couldn&apos;t find that order</h1>
        <p className="mt-4 text-ink-soft">
          The link may be incomplete. If you&apos;ve just paid, your confirmation email has the full details, or our team can help.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/contact" size="lg">Contact us</ButtonLink>
          <ButtonLink href="/" size="lg" variant="secondary">Back to the shop</ButtonLink>
        </div>
      </div>
    );
  }

  const { order, items, state } = data;
  const collecting = order.fulfilment === "collection";
  const guest = !order.user_id;

  if (state === "failed") {
    return (
      <div className="mx-auto max-w-xl px-6 pb-28 pt-36 text-center md:pb-36 md:pt-44">
        <IconWarning className="mx-auto size-9 text-danger" strokeWidth={1.2} />
        <h1 className="font-display mt-6 text-4xl">Your payment didn&apos;t go through</h1>
        <p className="mt-4 text-ink-soft">No money has been taken. Your basket is still saved, so you can try again with another card or with PayPal.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/checkout" size="lg">Return to checkout</ButtonLink>
          <ButtonLink href="/contact" size="lg" variant="secondary">Get help</ButtonLink>
        </div>
      </div>
    );
  }

  const heading =
    state === "processing" ? "We're confirming your payment" : state === "invoice" ? "Order placed on account" : "Thank you, your order is confirmed";

  const timeline = [
    { t: state === "processing" ? "Payment confirming" : "Order confirmed", d: `A confirmation is on its way to ${order.email}.`, done: state !== "processing" },
    { t: "Measured and cut", d: "Each length is measured twice and cut by hand in our London workroom.", done: false },
    collecting
      ? { t: "Ready to collect", d: "We'll email you when it's ready, usually within one working day.", done: false }
      : { t: "Dispatched", d: "Sent within one to two working days, with a tracking link by email.", done: false },
    collecting ? { t: "Collected", d: "Bring your order number and we'll bring your fabric out.", done: false } : { t: "Delivered", d: order.shipping_name ?? "Tracked UK delivery.", done: false },
  ];

  const addr = order.shipping_address;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 md:px-8 md:pt-36">
      {state !== "processing" && <ClearCart />}

      <header className="border-b-2 border-aubergine-900 pb-8">
        <p className="eyebrow text-gold-600">Order No. {order.number}</p>
        <h1 className="font-display mt-4 max-w-3xl text-5xl leading-[1.02] md:text-7xl">{heading}</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-soft">
          {state === "processing"
            ? "Your bank is still confirming the payment. This usually takes a few seconds; refresh this page or look out for our email. You will not be charged twice."
            : state === "invoice"
              ? `We're preparing your order now. Your invoice, with bank details, has been emailed to ${order.email}.`
              : `We've emailed a receipt to ${order.email}. Thank you for shopping with British Quilting.`}
        </p>
        {state === "processing" && (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-aubergine-700">
            <IconClock className="size-4" /> Payment pending
          </p>
        )}
      </header>

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
        <div className="min-w-0">
          <h2 className="font-display text-3xl">What happens next</h2>
          <ol className="mt-8">
            {timeline.map((s, i) => (
              <li key={s.t} className="relative grid grid-cols-[2.5rem_1fr] gap-4 pb-9 last:pb-0">
                {i < timeline.length - 1 && <span aria-hidden className="absolute left-[1.2rem] top-10 bottom-1 w-px bg-stone-300" />}
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full border font-display text-lg tabular-nums",
                    s.done ? "border-aubergine-700 bg-aubergine-700 text-cream-50" : "border-stone-300 bg-cream-50 text-ink-soft",
                  )}
                >
                  {s.done ? <IconCheck className="size-4" /> : i + 1}
                </span>
                <div className="pt-1.5">
                  <p className="font-medium">{s.t}</p>
                  <p className="mt-1 text-sm text-ink-soft">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-14 grid gap-8 border-t border-stone-300 pt-8 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium">{collecting ? "Collection" : "Delivering to"}</h3>
              {collecting ? (
                <p className="mt-2 text-sm text-ink-soft">Our London workroom. Full address and opening hours are in your confirmation email.</p>
              ) : (
                addr && (
                  <address className="mt-2 text-sm not-italic leading-relaxed text-ink-soft">
                    {addr.fullName}
                    <br />
                    {addr.line1}
                    {addr.line2 ? <><br />{addr.line2}</> : null}
                    <br />
                    {addr.city}
                    <br />
                    {addr.postcode}
                  </address>
                )
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium">Payment</h3>
              <p className="mt-2 text-sm text-ink-soft">
                {order.payment_provider === "paypal" ? "PayPal" : order.payment_provider === "invoice" ? "Trade account, pay by invoice" : "Card"}
                {order.invoice_due_at && (
                  <>
                    <br />
                    Due by {new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date(order.invoice_due_at))}
                  </>
                )}
              </p>
            </div>
          </div>

          {guest ? (
            <div className="mt-14 border-l-2 border-gold-500 bg-cream-50 px-6 py-6">
              <h2 className="font-display text-2xl">Follow your order from start to finish</h2>
              <p className="mt-2 text-sm text-ink-soft">
                Create an account with {order.email} to see this order&apos;s progress, reorder favourite linings in a click and save your addresses.
              </p>
              <ButtonLink href={`/signup?next=${encodeURIComponent("/account/orders")}`} className="mt-5">
                Create an account
              </ButtonLink>
            </div>
          ) : (
            <div className="mt-14 flex flex-wrap gap-3">
              <ButtonLink href={`/account/orders/${order.number}`}>View in your account</ButtonLink>
              <ButtonLink href="/" variant="secondary">Continue shopping</ButtonLink>
            </div>
          )}
        </div>

        <aside aria-label="Order details">
          <div className="bg-cream-50 px-5 pb-6 pt-5 shadow-soft md:px-7">
            <div className="flex items-baseline justify-between border-b-2 border-aubergine-900 pb-3">
              <h2 className="font-display text-2xl">Receipt</h2>
              <span className="text-sm tabular-nums text-ink-soft">No. {order.number}</span>
            </div>
            <ul className="divide-y divide-stone-300/80">
              {items.map((i) => {
                const src = storageUrl(i.image_path);
                return (
                  <li key={i.id} className="flex gap-4 py-4">
                    <div className="relative size-14 shrink-0 overflow-hidden bg-cream-200">
                      {src && <Image src={src} alt="" fill sizes="56px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{i.name}</p>
                      <p className="mt-0.5 text-sm text-ink-soft">{itemDetailText(i)}</p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">{i.line_total_pence === 0 ? "Free" : formatPence(i.line_total_pence)}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="space-y-2 border-t border-stone-300 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="tabular-nums">{formatPence(order.subtotal_pence)}</dd>
              </div>
              {order.discount_pence > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Discount{order.discount_code ? ` (${order.discount_code})` : ""}</dt>
                  <dd className="tabular-nums text-success">-{formatPence(order.discount_pence)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">{collecting ? "Click & collect" : (order.shipping_name ?? "Delivery")}</dt>
                <dd className="tabular-nums">{order.shipping_pence === 0 ? "Free" : formatPence(order.shipping_pence)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t-2 border-aubergine-900 pt-4">
                <dt className="font-medium">{state === "invoice" ? "Total due" : "Total paid"}</dt>
                <dd className="font-display text-4xl tabular-nums">{formatPence(order.total_pence)}</dd>
              </div>
              <p className="text-right text-xs text-ink-soft">Includes {formatPence(order.vat_included_pence)} VAT</p>
            </dl>
          </div>
          <p className="mt-5 text-sm text-ink-soft">
            Questions? <Link href="/contact" className="text-aubergine-700 underline underline-offset-4">Contact our team</Link> and quote No. {order.number}.
          </p>
        </aside>
      </div>
    </div>
  );
}
