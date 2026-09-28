"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { z } from "zod";
import {
  sendCollected,
  sendDelivered,
  sendDispatched,
  sendOrderCancelled,
  sendPaymentReceived,
  sendReadyForCollection,
  sendRefunded,
} from "@/lib/email";
import { canTransition, lineStockQty } from "@/lib/orders/transitions";
import { revalidateCustomerOrders, revalidateStorefront } from "@/lib/orders/revalidate";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";
import { buildTrackingUrl, carrierLabel, ORDER_STATUS, type OrderStatus } from "@/components/admin/format";

const STATUSES = Object.keys(ORDER_STATUS) as [OrderStatus, ...OrderStatus[]];

function refresh(orderId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidateCustomerOrders();
}

type Db = Awaited<ReturnType<typeof staffDb>>["db"];

async function loadOrder(db: Db, id: string) {
  const { data } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  return data;
}

async function previousStatus(db: Db, id: string): Promise<OrderStatus | null> {
  const { data } = await db.rpc("order_previous_status", { p_order_id: id });
  return (data as OrderStatus | null) ?? null;
}

/** Server-side check against the database transition map (the authority). */
async function allowed(db: Db, from: OrderStatus, to: OrderStatus, previous: OrderStatus | null) {
  const { data, error } = await db.rpc("can_transition", { p_from: from, p_to: to, p_previous: previous });
  if (error) return canTransition(from, to, previous);
  return data === true;
}

/** Plain status change, e.g. "Start packing", "Mark collected", and undo of those. */
export async function setOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<ActionResult<{ previous: OrderStatus }>> {
  const parsed = z.object({ id: z.uuid(), status: z.enum(STATUSES) }).safeParse({ id: orderId, status });
  if (!parsed.success) return fail("That change isn't possible.");
  if (status === "cancelled") return cancelOrder(orderId, { restock: true });
  if (status === "refunded") return fail("Please use Refund to return money.");
  const { db, viewer } = await staffDb();
  const order = await loadOrder(db, orderId);
  if (!order) return fail("We couldn't find that order.");
  if (order.status === status) return ok({ previous: order.status });

  const previous = await previousStatus(db, orderId);
  if (!(await allowed(db, order.status, status, previous)))
    return fail(
      `An order that is "${ORDER_STATUS[order.status as OrderStatus].label.toLowerCase()}" can't be marked as ${ORDER_STATUS[status].label.toLowerCase()}.`,
    );
  const undo = previous === status && !canTransition(order.status, status);

  // Only move it if nobody else has moved it in the meantime.
  const { data: moved, error } = await db.from("orders").update({ status }).eq("id", orderId).eq("status", order.status).select("id");
  if (error) return fail("Couldn't update the order. Please try again.");
  if (!moved?.length) return fail("This order was just changed by someone else. Please refresh.");
  await db.from("order_events").insert({
    order_id: orderId,
    kind: "status",
    message: note ?? (undo ? `Moved back to ${ORDER_STATUS[status].label.toLowerCase()}` : `Marked as ${ORDER_STATUS[status].label.toLowerCase()}`),
    data: { from: order.status, to: status, undo },
    actor_id: viewer.id,
    visible_to_customer: !["processing", "paid"].includes(status) && !undo,
  });
  if (!undo) {
    if (status === "ready_for_collection" && order.fulfilment === "collection")
      await sendReadyForCollection(orderId).catch((e) => console.error("ready email", e));
    if (status === "delivered") await sendDelivered(orderId).catch((e) => console.error("delivered email", e));
    if (status === "collected") await sendCollected(orderId).catch((e) => console.error("collected email", e));
  }
  await audit(db, viewer.id, "order.status", "order", orderId, { from: order.status, to: status, undo });
  refresh(orderId);
  return ok({ previous: order.status as OrderStatus });
}

const cancelSchema = z.object({
  orderId: z.uuid(),
  restock: z.boolean().default(true),
  reason: z.string().trim().max(500).optional(),
  notify: z.boolean().default(true),
});

