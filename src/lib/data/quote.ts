import "server-only";

import { z } from "zod";
import { quote, type CartLine } from "@/lib/pricing";
import { findDiscount, getPricedProducts, getShippingRates, getStoreSettings, getVatRate, getViewer } from "@/lib/data/catalog";
import { birthdayDiscount, birthdayEligibility, birthdayOfferLabel, londonDay } from "@/lib/birthday";
import { createAdminClient } from "@/lib/supabase/server";

/** Statuses that mean an order really used its birthday discount (abandoned and cancelled ones don't count). */
const USED = ["paid", "processing", "shipped", "ready_for_collection", "collected", "delivered"];

/** The birthday year a signed-in customer can use today, or null. */
async function birthdayFor(userId: string, settings: Awaited<ReturnType<typeof getStoreSettings>>) {
  if (!settings?.birthday_enabled) return null;
  const db = createAdminClient();
  const [{ data: p }, { data: used }] = await Promise.all([
    db.from("profiles").select("dob, dob_changed_at").eq("id", userId).maybeSingle(),
    db.from("orders").select("birthday_year").eq("user_id", userId).not("birthday_year", "is", null).in("status", USED),
  ]);
  return birthdayEligibility({
    settings,
    dob: p?.dob ?? null,
    dobChangedAt: p?.dob_changed_at ?? null,
    today: londonDay(),
    usedYears: (used ?? []).map((o) => o.birthday_year as number),
  });
}

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
  const priced = (discount: typeof disc.discount) =>
    quote({
      lines: input.lines as CartLine[],
      products,
      rates,
      rateId: input.rateId,
      fulfilment: input.fulfilment,
      discount,
      freeThreshold: settings.free_shipping_threshold_pence,
      vatRatePct,
    });
  let q = priced(disc.discount);
  let discount = disc.discount;

  // Birthday treat: taken off automatically for signed-in customers in their birthday window. It doesn't stack
  // with a code; whichever leaves the lower total wins.
  let birthday: { applied: boolean; year: number; end: string; label: string; beatCode: boolean } | null = null;
  const eligible = viewer ? await birthdayFor(viewer.id, settings) : null;
  if (eligible) {
    const bday = birthdayDiscount(settings);
    const qb = priced(bday);
    const applied = qb.discount > 0 && qb.total < q.total;
    if (applied) {
      q = qb;
      discount = bday;
    }
    birthday = { applied, year: eligible.year, end: eligible.end, label: birthdayOfferLabel(settings), beatCode: applied && !!disc.discount };
  }
  return { q, viewer, settings, discount, codeDiscount: disc.discount, discountError: disc.error, birthday, input };
}
