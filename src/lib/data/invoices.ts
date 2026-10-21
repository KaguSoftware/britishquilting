import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCid, type ManualCustomer, type ProductPick } from "@/lib/invoices";
import type { DeliveryNoteOption } from "@/lib/delivery-notes";

export const CUSTOMER_COLS = "id, number, full_name, company, email, phone, line1, line2, city, county, postcode, note";
export const NOTE_OPTION_COLS = "id, number, customer_id, deliver_to, po_number, issued_on";

/** Whatever matches, best first; used by the customer search on the invoice and delivery note pads. */
export async function findManualCustomers(db: SupabaseClient, q: string, limit = 20) {
  const term = q.trim().replace(/[%,()\\]/g, " ").trim();
  let query = db.from("manual_customers").select(CUSTOMER_COLS).order("full_name").limit(limit);
  // "CID-1001" or "1001" finds that customer by number.
  const n = parseCid(term);
  if (term) query = query.or(`full_name.ilike.%${term}%,company.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%${n != null ? `,number.eq.${n}` : ""}`);
  return ((await query).data ?? []) as ManualCustomer[];
}

export async function deliveryNotesFor(db: SupabaseClient, customerId: string | null) {
  if (!customerId) return [];
  const { data } = await db.from("delivery_notes").select(NOTE_OPTION_COLS).eq("customer_id", customerId).order("number", { ascending: false }).limit(200);
  return (data ?? []) as DeliveryNoteOption[];
}

/**
 * Everything an invoice or delivery note editor needs besides the document itself: only the customer it is
 * for (others are searched as you type), that customer's delivery notes and the VAT rate.
 */
export async function editorData(db: SupabaseClient, customerId: string | null | undefined) {
  const id = customerId && /^[0-9a-f-]{36}$/i.test(customerId) ? customerId : null;
  const [{ data: customer }, deliveryNotes, { data: settings }] = await Promise.all([
    id ? db.from("manual_customers").select(CUSTOMER_COLS).eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    deliveryNotesFor(db, id),
    db.from("finance_settings").select("vat_rate").maybeSingle(),
  ]);
  return {
    customer: (customer ?? null) as ManualCustomer | null,
    deliveryNotes: customer ? deliveryNotes : [],
    vatRate: Number(settings?.vat_rate ?? 20),
  };
}

type ProductHit = {
  id: string;
  name: string;
  code: string | null;
  code_base: string | null;
  colour: string | null;
  price_pence: number;
  sale_mode: "metre" | "roll" | "unit";
  is_active: boolean;
  product_variants: { id: string; name: string; code: string | null; is_active: boolean; sort_order: number }[];
};

const PRODUCT_HIT_COLS = "id, name, code, code_base, colour, price_pence, sale_mode, is_active, product_variants(id, name, code, is_active, sort_order)";
const PER = { metre: "per metre", roll: "per roll", unit: "each" } as const;

/**
 * Products for an invoice line, found by code (LIN3, LIN3RED) or by name. A product sold in colours comes back
 * once per colour, each with its own code. Exact code matches come first.
 */
export async function findProducts(db: SupabaseClient, q: string, limit = 20): Promise<ProductPick[]> {
  const term = q.trim().replace(/[%,()\\*]/g, " ").trim();
  const byName = db.from("products").select(PRODUCT_HIT_COLS).order("name").limit(limit);
  const [{ data: products }, { data: variants }] = await Promise.all([
    term ? byName.or(`code.ilike.${term}%,code_base.ilike.${term}%,name.ilike.%${term}%`) : byName.eq("is_active", true),
    term
      ? db.from("product_variants").select(`product:products(${PRODUCT_HIT_COLS})`).ilike("code", `${term}%`).limit(limit)
      : Promise.resolve({ data: [] }),
  ]);

  const all = new Map<string, ProductHit>();
  for (const p of (products ?? []) as unknown as ProductHit[]) all.set(p.id, p);
  for (const v of (variants ?? []) as unknown as { product: ProductHit | ProductHit[] | null }[]) {
    const p = Array.isArray(v.product) ? v.product[0] : v.product;
    if (p) all.set(p.id, p);
  }

  const upper = term.toUpperCase();
  const picks: (ProductPick & { rank: number })[] = [];
  for (const p of all.values()) {
    const base = { unit_price_pence: p.price_pence, per: PER[p.sale_mode] ?? "each" };
    const colours = [...(p.product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const nameHit = !!term && p.name.toUpperCase().includes(upper);
    if (colours.length) {
      for (const v of colours) {
        const code = v.code ?? p.code_base ?? "";
        // Searching a code narrows to the colours it fits; searching a name lists every colour.
        if (term && !nameHit && !code.toUpperCase().startsWith(upper) && !v.name.toUpperCase().includes(upper)) continue;
        picks.push({ ...base, key: v.id, code, description: `${p.name}, ${v.name}`, hidden: !p.is_active || !v.is_active, rank: rank(code, upper) });
      }
    } else {
      const code = p.code ?? "";
      picks.push({ ...base, key: p.id, code, description: p.colour ? `${p.name}, ${p.colour}` : p.name, hidden: !p.is_active, rank: rank(code, upper) });
    }
  }
  return picks
    .sort((a, b) => a.rank - b.rank || a.description.localeCompare(b.description))
    .slice(0, limit)
    .map((p) => ({ key: p.key, code: p.code, description: p.description, unit_price_pence: p.unit_price_pence, per: p.per, hidden: p.hidden }));
}

function rank(code: string, term: string) {
  if (!term) return 2;
  const c = code.toUpperCase();
  return c === term ? 0 : c.startsWith(term) ? 1 : 2;
}

/** Today's price for each product or colour code, e.g. { LIN3RED: 495 }. Codes that aren't products are left out. */
export async function productPrices(db: SupabaseClient, codes: string[]) {
  const price = new Map<string, number>();
  if (!codes.length) return price;
  const [{ data: products }, { data: colours }] = await Promise.all([
    db.from("products").select("code, price_pence").in("code", codes),
    db.from("product_variants").select("code, products(price_pence)").in("code", codes),
  ]);
  for (const p of products ?? []) if (p.code) price.set(p.code, p.price_pence);
  for (const v of (colours ?? []) as unknown as { code: string; products: { price_pence: number } | { price_pence: number }[] | null }[]) {
    const p = Array.isArray(v.products) ? v.products[0] : v.products;
    if (p) price.set(v.code, p.price_pence);
  }
  return price;
}