/** Cancels through cancel_order(): checks the transition, optionally restocks, gives back the discount use. */
export async function cancelOrder(
  orderId: string,
  opts: Omit<z.input<typeof cancelSchema>, "orderId"> = {},
): Promise<ActionResult<{ previous: OrderStatus }>> {
  const parsed = cancelSchema.safeParse({ orderId, ...opts });
  if (!parsed.success) return fail("That change isn't possible.");
  const { restock, reason, notify } = parsed.data;
  const { db, viewer } = await staffDb();
  const order = await loadOrder(db, orderId);
  if (!order) return fail("We couldn't find that order.");
  if (!canTransition(order.status, "cancelled"))
    return fail(
      order.status === "cancelled" ? "This order is already cancelled." : "Orders that have been sent or collected can't be cancelled. Use Refund instead.",
    );

  const { error } = await db.rpc("cancel_order", { p_order_id: orderId, p_restock: restock, p_actor: viewer.id, p_reason: reason || null });
  if (error) {
    console.error("cancel_order", error);
    return fail(error.message?.includes("illegal_transition") ? "This order can no longer be cancelled." : "Couldn't cancel the order. Please try again.");
  }
  const emailed = notify ? await sendOrderCancelled(orderId, reason).catch(() => false) : false;
  await audit(db, viewer.id, "order.cancel", "order", orderId, { from: order.status, restock, reason: reason ?? null });
  if (restock) revalidateStorefront();
  refresh(orderId);
  const paid = Boolean(order.paid_at);
  return ok(
    { previous: order.status as OrderStatus },
    `Order cancelled${restock ? " and stock returned" : ""}.${emailed ? " The customer has been emailed." : ""}${paid ? " Remember to refund the payment." : ""}`,
  );
}

const trackingSchema = z.object({
  orderId: z.uuid(),
  carrier: z.enum(["royal_mail", "dpd", "parcelforce", "other"]),
  trackingNumber: z.string().trim().min(3, "Please enter the tracking number").max(80),
  trackingUrl: z.string().trim().max(500).optional(),
  notify: z.boolean().default(true),
});

export async function addTracking(input: z.input<typeof trackingSchema>): Promise<ActionResult> {
  const parsed = trackingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the tracking details.");
  const { orderId, carrier, trackingNumber, notify } = parsed.data;
  const { db, viewer } = await staffDb();
  const order = await loadOrder(db, orderId);
  if (!order) return fail("We couldn't find that order.");
  if (!["paid", "processing", "ready_for_collection"].includes(order.status) || !canTransition(order.status, "shipped"))
    return fail("Only paid orders that haven't been sent yet can be marked as sent.");

  const url = parsed.data.trackingUrl || buildTrackingUrl(carrier, trackingNumber) || null;
  // Shipment first: if the move then fails we only have to drop the row (a status step back would be refused).
  const { data: shipment, error } = await db.from("shipments").insert({ order_id: orderId, carrier, tracking_number: trackingNumber, tracking_url: url }).select("id").single();
  if (error || !shipment) return fail("Couldn't save the tracking number.");
  const { data: moved } = await db.from("orders").update({ status: "shipped" }).eq("id", orderId).eq("status", order.status).select("id");
  if (!moved?.length) {
    await db.from("shipments").delete().eq("id", shipment.id);
    return fail("This order was just changed by someone else. Please refresh.");
  }
  await db.from("order_events").insert({
    order_id: orderId,
    kind: "shipped",
    message: `Sent with ${carrierLabel(carrier)}, tracking ${trackingNumber}`,
    data: { carrier, tracking_number: trackingNumber, tracking_url: url, from: order.status, to: "shipped" },
    actor_id: viewer.id,
  });
  // sendDispatched never throws and logs its own staff-only email event.
  const emailed = notify ? await sendDispatched(orderId).catch(() => false) : false;
  await audit(db, viewer.id, "order.shipped", "order", orderId, { carrier, trackingNumber });
  refresh(orderId);
  return ok(undefined, emailed ? "Marked as sent. The customer has been emailed." : notify ? "Marked as sent, but the dispatch email couldn't be sent." : "Marked as sent.");
}

