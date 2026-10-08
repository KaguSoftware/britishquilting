/**
 * Pure pricing engine. The browser uses it for live previews; the server
 * re-runs it against fresh database rows before any payment is taken.
 * All money is integer pence.
 */

export type SaleMode = "metre" | "roll" | "unit";

export type PricedProduct = {
  id: string;
  name: string;
  sale_mode: SaleMode;
  price_pence: number;
  min_length_m: number | null;
  length_step_m: number | null;
  max_length_m: number | null;
  weight_g_per_unit: number;
  swatch_enabled: boolean;
  swatch_price_pence: number;
  stock_qty: number;
  track_stock: boolean;
  /** Active colour variants. When present, every non-swatch line must pick one and stock is counted per colour. */
  variants?: PricedVariant[];
};

export type PricedVariant = { id: string; name: string; stock_qty: number };

export type CartLine = {
  productId: string;
  /** colour variant, required for products that have variants */
  variantId?: string;
  /** metres per piece, only for metre products */
  lengthM?: number;
  quantity: number;
  isSwatch?: boolean;
};

export type ShippingRate = {
  id: string;
  name: string;
  carrier: string;
  min_weight_g: number;
  max_weight_g: number | null;
  price_pence: number;
  estimated_days: string | null;
};

export type Discount = {
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  value: number;
  min_subtotal_pence: number;
};

export type LineError =
  | "unavailable"
  | "below_min"
  | "above_max"
  | "bad_step"
  | "out_of_stock"
  | "swatch_unavailable"
  | "bad_quantity"
  | "choose_colour";

export const MAX_SWATCHES = 6;

const EPS = 1e-6;
const roundPence = (n: number) => Math.round(n + EPS);

export function unitPrice(p: PricedProduct) {
  return p.price_pence;
}

/** Quantity that consumes stock: metres for metre products, pieces otherwise. */
export function stockUsage(p: PricedProduct, line: CartLine) {
  if (line.isSwatch) return 0;
  return p.sale_mode === "metre" ? (line.lengthM ?? 0) * line.quantity : line.quantity;
}

/** The variant a line points at, or null when the product has none. Undefined means the choice is missing or invalid. */
export function lineVariant(p: PricedProduct, line: CartLine): PricedVariant | null | undefined {
  const variants = p.variants ?? [];
  if (!variants.length) return line.variantId ? undefined : null;
  if (!line.variantId) return line.isSwatch ? null : undefined;
  return variants.find((v) => v.id === line.variantId);
}

/** Stock available to a line: the chosen colour's, or the product's when it has no colours. */
function stockFor(p: PricedProduct, variant: PricedVariant | null) {
  return Number(variant ? variant.stock_qty : p.stock_qty);
}

export function validateLine(p: PricedProduct | undefined, line: CartLine): LineError | null {
  if (!p) return "unavailable";
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 999) return "bad_quantity";
  const variant = lineVariant(p, line);
  if (variant === undefined) return line.variantId ? "unavailable" : "choose_colour";
  if (line.isSwatch) {
    if (!p.swatch_enabled) return "swatch_unavailable";
    return line.quantity === 1 ? null : "bad_quantity";
  }
  if (p.sale_mode === "metre") {
    const len = line.lengthM ?? 0;
    const min = Number(p.min_length_m ?? 0.5);
    const step = Number(p.length_step_m ?? 0.5);
    if (len < min - EPS) return "below_min";
    if (p.max_length_m != null && len > Number(p.max_length_m) + EPS) return "above_max";
    const steps = len / step;
    if (Math.abs(steps - Math.round(steps)) > EPS) return "bad_step";
  }
  if (p.track_stock && stockUsage(p, line) > stockFor(p, variant) + EPS) return "out_of_stock";
  return null;
}

export function linePrice(p: PricedProduct, line: CartLine) {
  if (line.isSwatch) return p.swatch_price_pence * line.quantity;
  const u = unitPrice(p);
  if (p.sale_mode === "metre") return roundPence(u * (line.lengthM ?? 0) * line.quantity);
  return u * line.quantity;
}

export function lineWeight(p: PricedProduct, line: CartLine) {
  if (line.isSwatch) return 20 * line.quantity;
  const w = p.weight_g_per_unit;
  return p.sale_mode === "metre" ? Math.ceil(w * (line.lengthM ?? 0) * line.quantity) : w * line.quantity;
}

export function discountAmount(d: Discount | null, subtotal: number) {
  if (!d || subtotal < d.min_subtotal_pence) return 0;
  if (d.kind === "percent") return roundPence((subtotal * Math.min(100, Math.max(0, d.value))) / 100);
  if (d.kind === "fixed") return Math.min(subtotal, d.value);
  return 0;
}

