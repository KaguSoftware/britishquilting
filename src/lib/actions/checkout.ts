"use server";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { computeQuote, quoteInputSchema } from "@/lib/data/quote";
import { lineErrorMessage } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createPayPalOrder, paypalConfigured } from "@/lib/paypal";
import { addDays, cartFingerprint, isUkPhone, isValidUkPostcode, normalisePostcode } from "@/lib/checkout/helpers";
import { afterCommit } from "@/lib/checkout/finalise";
import { sendInvoiceOrder } from "@/lib/email";
import { revalidateStorefront } from "@/lib/orders/revalidate";

const text = (max: number) => z.string().trim().max(max);

const addressSchema = z.object({
  fullName: text(120).min(2, "Please enter the recipient's name."),
  line1: text(160).min(2, "Please enter the first line of the address."),
  line2: text(160).optional().default(""),
  city: text(80).min(2, "Please enter a town or city."),
  county: text(80).optional().default(""),
  postcode: text(10).refine(isValidUkPostcode, "Please enter a valid UK postcode.").transform(normalisePostcode),
  phone: text(30).refine((v) => v === "" || isUkPhone(v), "Please enter a UK phone number.").optional().default(""),
});

const checkoutSchema = quoteInputSchema.extend({
  email: z.email("Please enter a valid email address.").max(200),
  provider: z.enum(["stripe", "paypal", "invoice"]),
  contactName: text(120).min(2, "Please enter your name."),
  contactPhone: text(30).refine((v) => v === "" || isUkPhone(v), "Please enter a UK phone number.").optional().default(""),
  address: addressSchema.nullish(),
  note: text(500).optional().default(""),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      number: number;
      total: number;
      successUrl: string;
      provider: "stripe" | "paypal" | "invoice";
      clientSecret?: string;
      paypalOrderId?: string;
    }
  | { ok: false; error: string; fields?: Record<string, string>; requote?: boolean };

const COOKIE = "bq_checkout";
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-only-secret";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

async function readAttempt() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [orderId, hash, sig] = raw.split(".");
  if (!orderId || !hash || !sig) return null;
  const expected = Buffer.from(sign(`${orderId}.${hash}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { orderId, hash };
}

async function writeAttempt(orderId: string, hash: string) {
  (await cookies()).set(COOKIE, `${orderId}.${hash}.${sign(`${orderId}.${hash}`)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6,
  });
}

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Creates (or reuses) an order from an authoritative server quote and starts payment.
 * The client never supplies prices: everything is recomputed from database rows.
 */
export async function createOrder(raw: CheckoutInput): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted details.", fields: fieldErrors(parsed.error) };
  const input = parsed.data;

  try {
    const { q, viewer, settings, discount, discountError } = await computeQuote({
      lines: input.lines,
      fulfilment: input.fulfilment,
      rateId: input.rateId,
      discountCode: input.discountCode,
      email: input.email,
    });

    // Signed-in customers always order under their account email.
    const email = (viewer?.email ?? input.email).toLowerCase();

    if (input.fulfilment === "collection" && !settings.collection_enabled)
      return { ok: false, error: "Click & collect isn't available at the moment. Please choose delivery.", requote: true };
    if (input.fulfilment === "delivery" && !input.address)
      return { ok: false, error: "Please add a delivery address.", fields: { "address.line1": "Please add a delivery address." } };
    if (input.discountCode?.trim() && discountError) return { ok: false, error: discountError, fields: { discountCode: discountError }, requote: true };
    if (!q.valid) {
      const bad = q.lines.find((l) => l.error);
      return {
        ok: false,
        error: bad?.error ? `${lineErrorMessage[bad.error]} Please review your basket.` : "Please choose a delivery option.",
        requote: true,
      };
    }
    if (q.total <= 0) return { ok: false, error: "There's nothing to pay for this order. Please contact us to complete it." };

    if (input.provider === "invoice" && !viewer?.isTrade) return { ok: false, error: "Pay by invoice is only available to approved trade accounts." };
    if (input.provider === "stripe" && !stripeConfigured()) return { ok: false, error: "Card payments are temporarily unavailable. Please try PayPal." };
    if (input.provider === "paypal" && !paypalConfigured()) return { ok: false, error: "PayPal is temporarily unavailable. Please pay by card." };

    const address =
      input.fulfilment === "delivery" && input.address
        ? { ...input.address, phone: input.address.phone || input.contactPhone, country: "GB" }
        : { fullName: input.contactName, phone: input.contactPhone, country: "GB" };

    const hash = createHash("sha256")
      .update(
        cartFingerprint({
          lines: input.lines,
          fulfilment: input.fulfilment,
          rateId: q.selectedRate?.id ?? null,
          discountCode: discount?.code ?? null,
          email,
          address,
          total: q.total,
        }) + `|${viewer?.id ?? "guest"}|${input.provider === "invoice" ? "inv" : "pay"}`,
      )
      .digest("base64url")
      .slice(0, 32);

    const db = createAdminClient();

    // Idempotency: the same basket in the same browser session reuses its open order.
    type OpenOrder = { id: string; number: number; access_token: string; total_pence: number; vat_included_pence: number; payment_provider: string | null; payment_ref: string | null };
    let order: OpenOrder | null = null;
    const attempt = await readAttempt();
    if (attempt && attempt.hash === hash && input.provider !== "invoice") {
      const { data } = await db
        .from("orders")
        .select("id, number, access_token, total_pence, vat_included_pence, payment_provider, payment_ref, status, email, user_id")
        .eq("id", attempt.orderId)
        .maybeSingle();
      // vat_included_pence must still match too: the VAT rate can change between quoting and payment,
      // and reusing a stale order would keep the old rate frozen on a new-looking total.
      if (
        data &&
        data.status === "awaiting_payment" &&
        data.total_pence === q.total &&
        data.vat_included_pence === q.vat &&
        data.email === email &&
        (data.user_id ?? null) === (viewer?.id ?? null)
      )
        order = data;
    }

    if (!order) {
      const ids = [...new Set(input.lines.map((l) => l.productId))];
      const { data: meta } = await db.from("products").select("id, name, subtitle, product_images(storage_path, sort_order)").in("id", ids);
      const metaById = new Map((meta ?? []).map((m) => [m.id, m]));
      const isInvoice = input.provider === "invoice";

      const { data: created, error } = await db
        .from("orders")
        .insert({
          user_id: viewer?.id ?? null,
          email,
          status: isInvoice ? "processing" : "awaiting_payment",
          payment_provider: input.provider,
          fulfilment: input.fulfilment,
          shipping_address: address,
          billing_address: address,
          shipping_rate_id: q.selectedRate?.id ?? null,
          shipping_name: input.fulfilment === "collection" ? "Click & collect" : (q.selectedRate?.name ?? null),
          subtotal_pence: q.subtotal,
          discount_pence: q.discount,
          shipping_pence: q.shipping,
          total_pence: q.total,
          vat_included_pence: q.vat,
          vat_rate: q.vatRate,
          discount_code: discount?.code ?? null,
          is_trade: Boolean(viewer?.isTrade),
          invoice_due_at: isInvoice ? addDays(new Date(), settings.invoice_terms_days ?? 30).toISOString() : null,
          customer_note: input.note || null,
        })
        .select("id, number, access_token, total_pence, vat_included_pence, payment_provider, payment_ref")
        .single();
      if (error || !created) throw error ?? new Error("order insert failed");

      const items = q.lines.map((l) => {
        const m = metaById.get(l.line.productId);
        const imgs = ((m?.product_images ?? []) as { storage_path: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
        const baseName = m?.name ?? l.product!.name;
        return {
          order_id: created.id,
          product_id: l.line.productId,
          name: m?.subtitle ? `${baseName}, ${m.subtitle}` : baseName,
          image_path: imgs[0]?.storage_path ?? null,
          sale_mode: l.product!.sale_mode,
          is_swatch: Boolean(l.line.isSwatch),
          length_m: l.product!.sale_mode === "metre" && !l.line.isSwatch ? (l.line.lengthM ?? null) : null,
          quantity: l.line.quantity,
          unit_price_pence: l.unit,
          line_total_pence: l.total,
        };
      });
      const { error: itemsError } = await db.from("order_items").insert(items);
      if (itemsError) {
        await db.from("orders").delete().eq("id", created.id);
        throw itemsError;
      }
      if (input.provider === "invoice") {
        // Reserve stock atomically (row locks, all or nothing) before the order is confirmed.
        const { error: stockError } = await db.rpc("reserve_order_stock", { p_order_id: created.id });
        if (stockError) {
          await db.from("orders").delete().eq("id", created.id);
          if (stockError.message?.includes("insufficient_stock"))
            return { ok: false, error: "Sorry, some items in your basket have just sold out. Please review your basket.", requote: true };
          throw stockError;
        }
      }
      await db.from("order_events").insert({
        order_id: created.id,
        kind: "created",
        message: isInvoice ? "Order placed on trade account" : "Order created, awaiting payment",
        data: { provider: input.provider, total_pence: q.total },
      });

      if (isInvoice) {
        await db.from("order_events").insert({
          order_id: created.id,
          kind: "status",
          message: `Invoice issued, due in ${settings.invoice_terms_days ?? 30} days`,
          data: { status: "processing" },
        });
        await afterCommit(created.id, discount?.code ?? null, email);
        revalidateStorefront(); // stock was reserved and the discount use counted inside reserve_order_stock
        await sendInvoiceOrder(created.id);
        return { ok: true, orderId: created.id, number: created.number, total: q.total, provider: "invoice", successUrl: successUrl(created) };
      }

      order = created;
      await writeAttempt(created.id, hash);
    }

    const current = order!;
    if (input.provider === "stripe") {
      const stripe = getStripe()!;
      let clientSecret: string | null = null;
      if (current.payment_provider === "stripe" && current.payment_ref?.startsWith("pi_")) {
        const existing = await stripe.paymentIntents.retrieve(current.payment_ref).catch(() => null);
        if (
          existing &&
          existing.amount === current.total_pence &&
          ["requires_payment_method", "requires_confirmation", "requires_action"].includes(existing.status)
        )
          clientSecret = existing.client_secret;
      }
      if (!clientSecret) {
        const pi = await stripe.paymentIntents.create(
          {
            amount: current.total_pence,
            currency: "gbp",
            automatic_payment_methods: { enabled: true },
            receipt_email: email,
            description: `British Quilting order #${current.number}`,
            metadata: { order_id: current.id, order_number: String(current.number) },
          },
          { idempotencyKey: `bq-pi-${current.id}-${current.total_pence}` },
        );
        clientSecret = pi.client_secret;
        await db.from("orders").update({ payment_provider: "stripe", payment_ref: pi.id }).eq("id", current.id).eq("status", "awaiting_payment");
      }
      return { ok: true, orderId: current.id, number: current.number, total: current.total_pence, provider: "stripe", clientSecret: clientSecret!, successUrl: successUrl(current) };
    }

    // PayPal: if we are switching away from an open card attempt, cancel it so only one payment can land.
    if (current.payment_provider === "stripe" && current.payment_ref?.startsWith("pi_")) {
      await getStripe()?.paymentIntents.cancel(current.payment_ref).catch(() => null);
    }
    const pp = await createPayPalOrder({ orderId: current.id, orderNumber: current.number, totalPence: current.total_pence });
    await db.from("orders").update({ payment_provider: "paypal", payment_ref: pp.id }).eq("id", current.id).eq("status", "awaiting_payment");
    return { ok: true, orderId: current.id, number: current.number, total: current.total_pence, provider: "paypal", paypalOrderId: pp.id, successUrl: successUrl(current) };
  } catch (e) {
    console.error("createOrder", e);
    return { ok: false, error: "We couldn't start your payment just now. Nothing has been charged. Please try again in a moment." };
  }
}

function successUrl(o: { id: string; access_token: string }) {
  return `/checkout/success?order=${o.id}&token=${o.access_token}`;
}
