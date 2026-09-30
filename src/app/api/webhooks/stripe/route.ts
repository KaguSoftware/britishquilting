import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { finaliseOrder } from "@/lib/checkout/finalise";
import { sendDisputeAlert, sendRefunded } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Configure in the Stripe dashboard (or `stripe listen`) for:
 * payment_intent.succeeded, payment_intent.payment_failed, charge.refunded,
 * charge.dispute.created, charge.dispute.updated, charge.dispute.closed,
 * charge.dispute.funds_withdrawn, charge.dispute.funds_reinstated.
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
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.funds_reinstated":
        await onDispute(event.data.object);
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

/**
 * Refunds made anywhere (our admin, or the Stripe dashboard) land on the refund ledger.
 * Each Stripe refund id is recorded once through record_refund (unique provider_ref), so
 * a refund our admin already recorded is skipped. Stock is never returned from here:
 * staff decide that in the admin.
 */
async function onRefunded(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("id, refunded_pence").eq("payment_ref", piId).maybeSingle();
  if (!order) return;

  let refunds: { id: string; amount: number }[] | null = null;
  try {
    const list = await getStripe()!.refunds.list({ charge: charge.id, limit: 100 });
    refunds = list.data.filter((r) => r.status === "succeeded" || r.status === "pending").map((r) => ({ id: r.id, amount: r.amount }));
  } catch (e) {
    console.error("stripe refunds list", e);
  }
  // Fallback: record the delta between what Stripe has refunded and what we already hold.
  if (!refunds) {
    const delta = charge.amount_refunded - order.refunded_pence;
    refunds = delta > 0 ? [{ id: `${charge.id}:${charge.amount_refunded}`, amount: delta }] : [];
  }

  for (const r of refunds) {
    const { data, error } = await db.rpc("record_refund", {
      p_order_id: order.id,
      p_amount: r.amount,
      p_items: null,
      p_restock: false,
      p_provider_ref: r.id,
      p_actor: null,
      p_reason: "Refunded in Stripe",
      p_method: "stripe",
    });
    if (error) {
      console.error("record_refund from webhook", error);
      continue;
    }
    if (data?.inserted) await sendRefunded(order.id, r.amount);
  }
}

/**
 * A payment has been disputed by the cardholder's bank. record_dispute() is idempotent on the
 * dispute's own id and on each balance transaction's id, so replayed events add nothing twice,
 * and it recalculates orders.chargeback_pence from the actual money movements rather than a
 * single point-in-time amount. Staff are only emailed the first time the status changes.
 */
async function onDispute(dispute: Stripe.Dispute) {
  const piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!piId) return;
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("id").eq("payment_ref", piId).maybeSingle();
  if (!order) {
    console.warn("dispute for unknown order", dispute.id);
    return;
  }
  if (dispute.currency !== "gbp") {
    await db.from("order_events").insert({
      order_id: order.id,
      kind: "note",
      message: `Non-GBP dispute received (${dispute.currency}), reviewed manually.`,
      data: { dispute_id: dispute.id },
      visible_to_customer: false,
    });
    return;
  }

  const transactions = (dispute.balance_transactions ?? []).map((t) => ({ id: t.id, amount: t.amount, fee: t.fee }));
  const { data, error } = await db.rpc("record_dispute", {
    p_order_id: order.id,
    p_provider_ref: dispute.id,
    p_charge_ref: typeof dispute.charge === "string" ? dispute.charge : (dispute.charge?.id ?? null),
    p_amount: dispute.amount,
    p_reason: dispute.reason,
    p_status: dispute.status,
    p_evidence_due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
    p_opened_at: new Date(dispute.created * 1000).toISOString(),
    p_transactions: transactions,
  });
  if (error) {
    console.error("record_dispute", error);
    return;
  }
  if (data?.status_changed) {
    await sendDisputeAlert(order.id, {
      id: dispute.id,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
      evidenceDueBy: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
    }).catch((e) => console.error("dispute alert email", e));
  }
}
