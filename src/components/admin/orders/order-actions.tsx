"use client";

import { useMemo, useState } from "react";
import { IconCard, IconCheck, IconMinus, IconPlus, IconScissors, IconVan } from "@/components/icons";
import { Checkbox, RadioCard } from "@/components/ui/choice";
import { addTracking, cancelOrder, markInvoicePaid, refundOrder, setOrderStatus } from "@/lib/actions/admin/orders";
import { canCancel, canRefund, canTransition, lineStockQty, restockByDefault } from "@/lib/orders/transitions";
import { cn, formatPence } from "@/lib/utils";
import { CARRIERS, ORDER_STATUS, buildTrackingUrl, type OrderStatus } from "../format";
import { Modal, Segmented, useAction, useConfirm } from "../controls";
import { Button, Field, Input, MoneyInput, Textarea } from "../ui";

type O = {
  id: string;
  number: number;
  status: OrderStatus;
  previous: OrderStatus | null;
  fulfilment: "delivery" | "collection";
  payment_provider: "stripe" | "paypal" | "invoice" | null;
  paid_at: string | null;
  total_pence: number;
  refunded_pence: number;
  chargeback_pence: number;
  disputed: boolean;
  email: string;
};

export type ActionItem = {
  id: string;
  name: string;
  sale_mode: "metre" | "roll" | "unit";
  is_swatch: boolean;
  length_m: number | null;
  quantity: number;
  line_total_pence: number;
  product_id: string | null;
  /** Already refunded on earlier refunds (metres for cut lines, otherwise units or rolls). */
  refunded_qty?: number;
};

/** What is still refundable on a line after earlier refunds. */
const leftQty = (l: ActionItem) => Math.max(0, Math.round((lineStockQty(l) - (l.refunded_qty ?? 0)) * 100) / 100);