/** Rates whose weight band covers the parcel, cheapest first. */
export function matchingRates(rates: ShippingRate[], weightG: number) {
  return rates
    .filter((r) => weightG >= r.min_weight_g && (r.max_weight_g == null || weightG <= r.max_weight_g))
    .sort((a, b) => a.price_pence - b.price_pence);
}

export function shippingFor(opts: {
  rate: ShippingRate | null;
  cheapestRateId: string | null;
  fulfilment: "delivery" | "collection";
  subtotalAfterDiscount: number;
  freeThreshold: number | null;
  discount: Discount | null;
}) {
  const { rate, fulfilment } = opts;
  if (fulfilment === "collection" || !rate) return 0;
  const isCheapest = rate.id === opts.cheapestRateId;
  // Free shipping (threshold or code) covers the standard service; faster services still pay.
  if (isCheapest && opts.discount?.kind === "free_shipping") return 0;
  if (isCheapest && opts.freeThreshold != null && opts.subtotalAfterDiscount >= opts.freeThreshold) return 0;
  return rate.price_pence;
}

/** VAT inside a VAT-inclusive amount, at the rate in force for this order. */
export function vatIncluded(total: number, vatRatePct: number) {
  if (vatRatePct <= 0) return 0;
  return roundPence(total - total / (1 + vatRatePct / 100));
}

export type Quote = {
  lines: { line: CartLine; product: PricedProduct | undefined; error: LineError | null; total: number; unit: number }[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  vat: number;
  /** The VAT percentage this quote was priced at, so it can be snapshotted on the order. */
  vatRate: number;
  weightG: number;
  rates: ShippingRate[];
  selectedRate: ShippingRate | null;
  valid: boolean;
};

export function quote(input: {
  lines: CartLine[];
  products: PricedProduct[];
  rates: ShippingRate[];
  rateId?: string | null;
  fulfilment: "delivery" | "collection";
  discount: Discount | null;
  freeThreshold: number | null;
  /** Current admin-configured VAT rate (finance_settings.vat_rate), not hardcoded. */
  vatRatePct: number;
}): Quote {
  const byId = new Map(input.products.map((p) => [p.id, p]));

  // Aggregate stock usage per product (or per colour) so two lines can't jointly oversell.
  const usage = new Map<string, number>();
  const swatchCount = input.lines.filter((l) => l.isSwatch).length;

  const lines = input.lines.map((line) => {
    const product = byId.get(line.productId);
    let error = validateLine(product, line);
    if (!error && product) {
      const variant = lineVariant(product, line) ?? null;
      const key = variant?.id ?? product.id;
      const used = (usage.get(key) ?? 0) + stockUsage(product, line);
      usage.set(key, used);
      if (product.track_stock && used > stockFor(product, variant) + EPS) error = "out_of_stock";
    }
    if (!error && line.isSwatch && swatchCount > MAX_SWATCHES) error = "bad_quantity";
    const total = product && !error ? linePrice(product, line) : 0;
    const unit = product ? (line.isSwatch ? product.swatch_price_pence : unitPrice(product)) : 0;
    return { line, product, error, total, unit };
  });

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const weightG = lines.reduce((s, l) => s + (l.product && !l.error ? lineWeight(l.product, l.line) : 0), 0);
  const discount = discountAmount(input.discount, subtotal);
  const rates = matchingRates(input.rates, weightG);
  const selectedRate =
    input.fulfilment === "collection" ? null : (rates.find((r) => r.id === input.rateId) ?? rates[0] ?? null);
  const shipping = shippingFor({
    rate: selectedRate,
    cheapestRateId: rates[0]?.id ?? null,
    fulfilment: input.fulfilment,
    subtotalAfterDiscount: subtotal - discount,
    freeThreshold: input.freeThreshold,
    discount: input.discount,
  });
  const total = Math.max(0, subtotal - discount + shipping);

  return {
    lines,
    subtotal,
    discount,
    shipping,
    total,
    vat: vatIncluded(total, input.vatRatePct),
    vatRate: input.vatRatePct,
    weightG,
    rates,
    selectedRate,
    valid:
      lines.length > 0 &&
      lines.every((l) => !l.error) &&
      (input.fulfilment === "collection" || selectedRate != null),
  };
}

export const lineErrorMessage: Record<LineError, string> = {
  unavailable: "This item is no longer available.",
  below_min: "Below the minimum cut length.",
  above_max: "Above the maximum cut length.",
  bad_step: "Lengths are cut in set increments.",
  out_of_stock: "Not enough in stock for this length.",
  swatch_unavailable: "Swatches aren't available for this fabric.",
  bad_quantity: "Please check the quantity.",
  choose_colour: "Please choose a colour.",
};