export async function markInvoicePaid(orderId: string, reference?: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(orderId).success) return fail("Invalid order.");
  const { db, viewer } = await staffDb();
  const order = await loadOrder(db, orderId);
  if (!order) return fail("We couldn't find that order.");
  if (order.paid_at) return fail("This order is already marked as paid.");
  if (["cancelled", "refunded"].includes(order.status)) return fail("This order is closed.");
  const ref = reference?.trim() || order.payment_ref || null;

  if (["pending", "awaiting_payment"].includes(order.status)) {
    // Not yet finalised: this also takes the stock off and counts the discount use.
    const { error } = await db.rpc("finalise_paid_order", { p_order_id: orderId, p_provider: "invoice", p_ref: ref });
    if (error) return fail("Couldn't mark it as paid. Please try again.");
    await db.from("orders").update({ status: "processing" }).eq("id", orderId);
    revalidateStorefront();
  } else {
    const { error } = await db.from("orders").update({ paid_at: new Date().toISOString(), payment_ref: ref }).eq("id", orderId);
    if (error) return fail("Couldn't mark it as paid. Please try again.");
    await db.from("order_events").insert({ order_id: orderId, kind: "paid", message: "Invoice paid", data: { reference: ref }, actor_id: viewer.id });
  }
  const emailed = await sendPaymentReceived(orderId, ref).catch(() => false);
  await audit(db, viewer.id, "order.invoice_paid", "order", orderId, { reference: ref });
  refresh(orderId);
  return ok(undefined, emailed ? "Invoice marked as paid. The customer has been emailed." : "Invoice marked as paid.");
}

export async function saveInternalNote(orderId: string, note: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(orderId).success) return fail("Invalid order.");
  const { db, viewer } = await staffDb();
  const clean = note.slice(0, 4000);
  const { error } = await db.from("orders").update({ internal_note: clean || null }).eq("id", orderId);
  if (error) return fail("Couldn't save the note.");
  await audit(db, viewer.id, "order.note", "order", orderId);
  refresh(orderId);
  return ok(undefined, "Note saved.");
}

export async function addTimelineNote(orderId: string, message: string): Promise<ActionResult> {
  const text = message.trim().slice(0, 1000);
  if (!text) return fail("Please write something first.");
  const { db, viewer } = await staffDb();
  const { error } = await db.from("order_events").insert({ order_id: orderId, kind: "note", message: text, actor_id: viewer.id, visible_to_customer: false });
  if (error) return fail("Couldn't add the note.");
  refresh(orderId);
  return ok(undefined, "Added to the timeline.");
}

/* ───────────────────────── Refunds */

async function refundStripe(ref: string, amount: number, orderId: string) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let paymentIntent: string | undefined;
  let charge: string | undefined;
  if (ref.startsWith("pi_")) paymentIntent = ref;
  else if (ref.startsWith("ch_")) charge = ref;
  else if (ref.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(ref);
    paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  }
  if (!paymentIntent && !charge) throw new Error("No Stripe payment reference on this order");
  const refund = await stripe.refunds.create({ payment_intent: paymentIntent, charge, amount, metadata: { order_id: orderId, source: "admin" } });
  return refund.id;
}

async function paypalToken() {
  const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
  const auth = Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal sign-in failed");
  return { base, token: ((await res.json()) as { access_token: string }).access_token };
}