export function OrderActions({ order, items }: { order: O; items: ActionItem[] }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [tracking, setTracking] = useState(false);
  const [refund, setRefund] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [invoice, setInvoice] = useState(false);

  const s = order.status;
  const live = ["paid", "processing"].includes(s);
  // Unpaid invoices have taken no money: cancel them, or mark them paid before refunding (keeps the finance ledger honest).
  const paid = Boolean(order.paid_at);
  const invoiceUnpaid = order.payment_provider === "invoice" && !order.paid_at && !["cancelled", "refunded"].includes(s);
  const left = order.total_pence - order.refunded_pence - order.chargeback_pence;
  const showRefund = canRefund(s, paid) && left > 0 && !order.disputed;
  const showCancel = canCancel(s);
  // Undo: only to the immediately previous status, and only where it isn't already a forward move.
  const undoTo = order.previous && canTransition(s, order.previous, order.previous) && !canTransition(s, order.previous) ? order.previous : null;

  const status = (to: OrderStatus, success: string, undo?: OrderStatus) =>
    run(() => setOrderStatus(order.id, to), {
      success,
      undo: undo ? () => setOrderStatus(order.id, undo, "Change undone") : undefined,
    });

  // The single most likely next step, shown big. Only legal moves are offered.
  let primary: React.ReactNode = null;
  if (s === "paid" && canTransition(s, "processing"))
    primary = (
      <Button size="lg" disabled={pending} onClick={() => status("processing", "Marked as being packed", "paid")}>
        <IconScissors className="size-5" /> Start packing
      </Button>
    );
  else if (live && order.fulfilment === "delivery" && canTransition(s, "shipped"))
    primary = (
      <Button size="lg" disabled={pending} onClick={() => setTracking(true)}>
        <IconVan className="size-5" /> Add tracking and mark as sent
      </Button>
    );
  else if (live && order.fulfilment === "collection" && canTransition(s, "ready_for_collection"))
    primary = (
      <Button
        size="lg"
        disabled={pending}
        onClick={async () => {
          if (await confirm({ title: "Ready for collection?", description: `We'll email ${order.email} to say their order is ready to pick up.`, confirmLabel: "Yes, it's ready" }))
            status("ready_for_collection", "Marked ready. The customer has been emailed.");
        }}
      >
        <IconCheck className="size-5" /> Mark ready for collection
      </Button>
    );
  else if (s === "ready_for_collection")
    primary = (
      <Button size="lg" disabled={pending} onClick={() => status("collected", "Marked as collected", "ready_for_collection")}>
        <IconCheck className="size-5" /> Customer has collected it
      </Button>
    );
  else if (s === "shipped")
    primary = (
      <Button size="lg" variant="secondary" disabled={pending} onClick={() => status("delivered", "Marked as delivered", "shipped")}>
        <IconCheck className="size-5" /> Mark as delivered
      </Button>
    );

  const nothing = !primary && !invoiceUnpaid && !showCancel && !showRefund && !undoTo;

  return (
    <div className="space-y-3">
      {order.disputed && (
        <p className="border-l-2 border-danger bg-danger/10 px-4 py-3 text-sm text-ink">
          The customer&apos;s bank has disputed this payment. Refunding is disabled until it&apos;s resolved. If the order hasn&apos;t shipped, consider holding it.
        </p>
      )}
      <div className="flex flex-col gap-3 rounded-[3px] border border-ink/12 bg-cream-50 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        {/* On phones the next step sits in a bar above the tab bar, always in reach of a thumb */}
        <div
          className={
            (primary || invoiceUnpaid
              ? "fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-30 border-t border-ink/15 bg-cream-50 px-4 py-3 lg:static lg:border-0 lg:bg-transparent lg:p-0 "
              : "") + "flex flex-col gap-2 sm:flex-row [&>button]:w-full sm:[&>button]:w-auto"
          }
        >
          {primary}
          {invoiceUnpaid && (
            <Button size="lg" variant={primary ? "secondary" : "primary"} disabled={pending} onClick={() => setInvoice(true)}>
              <IconCard className="size-5" /> Mark invoice as paid
            </Button>
          )}
        </div>
        {!primary && !invoiceUnpaid && <p className="text-sm text-ink-soft">{nothing ? "Nothing more to do on this order." : "No next step to take."}</p>}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {undoTo && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => status(undoTo, `Moved back to ${ORDER_STATUS[undoTo].label.toLowerCase()}`)}>
              Move back to {ORDER_STATUS[undoTo].label.toLowerCase()}
            </Button>
          )}
          {showCancel && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setCancel(true)}>
              Cancel order
            </Button>
          )}
          {showRefund && (
            <Button variant="danger" size="sm" disabled={pending} onClick={() => setRefund(true)}>
              {order.refunded_pence > 0 ? "Refund more" : "Refund"}
            </Button>
          )}
        </div>
      </div>

      <TrackingModal open={tracking} onClose={() => setTracking(false)} order={order} />
      <CancelSheet open={cancel} onClose={() => setCancel(false)} order={order} paid={paid} />
      {refund && <RefundSheet onClose={() => setRefund(false)} order={order} items={items} />}
      <InvoiceModal open={invoice} onClose={() => setInvoice(false)} order={order} />
    </div>
  );
}

/* ───────────────────────── Tracking */

