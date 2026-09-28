import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { finaliseOrder } from "@/lib/checkout/finalise";
import { sendRefunded } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Configure in the Stripe dashboard (or `stripe listen`) for:
 * payment_intent.succeeded, payment_intent.payment_failed, charge.refunded.
 * Every handler is idempotent because Stripe retries.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return Response.json({ error: "Stripe is not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch (e) {
    console.warn("stripe webhook signature failed", e);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await onSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await onFailed(event.data.object);
        break;
      case "charge.refunded":
        await onRefunded(event.data.object);
        break;
    }
  } catch (e) {
    console.error(`stripe webhook ${event.type} failed`, e);
    // 500 so Stripe retries later.
    return Response.json({ error: "Handler failed" }, { status: 500 });
  }
  return Response.json({ received: true });
}

async function findOrder(pi: Stripe.PaymentIntent) {
  const db = createAdminClient();
  const id = pi.metadata?.order_id;
  const query = db.from("orders").select("id, status, total_pence, payment_ref");
  const { data } = id ? await query.eq("id", id).maybeSingle() : await query.eq("payment_ref", pi.id).maybeSingle();
  return data;
}

async function onSucceeded(pi: Stripe.PaymentIntent) {
  const order = await findOrder(pi);
  if (!order) {
    console.warn("payment_intent.succeeded for unknown order", pi.id);
    return;
  }
  // Money check: the amount Stripe actually collected must equal the order total.
  if (pi.currency !== "gbp" || pi.amount_received !== order.total_pence) {
    const db = createAdminClient();
    await db.from("order_events").insert({
      order_id: order.id,
      kind: "note",
      message: `Payment amount mismatch: received ${pi.amount_received} ${pi.currency}, expected ${order.total_pence} gbp. Review before fulfilling.`,
      data: { payment_intent: pi.id },
      visible_to_customer: false,
    });
    return;
  }
  await finaliseOrder(order.id, "stripe", pi.id);
}

async function onFailed(pi: Stripe.PaymentIntent) {
  const order = await findOrder(pi);
  if (!order) return;
  const db = createAdminClient();
  await db.from("order_events").insert({
    order_id: order.id,
    kind: "note",
    message: `Card payment failed: ${pi.last_payment_error?.message ?? "declined"}`,
    data: { payment_intent: pi.id, code: pi.last_payment_error?.code ?? null },
    visible_to_customer: false,
  });
}

async function onRefunded(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("id, status, total_pence").eq("payment_ref", piId).maybeSingle();
  if (!order) return;

  const full = charge.refunded || charge.amount_refunded >= charge.amount;
  const marker = `refund:${charge.id}:${charge.amount_refunded}`;
  const { count } = await db.from("order_events").select("id", { count: "exact", head: true }).eq("order_id", order.id).contains("data", { marker });
  if (count) return;

  if (full && order.status !== "refunded") await db.from("orders").update({ status: "refunded" }).eq("id", order.id);
  await db.from("order_events").insert({
    order_id: order.id,
    kind: "refund",
    message: full ? "Order refunded in full" : `Partial refund of £${(charge.amount_refunded / 100).toFixed(2)}`,
    data: { marker, charge: charge.id, amount_refunded: charge.amount_refunded },
  });
  await sendRefunded(order.id, full ? undefined : charge.amount_refunded);
}
