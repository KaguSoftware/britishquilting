import { z } from "zod";
import { capturePayPalOrder, getPayPalOrder, paypalConfigured, type PayPalOrder } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/server";
import { finaliseOrder } from "@/lib/checkout/finalise";
import { decimalToPence } from "@/lib/checkout/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ paypalOrderId: z.string().min(5).max(64).regex(/^[A-Z0-9]+$/) });

/**
 * Captures an approved PayPal order server-side, checks the captured amount
 * equals our order total, then finalises. Idempotent: repeat calls return the same result.
 */
export async function POST(req: Request) {
  if (!paypalConfigured()) return Response.json({ ok: false, error: "PayPal is not available right now." }, { status: 503 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  const { paypalOrderId } = parsed.data;

  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, status, total_pence, access_token, payment_provider, payment_ref")
    .eq("payment_provider", "paypal")
    .eq("payment_ref", paypalOrderId)
    .maybeSingle();
  if (!order) return Response.json({ ok: false, error: "We couldn't find this order. You have not been charged." }, { status: 404 });

  const successUrl = `/checkout/success?order=${order.id}&token=${order.access_token}`;
  if (!["pending", "awaiting_payment"].includes(order.status)) return Response.json({ ok: true, successUrl });

  let pp: PayPalOrder;
  try {
    pp = await capturePayPalOrder(paypalOrderId);
  } catch (e) {
    const issue = (e as { issue?: string }).issue;
    if (issue === "ORDER_ALREADY_CAPTURED") {
      pp = await getPayPalOrder(paypalOrderId);
    } else if (issue === "INSTRUMENT_DECLINED") {
      return Response.json({ ok: false, restart: true, error: "PayPal declined that payment method. Please choose another." }, { status: 402 });
    } else {
      console.error("paypal capture", e);
      return Response.json({ ok: false, error: "PayPal couldn't complete the payment. You have not been charged." }, { status: 502 });
    }
  }

  const unit = pp.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find((c) => c.status === "COMPLETED") ?? unit?.payments?.captures?.[0];
  const captured = capture ? decimalToPence(capture.amount.value) : null;

  if (pp.status !== "COMPLETED" || !capture || capture.status !== "COMPLETED") {
    // PENDING captures (eCheck, review) are finalised later from PayPal's side; keep the order open.
    await db.from("order_events").insert({
      order_id: order.id,
      kind: "note",
      message: `PayPal capture status ${capture?.status ?? pp.status}`,
      data: { paypal_order: paypalOrderId },
      visible_to_customer: false,
    });
    if (capture?.status === "PENDING") return Response.json({ ok: true, successUrl });
    return Response.json({ ok: false, error: "PayPal hasn't confirmed the payment. You have not been charged." }, { status: 402 });
  }

  if (capture.amount.currency_code !== "GBP" || captured !== order.total_pence || (unit?.custom_id && unit.custom_id !== order.id)) {
    await db.from("order_events").insert({
      order_id: order.id,
      kind: "note",
      message: `PayPal amount mismatch: captured ${capture.amount.value} ${capture.amount.currency_code}, expected ${order.total_pence} pence. Review before fulfilling.`,
      data: { paypal_order: paypalOrderId, capture: capture.id },
      visible_to_customer: false,
    });
    return Response.json({ ok: false, error: "Something didn't match on this payment. Our team has been alerted and will be in touch." }, { status: 409 });
  }

  await finaliseOrder(order.id, "paypal", paypalOrderId);
  return Response.json({ ok: true, successUrl });
}