function TrackingModal({ open, onClose, order }: { open: boolean; onClose: () => void; order: O }) {
  const { run, pending } = useAction();
  const [carrier, setCarrier] = useState<string>("royal_mail");
  const [number, setNumber] = useState("");
  const [url, setUrl] = useState("");
  const [notify, setNotify] = useState(true);
  const auto = buildTrackingUrl(carrier, number);

  return (
    <Modal open={open} onClose={onClose} title="Mark as sent" description={`Add the tracking number for order #${order.number}.`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await run(() => addTracking({ orderId: order.id, carrier: carrier as "royal_mail", trackingNumber: number, trackingUrl: carrier === "other" ? url : undefined, notify }));
          if (res.ok) {
            setNumber("");
            onClose();
          }
        }}
      >
        <Field label="Courier" htmlFor="carrier">
          <div className="grid grid-cols-2 gap-2">
            {CARRIERS.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => setCarrier(c.value)}
                className={
                  "rounded-[3px] border px-3 py-3 text-sm font-medium transition-colors " +
                  (carrier === c.value ? "border-aubergine-800 bg-aubergine-800 text-cream-50" : "border-ink/15 bg-white hover:border-aubergine-300")
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tracking number" htmlFor="tn" hint={auto ? "We'll build the tracking link for you." : undefined}>
          <Input id="tn" value={number} onChange={(e) => setNumber(e.target.value)} autoFocus autoComplete="off" className="font-mono text-lg tracking-wide" placeholder="e.g. AB123456789GB" />
        </Field>
        {carrier === "other" && (
          <Field label="Tracking link (optional)" htmlFor="turl">
            <Input id="turl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </Field>
        )}
        <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Email the customer that it's on its way" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Not yet
          </Button>
          <Button type="submit" disabled={pending || number.trim().length < 3}>
            {pending ? "Saving..." : "Mark as sent"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── Cancel */

function CancelSheet({ open, onClose, order, paid }: { open: boolean; onClose: () => void; order: O; paid: boolean }) {
  const { run, pending } = useAction();
  const [restock, setRestock] = useState(true);
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState("");

  return (
    <Modal open={open} onClose={onClose} title={`Cancel order #${order.number}?`} description="The order is closed and nothing will be sent." wide>
      <div className="space-y-5">
        {paid ? (
          <p className="border-l-2 border-gold-500 bg-gold-100/60 px-4 py-3 text-sm text-ink">
            Cancelling doesn&apos;t return any money. Once it&apos;s cancelled, use Refund to send {formatPence(order.total_pence - order.refunded_pence)} back.
          </p>
        ) : (
          <p className="text-sm text-ink-soft">No payment has been taken for this order, so there is nothing to refund.</p>
        )}

        <div className="divide-y divide-ink/10 border-y border-ink/10">
          <Checkbox
            className="py-3"
            checked={restock}
            onChange={(e) => setRestock(e.target.checked)}
            label="Return items to stock"
            description={paid ? "Puts every metre and unit back so it can be sold again." : "Only matters if stock was set aside for this order."}
          />
          <Checkbox className="py-3" checked={notify} onChange={(e) => setNotify(e.target.checked)} label={`Email ${order.email}`} description="Lets them know the order has been cancelled." />
        </div>

        <Field label="Reason (optional)" htmlFor="creason" hint="Included in the customer's email.">
          <Textarea id="creason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Asked to cancel by phone" className="min-h-20" />
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Keep the order
          </Button>
          <Button
            variant="danger"
            className="!bg-danger !text-cream-50"
            disabled={pending}
            onClick={async () => {
              const res = await run(() => cancelOrder(order.id, { restock, notify, reason }));
              if (res.ok) onClose();
            }}
          >
            {pending ? "Cancelling..." : "Cancel order"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Refund */

type Pick = { qty: number; restock: boolean };

const fmtQty = (i: ActionItem, q: number) =>
  i.sale_mode === "metre" ? `${q.toLocaleString("en-GB", { maximumFractionDigits: 2 })}m` : i.sale_mode === "roll" ? `${q} roll${q === 1 ? "" : "s"}` : `${q}`;

function RefundSheet({ onClose, order, items }: { onClose: () => void; order: O; items: ActionItem[] }) {
  const { run, pending } = useAction();
  const lines = useMemo(() => items.filter((i) => !i.is_swatch && i.product_id), [items]);
  const left = order.total_pence - order.refunded_pence - order.chargeback_pence;
  const [mode, setMode] = useState<"full" | "partial">(order.refunded_pence > 0 ? "partial" : "full");
  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, { qty: leftQty(l), restock: restockByDefault(l.sale_mode) }])),
  );
  const [partialQty, setPartialQty] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.id, 0])));
  const [amountText, setAmountText] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [reason, setReason] = useState("");
  const provider = order.payment_provider === "paypal" ? "PayPal" : order.payment_provider === "stripe" ? "the card" : null;
  const [manual, setManual] = useState(!provider || !order.paid_at);

  const qtyOf = (l: ActionItem) => (mode === "full" ? leftQty(l) : partialQty[l.id] ?? 0);
  const suggested = Math.min(
    left,
    lines.reduce((sum, l) => sum + Math.round((l.line_total_pence * qtyOf(l)) / Math.max(lineStockQty(l), 1e-9)), 0),
  );
  const amount = mode === "full" ? left : amountTouched ? Math.round(Number(amountText.replace(/[^0-9.]/g, "")) * 100) || 0 : suggested;
  const tooMuch = amount > left;
  const picked = lines.filter((l) => qtyOf(l) > 0);
  const restockAny = picked.some((l) => picks[l.id]?.restock);
  const hasCut = lines.some((l) => l.sale_mode === "metre");

  const setQty = (l: ActionItem, q: number) => {
    const max = leftQty(l);
    const clean = Math.max(0, Math.min(max, Math.round(q * 100) / 100));
    setPartialQty((p) => ({ ...p, [l.id]: clean }));
  };

  const submit = async () => {
    const payload = picked.map((l) => ({ order_item_id: l.id, qty: qtyOf(l), restock: Boolean(picks[l.id]?.restock) }));
    const res = await run(() =>
      refundOrder({ orderId: order.id, full: mode === "full", amount: mode === "full" ? undefined : amount, items: payload, restock: restockAny, reason, manual }),
    );
    if (res.ok) onClose();
    else if (!manual && provider) setManual(true);
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Refund order #${order.number}`}
      description={
        order.refunded_pence > 0
          ? `${formatPence(order.refunded_pence)} already refunded, ${formatPence(left)} left. The customer is emailed.`
          : `Up to ${formatPence(left)} can be refunded. The customer is emailed. It can't be undone.`
      }
    >
      <div className="space-y-6">
        <Segmented
          className="w-full"
          value={mode}
          onChange={setMode}
          options={[
            { value: "full", label: order.refunded_pence > 0 ? "Everything left" : "Full refund" },
            { value: "partial", label: "Part of it" },
          ]}
        />

        {lines.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between gap-3 border-b border-ink/15 pb-2">
              <h3 className="font-display text-lg text-aubergine-900">{mode === "full" ? "What comes back" : "Which lines"}</h3>
              <span className="text-xs text-stone-500">Return to stock</span>
            </div>
            <ul className="divide-y divide-ink/10">
              {lines.map((l) => {
                const ordered = lineStockQty(l);
                const max = leftQty(l);
                const q = qtyOf(l);
                const step = l.sale_mode === "metre" ? 0.5 : 1;
                const p = picks[l.id]!;
                return (
                  <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.95rem] font-medium">{l.name}</p>
                      <p className="text-xs text-stone-500">
                        Ordered {fmtQty(l, ordered)} · {formatPence(l.line_total_pence)}
                        {max < ordered && `, ${fmtQty(l, ordered - max)} already refunded`}
                      </p>
                    </div>
                    <div className={cn("flex items-center justify-end", q <= 0 && "opacity-40")}>
                      <Checkbox
                        aria-label={`Return ${l.name} to stock`}
                        label={<span className="sr-only">Return to stock</span>}
                        checked={p.restock && q > 0}
                        disabled={q <= 0}
                        onChange={(e) => setPicks((all) => ({ ...all, [l.id]: { ...p, restock: e.target.checked } }))}
                        className="items-center gap-0 px-2"
                      />
                    </div>
                    {mode === "partial" && (
                      <div className="col-span-2 flex items-center gap-3">
                        <div className="inline-flex items-stretch rounded-sm border border-stone-300 bg-white">
                          <button type="button" aria-label="Less" onClick={() => setQty(l, q - step)} disabled={q <= 0} className="grid w-10 place-items-center text-ink-soft hover:text-ink disabled:opacity-30">
                            <IconMinus className="size-4" />
                          </button>
                          <input
                            inputMode="decimal"
                            aria-label={`Amount of ${l.name} to refund`}
                            value={String(q)}
                            onChange={(e) => setQty(l, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
                            className="w-16 border-x border-stone-300 bg-transparent py-2 text-center tabular-nums focus:outline-none"
                          />
                          <button type="button" aria-label="More" onClick={() => setQty(l, q + step)} disabled={q >= max} className="grid w-10 place-items-center text-ink-soft hover:text-ink disabled:opacity-30">
                            <IconPlus className="size-4" />
                          </button>
                        </div>
                        <span className="text-sm text-ink-soft">
                          {l.sale_mode === "metre" ? "metres" : l.sale_mode === "roll" ? "rolls" : "units"} of {fmtQty(l, max)}
                        </span>
                        <button type="button" onClick={() => setQty(l, q >= max ? 0 : max)} className="ml-auto text-sm text-aubergine-700 hover:underline">
                          {q >= max ? "None" : "All"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {hasCut && <p className="mt-2 text-xs text-stone-500">Cut lengths stay off stock by default: once cut, they usually can&apos;t be sold again.</p>}
          </section>
        )}

        {mode === "partial" && (
          <Field
            label="Amount to refund"
            htmlFor="ramount"
            error={tooMuch ? `That's more than the ${formatPence(left)} left.` : null}
            hint={amountTouched ? "Typed by you." : lines.length ? "Worked out from the lines above. You can change it." : undefined}
          >
            <MoneyInput
              id="ramount"
              value={amountTouched ? amountText : suggested ? (suggested / 100).toFixed(2) : ""}
              placeholder="0.00"
              onChange={(e) => {
                setAmountTouched(true);
                setAmountText(e.target.value);
              }}
            />
          </Field>
        )}

        {provider && order.paid_at && (
          <div className="space-y-2" role="radiogroup" aria-label="How the money goes back">
            <RadioCard name="rmethod" checked={!manual} onChange={() => setManual(false)} title={`Send it back to ${provider}`} description="We'll do the refund for you automatically." />
            <RadioCard name="rmethod" checked={manual} onChange={() => setManual(true)} title="I've refunded it myself" description="For example by bank transfer. We'll just record it." />
          </div>
        )}

        <Field label="Reason (optional)" htmlFor="rnote" hint="Only staff see this.">
          <Textarea id="rnote" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. One roll arrived damaged" className="min-h-20" />
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Go back
          </Button>
          <Button variant="danger" className="!bg-danger !text-cream-50" disabled={pending || amount <= 0 || tooMuch} onClick={submit}>
            {pending ? "Refunding..." : `Refund ${formatPence(Math.max(0, amount))}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Invoice */

function InvoiceModal({ open, onClose, order }: { open: boolean; onClose: () => void; order: O }) {
  const { run, pending } = useAction();
  const [ref, setRef] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Invoice paid?" description={`Record that ${formatPence(order.total_pence)} has arrived for order #${order.number}.`}>
      <div className="space-y-4">
        <Field label="Payment reference (optional)" htmlFor="iref" hint="What it said on the bank statement, if you'd like to keep it.">
          <Input id="iref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Go back
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              const res = await run(() => markInvoicePaid(order.id, ref));
              if (res.ok) onClose();
            }}
          >
            Yes, it&apos;s paid
          </Button>
        </div>
      </div>
    </Modal>
  );
}
