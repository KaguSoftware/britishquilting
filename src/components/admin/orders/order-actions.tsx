"use client";

import { useState } from "react";
import { IconCard, IconCheck, IconScissors, IconVan } from "@/components/icons";
import { addTracking, markInvoicePaid, refundOrder, setOrderStatus } from "@/lib/actions/admin/orders";
import { formatPence } from "@/lib/utils";
import { CARRIERS, buildTrackingUrl, type OrderStatus } from "../format";
import { Modal, useAction, useConfirm } from "../controls";
import { Button, Field, Input, Textarea } from "../ui";

type O = {
  id: string;
  number: number;
  status: OrderStatus;
  fulfilment: "delivery" | "collection";
  payment_provider: "stripe" | "paypal" | "invoice" | null;
  paid_at: string | null;
  total_pence: number;
  email: string;
};

export function OrderActions({ order }: { order: O }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [tracking, setTracking] = useState(false);
  const [refund, setRefund] = useState(false);
  const [invoice, setInvoice] = useState(false);

  const s = order.status;
  const live = ["paid", "processing"].includes(s);
  const invoiceUnpaid = order.payment_provider === "invoice" && !order.paid_at && !["cancelled", "refunded"].includes(s);
  const canRefund = !["refunded", "cancelled", "pending"].includes(s) && (order.paid_at || order.payment_provider !== "invoice");
  const canCancel = ["pending", "awaiting_payment"].includes(s) || (invoiceUnpaid && ["processing", "paid"].includes(s));

  const status = (to: OrderStatus, success: string, undoTo?: OrderStatus) =>
    run(() => setOrderStatus(order.id, to), {
      success,
      undo: undoTo ? () => setOrderStatus(order.id, undoTo, "Change undone") : undefined,
    });

  // The single most likely next step, shown big.
  let primary: React.ReactNode = null;
  if (s === "paid")
    primary = (
      <Button size="lg" disabled={pending} onClick={() => status("processing", "Marked as being packed", "paid")}>
        <IconScissors className="size-5" /> Start packing
      </Button>
    );
  else if (live && order.fulfilment === "delivery")
    primary = (
      <Button size="lg" disabled={pending} onClick={() => setTracking(true)}>
        <IconVan className="size-5" /> Add tracking and mark as sent
      </Button>
    );
  else if (live && order.fulfilment === "collection")
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

  return (
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
      {!primary && !invoiceUnpaid && <p className="text-sm text-ink-soft">Nothing more to do on this order.</p>}
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        {s === "processing" && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => status("paid", "Moved back to new", "processing")}>
            Move back to new
          </Button>
        )}
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={async () => {
              if (await confirm({ title: `Cancel order #${order.number}?`, description: "The order will be closed. No money is taken or returned.", confirmLabel: "Cancel order", cancelLabel: "Keep it", danger: true }))
                status("cancelled", "Order cancelled", s);
            }}
          >
            Cancel order
          </Button>
        )}
        {canRefund && (
          <Button variant="danger" size="sm" disabled={pending} onClick={() => setRefund(true)}>
            Refund
          </Button>
        )}
      </div>

      <TrackingModal open={tracking} onClose={() => setTracking(false)} order={order} />
      <RefundModal open={refund} onClose={() => setRefund(false)} order={order} />
      <InvoiceModal open={invoice} onClose={() => setInvoice(false)} order={order} />
    </div>
  );
}

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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-aubergine-700" />
          Email the customer that it&apos;s on its way
        </label>
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

function RefundModal({ open, onClose, order }: { open: boolean; onClose: () => void; order: O }) {
  const { run, pending } = useAction();
  const [note, setNote] = useState("");
  const [manual, setManual] = useState(order.payment_provider === "invoice");
  const provider = order.payment_provider === "paypal" ? "PayPal" : order.payment_provider === "stripe" ? "the card" : null;

  return (
    <Modal open={open} onClose={onClose} title={`Refund ${formatPence(order.total_pence)}?`} description={`This refunds the full amount of order #${order.number} and emails the customer. It can't be undone.`}>
      <div className="space-y-4">
        {provider && (
          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-[3px] border border-ink/15 bg-white p-3 text-sm">
              <input type="radio" checked={!manual} onChange={() => setManual(false)} className="mt-0.5 accent-aubergine-700" />
              <span>
                <span className="font-medium">Send the money back to {provider}</span>
                <span className="block text-stone-500">We&apos;ll do the refund for you automatically.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-[3px] border border-ink/15 bg-white p-3 text-sm">
              <input type="radio" checked={manual} onChange={() => setManual(true)} className="mt-0.5 accent-aubergine-700" />
              <span>
                <span className="font-medium">I&apos;ve refunded it myself</span>
                <span className="block text-stone-500">For example by bank transfer. We&apos;ll just record it.</span>
              </span>
            </label>
          </div>
        )}
        <Field label="Note (optional)" htmlFor="rnote" hint="Only staff see this.">
          <Textarea id="rnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer changed their mind" className="min-h-20" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Go back
          </Button>
          <Button
            variant="danger"
            className="!bg-danger !text-cream-50"
            disabled={pending}
            onClick={async () => {
              const res = await run(() => refundOrder(order.id, { manual, note }));
              if (res.ok) onClose();
              else if (!manual) setManual(true);
            }}
          >
            {pending ? "Refunding..." : `Refund ${formatPence(order.total_pence)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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

