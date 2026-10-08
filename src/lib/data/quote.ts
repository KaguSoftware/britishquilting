import "server-only";

import { z } from "zod";
import { quote, type CartLine } from "@/lib/pricing";
import { findDiscount, getPricedProducts, getShippingRates, getStoreSettings, getVatRate, getViewer } from "@/lib/data/catalog";

const lineSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  lengthM: z.number().positive().max(1000).optional(),
  quantity: z.number().int().min(1).max(999),
  isSwatch: z.boolean().optional(),
});

export const quoteInputSchema = z.object({
  lines: z.array(lineSchema).max(60),
  fulfilment: z.enum(["delivery", "collection"]).default("delivery"),
  rateId: z.uuid().nullish(),
  discountCode: z.string().max(40).nullish(),
  email: z.email().nullish(),
});
export type QuoteInput = z.input<typeof quoteInputSchema>;

/** Authoritative quote from fresh database rows; shared by cart, checkout and payment creation. */
export async function computeQuote(raw: QuoteInput) {
  const input = quoteInputSchema.parse(raw);
  const viewer = await getViewer();
  const [products, rates, settings, disc, vatRatePct] = await Promise.all([
    getPricedProducts([...new Set(input.lines.map((l) => l.productId))]),
    getShippingRates(),
    getStoreSettings(),
    findDiscount(input.discountCode, input.email ?? viewer?.email),
    getVatRate(),
  ]);
  const q = quote({
    lines: input.lines as CartLine[],
    products,
    rates,
    rateId: input.rateId,
    fulfilment: input.fulfilment,
    discount: disc.discount,
    freeThreshold: settings.free_shipping_threshold_pence,
    vatRatePct,
  });
  return { q, viewer, settings, discount: disc.discount, discountError: disc.error, input };
}
