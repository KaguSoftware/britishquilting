"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { z } from "zod";
import { sendDispatched, sendReadyForCollection, sendRefunded } from "@/lib/email";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";
import { buildTrackingUrl, carrierLabel, ORDER_STATUS, type OrderStatus } from "@/components/admin/format";

const STATUSES = Object.keys(ORDER_STATUS) as [OrderStatus, ...OrderStatus[]];

function refresh(orderId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/orders/${orderId}`);
}

async function loadOrder(db: Awaited<ReturnType<typeof staffDb>>["db"], id: string) {
  const { data } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Plain status change, e.g. "Start packing", "Mark collected", and undo of those. */
export async function setOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<ActionResult<{ previous: OrderStatus }>> {
  const parsed = z.object({ id: z.uuid(), status: z.enum(STATUSES) }).safeParse({ id: orderId, status });
  if (!parsed.success) return fail("That change isn't possible.");
  const { db, viewer } = await staffDb();
  const order = await loadOrder(db, orderId);
  if (!order) return fail("We couldn't find that order.");
  if (order.status === status) return ok({ previous: order.status });

  const { error } = await db.from("orders").update({ status }).eq("id", orderId);
  if (error) return fail("Couldn't update the order. Please try again.");
  await db.from("order_events").insert({
    order_id: orderId,
    kind: "status",
    message: note ?? `Marked as ${ORDER_STATUS[status].label.toLowerCase()}`,
    data: { from: order.status, to: status },
    actor_id: viewer.id,
    visible_to_customer: !["processing"].includes(status),
  });
  if (status === "ready_for_collection" && order.fulfilment === "collection") {
    await sendReadyForCollection(orderId).catch((e) => console.error("ready email", e));
  }
  await audit(db, viewer.id, "order.status", "order", orderId, { from: order.status, to: status });
  refresh(orderId);
  return ok({ previous: order.status as OrderStatus });
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

  const url = parsed.data.trackingUrl || buildTrackingUrl(carrier, trackingNumber) || null;
  const { error } = await db.from("shipments").insert({ order_id: orderId, carrier, tracking_number: trackingNumber, tracking_url: url });
  if (error) return fail("Couldn't save the tracking number.");
  await db.from("orders").update({ status: "shipped" }).eq("id", orderId);
  await db.from("order_events").insert({
    order_id: orderId,
    kind: "shipped",
    message: `Sent with ${carrierLabel(carrier)}, tracking ${trackingNumber}`,
    data: { carrier, tracking_number: trackingNumber, tracking_url: url },
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
  const ref = reference?.trim() || order.payment_ref || null;

  if (["pending", "awaiting_payment"].includes(order.status)) {
    // Not yet finalised: this also takes the stock off and counts the discount use.
    const { error } = await db.rpc("finalise_paid_order", { p_order_id: orderId, p_provider: "invoice", p_ref: ref });
    if (error) return fail("Couldn't mark it as paid. Please try again.");
    await db.from("orders").update({ status: "processing" }).eq("id", orderId);
  } else {
    const { error } = await db.from("orders").update({ paid_at: new Date().toISOString(), payment_ref: ref }).eq("id", orderId);
    if (error) return fail("Couldn't mark it as paid. Please try again.");
    await db.from("order_events").insert({ order_id: orderId, kind: "paid", message: "Invoice paid", data: { reference: ref }, actor_id: viewer.id });
  }
  await audit(db, viewer.id, "order.invoice_paid", "order", orderId, { reference: ref });
  refresh(orderId);
  return ok(undefined, "Invoice marked as paid.");
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

async function refundStripe(ref: string, amount: number) {
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
  const refund = await stripe.refunds.create({ payment_intent: paymentIntent, charge, amount });
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

export async function refundOrder(orderId: string, opts: { manual?: boolean; note?: string } = {}): Promise<ActionResult<{ automatic: boolean }>> {
  if (!z.uuid().safeParse(orderId).success) return fail("Invalid order.");
  const { db, viewer } = await staffDb();
  const order = await loadOrder(db, orderId);
  if (!order) return fail("We couldn't find that order.");
  if (order.status === "refunded") return fail("This order has already been refunded.");

  let refundRef: string | null = null;
  let method = "manual";
  if (!opts.manual && order.paid_at && order.payment_ref) {
    try {
      if (order.payment_provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
        refundRef = await refundStripe(order.payment_ref, order.total_pence);
        method = "stripe";
      } else if (order.payment_provider === "paypal" && process.env.PAYPAL_CLIENT_SECRET && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID) {
        refundRef = await refundPaypal(order.payment_ref, order.total_pence);
        method = "paypal";
      }
    } catch (e) {
      console.error("refund", e);
      return fail(
        `${order.payment_provider === "paypal" ? "PayPal" : "Stripe"} didn't accept the refund. You can refund it in their dashboard, then choose "I've refunded it myself".`,
      );
    }
  }

  const note = opts.note?.trim();
  await db.from("orders").update({ status: "refunded" }).eq("id", orderId);
  await db.from("order_events").insert({
    order_id: orderId,
    kind: "refund",
    message:
      method === "manual"
        ? `Marked as refunded${note ? `: ${note}` : ""}`
        : `Refunded ${(order.total_pence / 100).toFixed(2)} GBP through ${method === "stripe" ? "Stripe" : "PayPal"}`,
    data: { method, refund_ref: refundRef, amount_pence: order.total_pence, note: note ?? null },
    actor_id: viewer.id,
  });
  await sendRefunded(orderId).catch((e) => console.error("refund email", e));
  await audit(db, viewer.id, "order.refund", "order", orderId, { method, refundRef });
  refresh(orderId);
  return ok({ automatic: method !== "manual" }, method === "manual" ? "Marked as refunded." : "Refund sent. The customer has been emailed.");
}
