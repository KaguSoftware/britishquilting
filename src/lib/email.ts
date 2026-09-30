import "server-only";
import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { addDays, carrierLabel, trackingUrlFor } from "@/lib/checkout/helpers";
import { formatMetres, formatPence, storageUrl } from "@/lib/utils";
import OrderConfirmationEmail, { type OrderEmailProps } from "@/emails/order-confirmation";
import InvoiceOrderEmail from "@/emails/invoice-order";
import DispatchedEmail from "@/emails/dispatched";
import ReadyForCollectionEmail from "@/emails/ready-for-collection";
import RefundedEmail from "@/emails/refunded";
import OrderCancelledEmail from "@/emails/order-cancelled";
import PaymentReceivedEmail from "@/emails/payment-received";
import DeliveredEmail from "@/emails/delivered";
import { TradeApprovedEmail, TradeRejectedEmail } from "@/emails/trade";
import { BackInStockEmail, LowStockEmail } from "@/emails/stock";
import { DisputeAlertEmail } from "@/emails/dispute-alert";
import WelcomeNewsletterEmail from "@/emails/welcome-newsletter";
import type { EmailAddress, EmailLine } from "@/emails/components";

/**
 * Transactional email. Uses Resend when RESEND_API_KEY is set, otherwise logs
 * to the console so every flow works in development without keys.
 * All helpers swallow errors and return false: an email must never break a payment.
 */

