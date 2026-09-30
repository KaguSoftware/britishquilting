"use server";

import { lineErrorMessage } from "@/lib/pricing";
import { computeQuote, type QuoteInput } from "@/lib/data/quote";

/** Client-safe shape: no trade prices or stock levels leak beyond what the viewer is entitled to. */
export async function quoteCart(raw: QuoteInput) {
  try {
    const { q, viewer, settings, discount, discountError } = await computeQuote(raw);
    return {
      ok: true as const,
      trade: Boolean(viewer?.isTrade),
      lines: q.lines.map((l) => ({
        productId: l.line.productId,
        lengthM: l.line.lengthM,
        isSwatch: Boolean(l.line.isSwatch),
        unit: l.unit,
        total: l.total,
        error: l.error ? lineErrorMessage[l.error] : null,
      })),
      subtotal: q.subtotal,
      discount: q.discount,
      discountCode: discount?.code ?? null,
      discountError: discountError ?? null,
      shipping: q.shipping,
      total: q.total,
      vat: q.vat,
      vatRate: q.vatRate,
      rates: q.rates.map((r, i) => ({
        id: r.id,
        name: r.name,
        carrier: r.carrier,
        estimated_days: r.estimated_days,
        price:
          i === 0 &&
          (discount?.kind === "free_shipping" ||
            (settings.free_shipping_threshold_pence != null && q.subtotal - q.discount >= settings.free_shipping_threshold_pence))
            ? 0
            : r.price_pence,
      })),
      selectedRateId: q.selectedRate?.id ?? null,
      freeThreshold: settings.free_shipping_threshold_pence,
      collection: settings.collection_enabled ? { address: settings.collection_address, hours: settings.collection_hours } : null,
      valid: q.valid,
    };
  } catch (e) {
    console.error("quoteCart", e);
    return { ok: false as const, error: "We couldn't price your basket just now. Please try again." };
  }
}

export type CartQuote = Extract<Awaited<ReturnType<typeof quoteCart>>, { ok: true }>;
