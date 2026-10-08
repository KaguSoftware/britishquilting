import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { sendLowStock, sendOrderConfirmation } from "@/lib/email";
import { revalidateStorefront } from "@/lib/orders/revalidate";

type Provider = "stripe" | "paypal" | "invoice";

/**
 * Marks an order paid exactly once (finalise_paid_order is idempotent, locks the row and
 * reports whether this call did the transition), records the discount redemption, emails
 * the customer and alerts staff to low stock. Safe to call from the webhook, the PayPal
 * capture route and the success page concurrently: only the winning call sends email.
 */
export async function finaliseOrder(orderId: string, provider: Provider, ref: string) {
  const db = createAdminClient();
  const { data: order, error } = await db.rpc("finalise_paid_order", { p_order_id: orderId, p_provider: provider, p_ref: ref });
  if (error) throw error;
  if (!order?.transitioned) return order;

  revalidateStorefront();
  await afterCommit(orderId, order?.discount_code ?? null, order?.email ?? null);
  await sendOrderConfirmation(orderId);
  return order;
}

/** Post-commit bookkeeping shared by paid and invoice orders. Never throws. */
export async function afterCommit(orderId: string, discountCode: string | null, email: string | null) {
  const db = createAdminClient();
  try {
    if (discountCode && email) {
      const { data: d } = await db.from("discount_codes").select("id").eq("code", discountCode).maybeSingle();
      if (d) {
        const { count } = await db.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("order_id", orderId);
        if (!count) await db.from("discount_redemptions").insert({ discount_id: d.id, order_id: orderId, email });
      }
    }
  } catch (e) {
    console.error("discount redemption", e);
  }
  try {
    await checkLowStock(orderId);
  } catch (e) {
    console.error("low stock check", e);
  }
}

async function checkLowStock(orderId: string) {
  const db = createAdminClient();
  const { data: items } = await db.from("order_items").select("product_id").eq("order_id", orderId).eq("is_swatch", false);
  const ids = [...new Set((items ?? []).map((i) => i.product_id).filter(Boolean))] as string[];
  if (!ids.length) return;
  const { data: products } = await db
    .from("products")
    .select("id, stock_qty, low_stock_threshold, track_stock, product_variants(stock_qty, is_active)")
    .in("id", ids);
  // A product sold in colours is low when any one colour is.
  const levels = (p: { stock_qty: number; product_variants: { stock_qty: number; is_active: boolean }[] | null }) => {
    const variants = (p.product_variants ?? []).filter((v) => v.is_active);
    return variants.length ? variants.map((v) => Number(v.stock_qty)) : [Number(p.stock_qty)];
  };
  const low = (products ?? [])
    .filter((p) => p.track_stock && levels(p).some((n) => n <= Number(p.low_stock_threshold)))
    .map((p) => p.id);
  if (low.length) await sendLowStock(low);
}