const site = () => (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const from = () => env.EMAIL_FROM ?? "British Quilting <orders@britishquilting.com>";
let resend: Resend | null = null;

export async function sendEmail({ to, subject, react, replyTo }: { to: string | string[]; subject: string; react: ReactElement; replyTo?: string }) {
  try {
    const key = env.RESEND_API_KEY;
    if (!key) {
      console.info(`[email] (RESEND_API_KEY not set) to=${String(to)} subject="${subject}"`);
      return false; // nothing was actually sent
    }
    resend ??= new Resend(key);
    const html = await render(react);
    const text = await render(react, { plainText: true });
    const { error } = await resend.emails.send({ from: from(), to, subject, html, text, replyTo });
    if (error) {
      console.error("[email] resend error", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] failed", e);
    return false;
  }
}

/* ────────────────────────────── data loading */

type OrderRow = {
  id: string;
  number: number;
  user_id: string | null;
  email: string;
  status: string;
  payment_provider: string | null;
  fulfilment: "delivery" | "collection";
  shipping_address: (EmailAddress & { phone?: string }) | null;
  shipping_name: string | null;
  subtotal_pence: number;
  discount_pence: number;
  shipping_pence: number;
  total_pence: number;
  vat_included_pence: number;
  discount_code: string | null;
  is_trade: boolean;
  invoice_due_at: string | null;
  access_token: string;
  created_at: string;
};

type ItemRow = {
  name: string;
  image_path: string | null;
  sale_mode: "metre" | "roll" | "unit";
  is_swatch: boolean;
  length_m: number | string | null;
  quantity: number;
  line_total_pence: number;
};

export function orderUrl(o: { id: string; access_token: string }) {
  return `${site()}/checkout/success?order=${o.id}&token=${o.access_token}`;
}

export function itemDetail(i: Pick<ItemRow, "sale_mode" | "is_swatch" | "length_m" | "quantity">) {
  if (i.is_swatch) return "Swatch";
  if (i.sale_mode === "metre") return `${formatMetres(Number(i.length_m ?? 0))} cut${i.quantity > 1 ? ` x ${i.quantity}` : ""}`;
  return `Qty ${i.quantity}`;
}

async function loadOrder(orderId: string) {
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle<OrderRow>();
  if (!order) return null;
  const [{ data: items }, { data: profile }, { data: settings }] = await Promise.all([
    db.from("order_items").select("name, image_path, sale_mode, is_swatch, length_m, quantity, line_total_pence").eq("order_id", orderId).returns<ItemRow[]>(),
    order.user_id ? db.from("profiles").select("full_name, company_name").eq("id", order.user_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("store_settings").select("collection_address, collection_hours, bank_details, invoice_terms_days").eq("id", 1).maybeSingle(),
  ]);
  const fullName: string | null = profile?.full_name ?? order.shipping_address?.fullName ?? null;
  const lines: EmailLine[] = (items ?? []).map((i) => ({
    name: i.name,
    detail: itemDetail(i),
    total: i.line_total_pence,
    image: storageUrl(i.image_path),
  }));
  const props: OrderEmailProps = {
    number: order.number,
    firstName: fullName?.split(" ")[0] ?? null,
    lines,
    totals: {
      subtotal: order.subtotal_pence,
      discount: order.discount_pence,
      discountCode: order.discount_code,
      shipping: order.shipping_pence,
      shippingName: order.shipping_name,
      fulfilment: order.fulfilment,
      total: order.total_pence,
      vat: order.vat_included_pence,
    },
    shippingAddress: order.fulfilment === "delivery" ? order.shipping_address : null,
    collection: order.fulfilment === "collection" ? { address: settings?.collection_address ?? null, hours: settings?.collection_hours ?? null } : null,
    orderUrl: orderUrl(order),
  };
  return { db, order, props, profile, settings };
}

async function logEmail(orderId: string, template: string, ok: boolean) {
  const db = createAdminClient();
  await db.from("order_events").insert({
    order_id: orderId,
    kind: "email",
    message: ok ? `Email sent: ${template}` : `Email failed: ${template}`,
    data: { template, ok },
    visible_to_customer: false,
  });
}

async function alreadySent(orderId: string, template: string) {
  const db = createAdminClient();
  const { count } = await db
    .from("order_events")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("kind", "email")
    .contains("data", { template, ok: true });
  return (count ?? 0) > 0;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

/* ────────────────────────────── public helpers (imported by checkout, webhooks and admin) */

/** Payment confirmation. Idempotent: sends at most once per order. */
export async function sendOrderConfirmation(orderId: string) {
  try {
    if (await alreadySent(orderId, "order-confirmation")) return true;
    const data = await loadOrder(orderId);
    if (!data) return false;
    const ok = await sendEmail({ to: data.order.email, subject: `Order #${data.order.number} confirmed`, react: OrderConfirmationEmail(data.props) });
    await logEmail(orderId, "order-confirmation", ok);
    return ok;
  } catch (e) {
    console.error("sendOrderConfirmation", e);
    return false;
  }
}

/** Trade order placed on account, with bank transfer details. */
export async function sendInvoiceOrder(orderId: string) {
  try {
    if (await alreadySent(orderId, "invoice-order")) return true;
    const data = await loadOrder(orderId);
    if (!data) return false;
    const terms = data.settings?.invoice_terms_days ?? 30;
    const due = data.order.invoice_due_at ? new Date(data.order.invoice_due_at) : addDays(new Date(data.order.created_at), terms);
    const ok = await sendEmail({
      to: data.order.email,
      subject: `Order #${data.order.number} confirmed on account`,
      react: InvoiceOrderEmail({
        ...data.props,
        company: data.profile?.company_name ?? null,
        dueDate: dateFmt.format(due),
        termsDays: terms,
        bankDetails: data.settings?.bank_details ?? null,
      }),
    });
    await logEmail(orderId, "invoice-order", ok);
    return ok;
  } catch (e) {
    console.error("sendInvoiceOrder", e);
    return false;
  }
}

/** Uses the most recent shipment row for the order. */
export async function sendDispatched(orderId: string) {
  try {
    const data = await loadOrder(orderId);
    if (!data) return false;
    const { data: shipment } = await data.db
      .from("shipments")
      .select("carrier, tracking_number, tracking_url")
      .eq("order_id", orderId)
      .order("shipped_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!shipment) return false;
    const ok = await sendEmail({
      to: data.order.email,
      subject: `Order #${data.order.number} is on its way`,
      react: DispatchedEmail({
        number: data.order.number,
        firstName: data.props.firstName,
        carrier: carrierLabel(shipment.carrier),
        trackingNumber: shipment.tracking_number,
        trackingUrl: trackingUrlFor(shipment.carrier, shipment.tracking_number, shipment.tracking_url),
        lines: data.props.lines,
        shippingAddress: data.props.shippingAddress,
        orderUrl: data.props.orderUrl,
      }),
    });
    await logEmail(orderId, "dispatched", ok);
    return ok;
  } catch (e) {
    console.error("sendDispatched", e);
    return false;
  }
}

export async function sendReadyForCollection(orderId: string) {
  try {
    const data = await loadOrder(orderId);
    if (!data) return false;
    const ok = await sendEmail({
      to: data.order.email,
      subject: `Order #${data.order.number} is ready to collect`,
      react: ReadyForCollectionEmail({
        number: data.order.number,
        firstName: data.props.firstName,
        address: data.settings?.collection_address ?? null,
        hours: data.settings?.collection_hours ?? null,
        lines: data.props.lines,
        orderUrl: data.props.orderUrl,
      }),
    });
    await logEmail(orderId, "ready-for-collection", ok);
    return ok;
  } catch (e) {
    console.error("sendReadyForCollection", e);
    return false;
  }
}

/** amountPence defaults to the order total (full refund). Idempotent for full refunds. */
export async function sendRefunded(orderId: string, amountPence?: number) {
  try {
    const template = amountPence == null ? "refunded" : `refunded-${amountPence}`;
    if (await alreadySent(orderId, template)) return true;
    const data = await loadOrder(orderId);
    if (!data) return false;
    const method = data.order.payment_provider === "paypal" ? "PayPal" : data.order.payment_provider === "invoice" ? "bank transfer" : "card";
    const ok = await sendEmail({
      to: data.order.email,
      subject: `Refund for order #${data.order.number}`,
      react: RefundedEmail({
        number: data.order.number,
        firstName: data.props.firstName,
        amount: amountPence ?? data.order.total_pence,
        method,
        orderUrl: data.props.orderUrl,
      }),
    });
    await logEmail(orderId, template, ok);
    return ok;
  } catch (e) {
    console.error("sendRefunded", e);
    return false;
  }
}

/** Order cancelled. Sent once per order. */
export async function sendOrderCancelled(orderId: string, reason?: string | null) {
  try {
    if (await alreadySent(orderId, "cancelled")) return true;
    const data = await loadOrder(orderId);
    if (!data) return false;
    const { data: paid } = await data.db.from("orders").select("paid_at").eq("id", orderId).maybeSingle();
    const ok = await sendEmail({
      to: data.order.email,
      subject: `Order #${data.order.number} has been cancelled`,
      react: OrderCancelledEmail({
        number: data.order.number,
        firstName: data.props.firstName,
        lines: data.props.lines,
        wasPaid: Boolean(paid?.paid_at),
        reason: reason?.trim() || null,
        orderUrl: data.props.orderUrl,
      }),
    });
    await logEmail(orderId, "cancelled", ok);
    return ok;
  } catch (e) {
    console.error("sendOrderCancelled", e);
    return false;
  }
}

/** Invoice (bank transfer) payment arrived. Sent once per order. */
export async function sendPaymentReceived(orderId: string, reference?: string | null) {
  try {
    if (await alreadySent(orderId, "payment-received")) return true;
    const data = await loadOrder(orderId);
    if (!data) return false;
    const ok = await sendEmail({
      to: data.order.email,
      subject: `Payment received for order #${data.order.number}`,
      react: PaymentReceivedEmail({
        number: data.order.number,
        firstName: data.props.firstName,
        amount: data.order.total_pence,
        reference: reference?.trim() || null,
        orderUrl: data.props.orderUrl,
      }),
    });
    await logEmail(orderId, "payment-received", ok);
    return ok;
  } catch (e) {
    console.error("sendPaymentReceived", e);
    return false;
  }
}

async function sendArrived(orderId: string, kind: "delivered" | "collected") {
  try {
    if (await alreadySent(orderId, kind)) return true;
    const data = await loadOrder(orderId);
    if (!data) return false;
    const { data: first } = await data.db
      .from("order_items")
      .select("products(slug)")
      .eq("order_id", orderId)
      .eq("is_swatch", false)
      .not("product_id", "is", null)
      .limit(1)
      .maybeSingle();
    const product = first?.products as { slug: string } | { slug: string }[] | null | undefined;
    const slug = Array.isArray(product) ? product[0]?.slug : product?.slug;
    const ok = await sendEmail({
      to: data.order.email,
      subject: kind === "collected" ? `Thank you for collecting order #${data.order.number}` : `Order #${data.order.number} has arrived`,
      react: DeliveredEmail({
        number: data.order.number,
        firstName: data.props.firstName,
        kind,
        lines: data.props.lines,
        reviewUrl: slug ? `${site()}/product/${slug}#reviews` : null,
        orderUrl: data.props.orderUrl,
      }),
    });
    await logEmail(orderId, kind, ok);
    return ok;
  } catch (e) {
    console.error("sendArrived", e);
    return false;
  }
}

/** Thank-you with a review link once a courier order has arrived. Sent once. */
export const sendDelivered = (orderId: string) => sendArrived(orderId, "delivered");
/** Thank-you with a review link once the customer has collected. Sent once. */
export const sendCollected = (orderId: string) => sendArrived(orderId, "collected");

export async function sendTradeDecision(userId: string, approved: boolean) {
  try {
    const db = createAdminClient();
    const { data: p } = await db.from("profiles").select("email, full_name, company_name").eq("id", userId).maybeSingle();
    if (!p?.email) return false;
    const props = { firstName: p.full_name?.split(" ")[0] ?? null, company: p.company_name ?? null };
    return await sendEmail({
      to: p.email,
      subject: approved ? "Your trade account is approved" : "Your trade account application",
      react: approved ? TradeApprovedEmail(props) : TradeRejectedEmail(props),
    });
  } catch (e) {
    console.error("sendTradeDecision", e);
    return false;
  }
}

/** Emails everyone waiting on this product and marks their alerts as notified. Returns the number sent. */
export async function sendBackInStock(productId: string) {
  try {
    const db = createAdminClient();
    const [{ data: product }, { data: alerts }] = await Promise.all([
      db
        .from("products")
        .select("name, subtitle, slug, sale_mode, price_pence, product_images(storage_path, sort_order)")
        .eq("id", productId)
        .maybeSingle(),
      db.from("stock_alerts").select("id, email").eq("product_id", productId).is("notified_at", null).limit(500),
    ]);
    if (!product || !alerts?.length) return 0;
    const images = ((product.product_images ?? []) as { storage_path: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
    const props = {
      name: product.name,
      subtitle: product.subtitle,
      url: `${site()}/product/${product.slug}`,
      image: storageUrl(images[0]?.storage_path),
      price: `${formatPence(product.price_pence)}${product.sale_mode === "metre" ? "/m" : ""}`,
    };
    let sent = 0;
    for (const a of alerts) {
      if (await sendEmail({ to: a.email, subject: `${product.name} is back in stock`, react: BackInStockEmail(props) })) {
        sent++;
        await db.from("stock_alerts").update({ notified_at: new Date().toISOString() }).eq("id", a.id);
      }
    }
    return sent;
  } catch (e) {
    console.error("sendBackInStock", e);
    return 0;
  }
}

/** Staff alert for products at or below their low stock threshold. */
export async function sendLowStock(productIds: string[]) {
  try {
    if (!productIds.length) return false;
    const db = createAdminClient();
    const [{ data: products }, { data: settings }] = await Promise.all([
      db.from("products").select("id, name, subtitle, sale_mode, stock_qty, low_stock_threshold").in("id", productIds),
      db.from("store_settings").select("low_stock_email").eq("id", 1).maybeSingle(),
    ]);
    const to = settings?.low_stock_email || env.STAFF_NOTIFY_EMAIL;
    if (!to || !products?.length) return false;
    const unit = (mode: string, n: number) => (mode === "metre" ? formatMetres(n) : `${n}`);
    return await sendEmail({
      to,
      subject: `Low stock: ${products.map((p) => p.name).slice(0, 3).join(", ")}${products.length > 3 ? ` and ${products.length - 3} more` : ""}`,
      react: LowStockEmail({
        products: products.map((p) => ({
          name: p.subtitle ? `${p.name}, ${p.subtitle}` : p.name,
          stock: unit(p.sale_mode, Number(p.stock_qty)),
          threshold: unit(p.sale_mode, Number(p.low_stock_threshold)),
          adminUrl: `${site()}/admin/products/${p.id}`,
        })),
      }),
    });
  } catch (e) {
    console.error("sendLowStock", e);
    return false;
  }
}

/** Staff alert for a Stripe dispute (chargeback), sent the first time its status changes. */
export async function sendDisputeAlert(orderId: string, dispute: { id: string; amount: number; reason: string | null; status: string; evidenceDueBy: string | null }) {
  try {
    const db = createAdminClient();
    const [{ data: order }, { data: settings }] = await Promise.all([
      db.from("orders").select("number").eq("id", orderId).maybeSingle(),
      db.from("store_settings").select("low_stock_email").eq("id", 1).maybeSingle(),
    ]);
    const to = settings?.low_stock_email || env.STAFF_NOTIFY_EMAIL;
    if (!to || !order) return false;
    return await sendEmail({
      to,
      subject: `Payment disputed: order #${order.number}`,
      react: DisputeAlertEmail({
        orderNumber: order.number,
        amount: formatPence(dispute.amount),
        reason: dispute.reason ?? "Not given",
        status: dispute.status,
        evidenceDueBy: dispute.evidenceDueBy,
        dashboardUrl: `https://dashboard.stripe.com/disputes/${dispute.id}`,
        adminUrl: `${site()}/admin/orders/${orderId}`,
      }),
    });
  } catch (e) {
    console.error("sendDisputeAlert", e);
    return false;
  }
}

export async function sendWelcomeNewsletter(email: string) {
  return sendEmail({ to: email, subject: "Welcome to British Quilting", react: WelcomeNewsletterEmail() });
}
