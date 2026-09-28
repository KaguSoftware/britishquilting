import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconExternal, IconPin, IconVan } from "@/components/icons";
import { FabricPlaceholder } from "@/components/shop/product-card";
import { OrderStatusBadge } from "@/components/ui/badge";
import { formatDate, formatShortDate, formatTime, orderRef, requireViewer } from "@/lib/data/account";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMetres, formatPence, storageUrl } from "@/lib/utils";

type Addr = { full_name?: string; name?: string; line1?: string; line2?: string | null; city?: string; county?: string | null; postcode?: string; country?: string };

const eventTitle: Record<string, string> = {
  created: "Order placed",
  paid: "Payment received",
  shipped: "On its way",
  refund: "Refund issued",
  note: "Note from the workroom",
  email: "Email sent",
};

const statusTitle: Record<string, string> = {
  pending: "Order received",
  awaiting_payment: "Awaiting payment",
  paid: "Payment received",
  processing: "Being measured and cut",
  shipped: "Dispatched",
  ready_for_collection: "Ready to collect",
  collected: "Collected",
  delivered: "Delivered",
  cancelled: "Order cancelled",
  refunded: "Refunded",
};

export async function generateMetadata({ params }: PageProps<"/account/orders/[number]">) {
  const { number } = await params;
  return { title: `Order ${number}` };
}

