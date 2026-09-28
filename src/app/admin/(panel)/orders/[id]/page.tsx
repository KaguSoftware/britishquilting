import Link from "next/link";
import { notFound } from "next/navigation";
import { IconPrint } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { formatPence, storageUrl } from "@/lib/utils";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/admin/ui";
import { CopyButton } from "@/components/admin/controls";
import { ORDER_STATUS, addressLines, carrierLabel, cutInstruction, formatDateTime, type Address, type OrderStatus } from "@/components/admin/format";
import { OrderActions } from "@/components/admin/orders/order-actions";
import { OrderNotes } from "@/components/admin/orders/order-notes";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await staffDb();
  const [{ data: order }, { data: items }, { data: events }, { data: shipments }, { data: refunds }, { data: previous }] = await Promise.all([
    db.from("orders").select("*").eq("id", id).maybeSingle(),
    db.from("order_items").select("*").eq("order_id", id),
    db.from("order_events").select("*, actor:profiles(full_name, email)").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("shipments").select("*").eq("order_id", id).order("shipped_at", { ascending: false }),
    db.from("order_refunds").select("*, actor:profiles(full_name, email)").eq("order_id", id).order("created_at", { ascending: true }),
    db.rpc("order_previous_status", { p_order_id: id }),
  ]);
  if (!order) notFound();
  const { data: profile } = order.user_id ? await db.from("profiles").select("id, full_name, phone, company_name").eq("id", order.user_id).maybeSingle() : { data: null };

  const status = ORDER_STATUS[order.status as OrderStatus];
  const ship = order.shipping_address as Address | null;
  const lines = addressLines(ship);
  const cutItems = (items ?? []).filter((i) => !i.is_swatch);
  const swatches = (items ?? []).filter((i) => i.is_swatch);

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/orders", label: "All orders" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Order #{order.number}
            <Badge tone={status?.tone} className="text-sm">
              {status?.label ?? order.status}
            </Badge>
          </span>
        }
        description={`Placed ${formatDateTime(order.created_at)}. ${status?.help ?? ""}`}
        actions={
          <ButtonLink href={`/admin/orders/${order.id}/print`} target="_blank" variant="secondary">
            <IconPrint className="size-4" /> Packing slip
          </ButtonLink>
        }
      />

      <OrderActions
        order={{
          id: order.id,
          number: order.number,
          status: order.status,
          previous: (previous as OrderStatus | null) ?? null,
          fulfilment: order.fulfilment,
          payment_provider: order.payment_provider,
          paid_at: order.paid_at,
          total_pence: order.total_pence,
          refunded_pence: order.refunded_pence ?? 0,
          email: order.email,
        }}
        items={(items ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          sale_mode: i.sale_mode,
          is_swatch: i.is_swatch,
          length_m: i.length_m == null ? null : Number(i.length_m),
          quantity: i.quantity,
          line_total_pence: i.line_total_pence,
          product_id: i.product_id,
        }))}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="What to cut and pack" description={`${cutItems.length} line${cutItems.length === 1 ? "" : "s"}${swatches.length ? ` plus ${swatches.length} swatch${swatches.length === 1 ? "" : "es"}` : ""}`} bodyClassName="p-0">
            <ul className="divide-y divide-ink/10">
              {[...cutItems, ...swatches].map((i) => {
                const img = storageUrl(i.image_path);
                return (
                  <li key={i.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-[2px] border border-ink/10 bg-cream-200">
                      {img && <img src={img} alt="" className="absolute inset-0 size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {i.product_id ? (
                        <Link href={`/admin/products/${i.product_id}`} className="font-medium hover:underline">
                          {i.name}
                        </Link>
                      ) : (
                        <p className="font-medium">{i.name}</p>
                      )}
                      <p className="text-sm text-stone-500">
                        {formatPence(i.unit_price_pence)} {i.sale_mode === "metre" && !i.is_swatch ? "per metre" : "each"} · {formatPence(i.line_total_pence)}
                      </p>
                    </div>
                    <p className={"shrink-0 text-right font-display tabular-nums leading-none " + (i.is_swatch ? "text-xl text-ink-soft" : "text-[1.9rem] text-aubergine-800 md:text-[2.3rem]")}>
                      {cutInstruction({ ...i, length_m: i.length_m == null ? null : Number(i.length_m) })}
                    </p>
                  </li>
                );
              })}
            </ul>
            <dl className="space-y-1.5 border-t border-ink/15 px-5 py-4 text-sm">
              <Row label="Items" value={formatPence(order.subtotal_pence)} />
              {order.discount_pence > 0 && <Row label={`Discount${order.discount_code ? ` (${order.discount_code})` : ""}`} value={`-${formatPence(order.discount_pence)}`} />}
              <Row label={order.fulfilment === "collection" ? "Collection" : order.shipping_name ?? "Delivery"} value={order.shipping_pence ? formatPence(order.shipping_pence) : "Free"} />
              <div className="flex justify-between border-t border-ink/15 pt-2 text-base font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPence(order.total_pence)}</dd>
              </div>
              {order.vat_included_pence > 0 && <p className="text-right text-xs text-stone-500">Includes {formatPence(order.vat_included_pence)} VAT</p>}
            </dl>
          </Card>

          {order.customer_note && (
            <div className="border-l-2 border-gold-500 bg-gold-100/60 px-5 py-4">
              <p className="text-sm font-medium text-gold-600">Note from the customer</p>
              <p className="mt-1 text-[0.95rem] italic">&ldquo;{order.customer_note}&rdquo;</p>
            </div>
          )}

          <Card title="History" description="Everything that has happened to this order">
            <ol className="relative space-y-5 border-l border-ink/15 pl-5">
              {(events ?? []).map((e) => (
                <li key={e.id} className="relative">
                  <span className={"absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-cream-50 " + (e.kind === "refund" || e.kind === "stock_short" ? "bg-danger" : e.kind === "note" ? "bg-stone-500" : "bg-aubergine-700")} />
                  <p className="text-[0.95rem]">{e.message ?? e.kind}</p>
                  <p className="text-xs text-stone-500">
                    {formatDateTime(e.created_at)}
                    {e.actor ? ` · ${e.actor.full_name ?? e.actor.email}` : ""}
                    {!e.visible_to_customer ? " · Staff only" : ""}
                  </p>
                </li>
              ))}
              <li className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-cream-50 bg-gold-500" />
                <p className="text-[0.95rem]">Order placed</p>
                <p className="text-xs text-stone-500">{formatDateTime(order.created_at)}</p>
              </li>
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <p className="font-medium">{ship?.full_name ?? profile?.full_name ?? "Guest"}</p>
            {profile?.company_name && <p className="text-sm text-ink-soft">{profile.company_name}</p>}
            <a href={`mailto:${order.email}`} className="mt-1 block break-all text-sm text-aubergine-700 hover:underline">
              {order.email}
            </a>
            {(ship?.phone || profile?.phone) && (
              <a href={`tel:${ship?.phone ?? profile?.phone}`} className="block text-sm text-aubergine-700 hover:underline">
                {ship?.phone ?? profile?.phone}
              </a>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {order.is_trade && <Badge tone="gold">Trade customer</Badge>}
              {profile ? (
                <Link href={`/admin/customers/${profile.id}`} className="text-sm text-aubergine-700 hover:underline">
                  See all their orders
                </Link>
              ) : (
                <span className="text-xs text-stone-500">Checked out as a guest</span>
              )}
            </div>
          </Card>

          <Card
            title={order.fulfilment === "collection" ? "Collecting in person" : "Deliver to"}
            action={lines.length ? <CopyButton text={lines.join("\n")} label="Copy address" /> : undefined}
          >
            {order.fulfilment === "collection" ? (
              <p className="text-sm text-ink-soft">The customer will pick this up from the shop.</p>
            ) : lines.length ? (
              <address className="text-[1rem] not-italic leading-relaxed">
                {lines.map((l, i) => (
                  <span key={i} className={"block " + (l === ship?.postcode ? "font-medium tracking-wide" : "")}>
                    {l}
                  </span>
                ))}
              </address>
            ) : (
              <p className="text-sm text-stone-500">No address on this order.</p>
            )}
            {order.shipping_name && order.fulfilment !== "collection" && <p className="mt-3 text-sm text-ink-soft">Service: {order.shipping_name}</p>}
          </Card>

          {(shipments ?? []).length > 0 && (
            <Card title="Tracking">
              <ul className="space-y-3">
                {shipments!.map((s) => (
                  <li key={s.id} className="text-sm">
                    <p className="font-medium">{carrierLabel(s.carrier)}</p>
                    <div className="flex items-center gap-2">
                      {s.tracking_url ? (
                        <a href={s.tracking_url} target="_blank" rel="noreferrer" className="font-mono text-aubergine-700 hover:underline">
                          {s.tracking_number}
                        </a>
                      ) : (
                        <span className="font-mono">{s.tracking_number}</span>
                      )}
                      <CopyButton text={s.tracking_number} />
                    </div>
                    <p className="text-xs text-stone-500">Sent {formatDateTime(s.shipped_at)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Payment">
            <dl className="space-y-1.5 text-sm">
              <Row label="Paid by" value={order.payment_provider === "invoice" ? "Invoice (trade account)" : order.payment_provider === "paypal" ? "PayPal" : order.payment_provider === "stripe" ? "Card" : "Not paid"} />
              <Row label="Paid" value={order.paid_at ? formatDateTime(order.paid_at) : "Not yet"} />
              {order.invoice_due_at && !order.paid_at && <Row label="Invoice due" value={formatDateTime(order.invoice_due_at)} />}
              {order.payment_ref && <Row label="Reference" value={<span className="break-all font-mono text-xs">{order.payment_ref}</span>} />}
            </dl>
          </Card>

          {(refunds ?? []).length > 0 && (
            <Card title="Refunds" description={`${formatPence(order.refunded_pence ?? 0)} of ${formatPence(order.total_pence)} returned`} bodyClassName="p-0">
              <ol className="divide-y divide-ink/10">
                {refunds!.map((r, n) => (
                  <li key={r.id} className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-5 py-3.5 text-sm">
                    <span className="pt-0.5 font-display text-base leading-none text-stone-500 tabular-nums">{String(n + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="text-ink">
                        {r.method === "stripe" ? "Card, through Stripe" : r.method === "paypal" ? "PayPal" : "Recorded by hand"}
                        {r.restocked ? " · stock returned" : ""}
                      </p>
                      {r.reason && <p className="mt-0.5 italic text-ink-soft">{r.reason}</p>}
                      <p className="mt-0.5 text-xs text-stone-500">
                        {formatDateTime(r.created_at)}
                        {r.actor ? ` · ${r.actor.full_name ?? r.actor.email}` : ""}
                        {r.provider_ref ? ` · ${r.provider_ref}` : ""}
                      </p>
                    </div>
                    <p className="text-right font-medium tabular-nums">
                      {formatPence(r.amount_pence)}
                      {r.vat_pence > 0 && <span className="block text-xs font-normal text-stone-500">incl. {formatPence(r.vat_pence)} VAT</span>}
                    </p>
                  </li>
                ))}
              </ol>
              {order.refunded_pence < order.total_pence && (
                <p className="border-t border-ink/15 px-5 py-3 text-right text-sm text-ink-soft">
                  {formatPence(order.total_pence - order.refunded_pence)} still held
                </p>
              )}
            </Card>
          )}

          <OrderNotes orderId={order.id} initial={order.internal_note ?? ""} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