/** Partial or full: PayPal refunds exactly the amount given against the capture. */
async function refundPaypal(ref: string, amount: number) {
  const { base, token } = await paypalToken();
  let captureId = ref;
  // The reference may be the PayPal order id: look up its capture.
  const orderRes = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (orderRes.ok) {
    const o = (await orderRes.json()) as { purchase_units?: { payments?: { captures?: { id: string }[] } }[] };
    captureId = o.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? ref;
  }
  const res = await fetch(`${base}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: { value: (amount / 100).toFixed(2), currency_code: "GBP" } }),
  });
  if (!res.ok) throw new Error(`PayPal refund failed (${res.status})`);
  return ((await res.json()) as { id: string }).id;
}

const refundSchema = z.object({
  orderId: z.uuid(),
  /** Pence. Ignored when full is true (whatever is left gets refunded). */
  amount: z.number().int().positive().optional(),
  full: z.boolean().default(false),
  /** qty is metres for cut lines, units or rolls otherwise; restock picks which lines go back on the shelf. */
  items: z.array(z.object({ order_item_id: z.uuid(), qty: z.number().positive(), restock: z.boolean().default(true) })).max(200).optional(),
  restock: z.boolean().default(false),
  reason: z.string().trim().max(500).optional(),
  manual: z.boolean().default(false),
});

/**
 * Full or partial refund. Money goes back through Stripe or PayPal when configured
 * (unless staff say they refunded it themselves), then record_refund() adds it to
 * the ledger, moves the order to refunded once fully refunded and optionally restocks.
 */
export async function refundOrder(input: z.input<typeof refundSchema>): Promise<ActionResult<{ automatic: boolean }>> {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the refund.");
  const { orderId, full, items, restock, reason, manual } = parsed.data;
  const { db, viewer } = await staffDb();
  const order = await loadOrder(db, orderId);
  if (!order) return fail("We couldn't find that order.");
  const takenMoney = Boolean(order.paid_at);
  if (!takenMoney || !canTransition(order.status, "refunded")) return fail("This order can't be refunded.");

  const left = order.total_pence - (order.refunded_pence ?? 0);
  const amount = full ? left : parsed.data.amount;
  if (!amount || amount <= 0) return fail("Please enter an amount to refund.");
  if (amount > left) return fail(`You can refund at most ${(left / 100).toFixed(2)} GBP on this order.`);

  if (items?.length) {
    const { data: lines } = await db.from("order_items").select("id, sale_mode, length_m, quantity, is_swatch").eq("order_id", orderId);
    for (const it of items) {
      const line = lines?.find((l) => l.id === it.order_item_id);
      if (!line) return fail("One of those lines isn't on this order.");
      if (it.qty > lineStockQty({ ...line, length_m: line.length_m == null ? null : Number(line.length_m) }) + 1e-6)
        return fail("You can't return more than was ordered.");
    }
  }

  let refundRef: string | null = null;
  let method: "manual" | "stripe" | "paypal" = "manual";
  if (!manual && order.paid_at && order.payment_ref) {
    try {
      if (order.payment_provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
        refundRef = await refundStripe(order.payment_ref, amount, orderId);
        method = "stripe";
      } else if (order.payment_provider === "paypal" && process.env.PAYPAL_CLIENT_SECRET && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID) {
        refundRef = await refundPaypal(order.payment_ref, amount);
        method = "paypal";
      }
    } catch (e) {
      console.error("refund", e);
      return fail(
        `${order.payment_provider === "paypal" ? "PayPal" : "Stripe"} didn't accept the refund. You can refund it in their dashboard, then choose "I've refunded it myself".`,
      );
    }
  }

  const { data: result, error } = await db.rpc("record_refund", {
    p_order_id: orderId,
    p_amount: amount,
    p_items: items?.length ? items : null,
    p_restock: restock,
    p_provider_ref: refundRef,
    p_actor: viewer.id,
    p_reason: reason || null,
    p_method: method,
  });
  if (error) {
    console.error("record_refund", error);
    if (refundRef) return fail(`The money was sent back (${refundRef}), but we couldn't record it here. Please add a note to the order.`);
    return fail(error.message?.includes("refund_exceeds_total") ? "That's more than is left to refund." : "Couldn't record the refund. Please try again.");
  }

  const wholeOrder = amount === order.total_pence;
  const emailed = await sendRefunded(orderId, wholeOrder ? undefined : amount).catch(() => false);
  await audit(db, viewer.id, "order.refund", "order", orderId, { method, refundRef, amount, restock, items: items ?? null });
  if (restock) revalidateStorefront();
  refresh(orderId);
  const fullyRefunded = (result?.refunded_pence ?? 0) >= order.total_pence;
  const what = fullyRefunded ? "Refunded in full" : "Partial refund recorded";
  const via = method === "manual" ? "" : `, sent through ${method === "stripe" ? "Stripe" : "PayPal"}`;
  return ok({ automatic: method !== "manual" }, `${what}${via}.${emailed ? " The customer has been emailed." : ""}`);
}