export default async function OrderDetailPage({ params }: PageProps<"/account/orders/[number]">) {
  const { number } = await params;
  const viewer = await requireViewer(`/account/orders/${number}`);
  const n = Number(number);
  if (!Number.isInteger(n) || n <= 0) notFound();

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, number, status, fulfilment, shipping_address, billing_address, shipping_name, subtotal_pence, discount_pence, shipping_pence, total_pence, vat_included_pence, discount_code, payment_provider, is_trade, invoice_due_at, customer_note, created_at, paid_at, order_items(id, name, image_path, sale_mode, is_swatch, length_m, quantity, unit_price_pence, line_total_pence), order_events(id, kind, message, data, visible_to_customer, created_at), shipments(id, carrier, tracking_number, tracking_url, shipped_at)",
    )
    .eq("number", n)
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (!order) notFound();

  const items = order.order_items ?? [];
  const shipments = [...(order.shipments ?? [])].sort((a, b) => +new Date(b.shipped_at) - +new Date(a.shipped_at));
  const events = [...(order.order_events ?? [])]
    .filter((e) => e.visible_to_customer)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  if (!events.some((e) => e.kind === "created")) {
    events.push({ id: "placed", kind: "created", message: null, data: null, visible_to_customer: true, created_at: order.created_at });
  }
  const addr = (order.shipping_address ?? null) as Addr | null;
  const cancelled = order.status === "cancelled" || order.status === "refunded";

  return (
    <article>
      <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-aubergine-800">
        <IconArrowLeft className="size-4" /> All orders
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-aubergine-900 pb-6">
        <div>
          <h2 className="font-display text-4xl text-aubergine-900 md:text-5xl">Order {orderRef(order.number)}</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Placed {formatDate(order.created_at)} at {formatTime(order.created_at)}
            {order.is_trade && <span className="ml-2 border-l border-stone-300 pl-2 text-gold-600">Trade order</span>}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      {/* Tracking */}
      {shipments.length > 0 && (
        <section aria-label="Tracking" className="mt-8 space-y-3">
          {shipments.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-4 border border-stone-300 bg-cream-50 px-5 py-4">
              <IconVan className="size-6 text-gold-600" strokeWidth={1.25} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {s.carrier.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}, dispatched {formatShortDate(s.shipped_at)}
                </p>
                <p className="font-mono text-xs tracking-wide text-ink-soft">{s.tracking_number}</p>
              </div>
              {s.tracking_url && (
                <a
                  href={s.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-aubergine-700 underline-offset-4 hover:underline"
                >
                  Track parcel <IconExternal className="size-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
        {/* Items and totals */}
        <section aria-labelledby="items-h">
          <h3 id="items-h" className="font-display text-2xl text-aubergine-900">Cut list</h3>
          <ul className="mt-4 border-t border-stone-300">
            {items.map((it) => {
              const src = storageUrl(it.image_path);
              const measure = it.is_swatch
                ? "Swatch"
                : it.sale_mode === "metre" && it.length_m != null
                  ? `${formatMetres(Number(it.length_m))}${it.quantity > 1 ? ` × ${it.quantity}` : ""}`
                  : `Qty ${it.quantity}`;
              return (
                <li key={it.id} className="flex gap-4 border-b border-stone-300 py-4">
                  <div className="relative size-16 shrink-0 overflow-hidden bg-cream-200">
                    {src ? <Image src={src} alt="" fill sizes="64px" className="object-cover" /> : <FabricPlaceholder hex={null} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg leading-tight">{it.name}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {measure}
                      {!it.is_swatch && <span className="text-stone-500"> at {formatPence(it.unit_price_pence)}{it.sale_mode === "metre" ? " / m" : ""}</span>}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">{formatPence(it.line_total_pence)}</p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={formatPence(order.subtotal_pence)} />
            {order.discount_pence > 0 && (
              <Row label={order.discount_code ? `Discount (${order.discount_code})` : "Discount"} value={`−${formatPence(order.discount_pence)}`} />
            )}
            <Row
              label={order.fulfilment === "collection" ? "Collection" : order.shipping_name ?? "Delivery"}
              value={order.shipping_pence === 0 ? "Free" : formatPence(order.shipping_pence)}
            />
            <div className="stitch my-3" />
            <Row label="Total" value={formatPence(order.total_pence)} strong />
            {order.vat_included_pence > 0 && <p className="text-right text-xs text-stone-500">Includes {formatPence(order.vat_included_pence)} VAT</p>}
          </dl>

          <div className="mt-10 grid gap-8 border-t border-stone-300 pt-8 sm:grid-cols-2">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <IconPin className="size-4 text-gold-600" /> {order.fulfilment === "collection" ? "Collection" : "Delivering to"}
              </h4>
              {order.fulfilment === "collection" ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">From our London workroom. We&apos;ll email you when it&apos;s ready.</p>
              ) : addr ? (
                <address className="mt-2 text-sm not-italic leading-relaxed text-ink-soft">
                  {[addr.full_name ?? addr.name, addr.line1, addr.line2, addr.city, addr.county, addr.postcode].filter(Boolean).map((l, i) => (
                    <span key={i} className="block">{l}</span>
                  ))}
                </address>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Not recorded</p>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium">Payment</h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {order.payment_provider === "invoice"
                  ? `On account${order.invoice_due_at ? `, due ${formatDate(order.invoice_due_at)}` : ""}`
                  : order.payment_provider === "paypal"
                    ? "PayPal"
                    : order.payment_provider === "stripe"
                      ? "Card"
                      : "Not yet paid"}
                {order.paid_at && <span className="block">Paid {formatDate(order.paid_at)}</span>}
              </p>
            </div>
          </div>
          {order.customer_note && (
            <p className="mt-8 border-l-2 border-gold-500 pl-4 text-sm italic leading-relaxed text-ink-soft">&ldquo;{order.customer_note}&rdquo;</p>
          )}
        </section>

        {/* Timeline */}
        <section aria-labelledby="progress-h">
          <h3 id="progress-h" className="font-display text-2xl text-aubergine-900">Progress</h3>
          <ol className="relative mt-6">
            {events.map((e, i) => {
              const latest = i === 0;
              const status = e.kind === "status" ? String((e.data as { status?: string; to?: string } | null)?.status ?? (e.data as { to?: string } | null)?.to ?? "") : "";
              const title = e.kind === "status" ? statusTitle[status] ?? "Status updated" : eventTitle[e.kind] ?? "Update";
              return (
                <li key={e.id} className="relative flex gap-5 pb-8 last:pb-0">
                  {i < events.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 bottom-0 w-px bg-stone-300" />}
                  <span
                    aria-hidden
                    className={cn(
                      "relative mt-1.5 size-[15px] shrink-0 rotate-45 border",
                      latest
                        ? cancelled
                          ? "border-danger bg-danger"
                          : "border-aubergine-700 bg-aubergine-700 ring-4 ring-aubergine-100"
                        : "border-gold-500 bg-cream-100",
                    )}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-sm", latest ? "font-medium text-aubergine-900" : "text-ink")}>{title}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-stone-500">
                      <time dateTime={e.created_at}>{formatShortDate(e.created_at)}, {formatTime(e.created_at)}</time>
                    </p>
                    {e.message && !e.message.startsWith("Marked as") && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{e.message}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-10 border-t border-stone-300 pt-6 text-sm leading-relaxed text-ink-soft">
            Something not right? <Link href="/contact" className="text-aubergine-700 underline underline-offset-4">Contact us</Link> and quote {orderRef(order.number)}.
          </p>
        </section>
      </div>
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-display text-xl text-aubergine-900" : "text-ink-soft"}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-display text-xl text-aubergine-900")}>{value}</dd>
    </div>
  );
}
