import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Discount, PricedProduct, ShippingRate } from "@/lib/pricing";

export type Viewer = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "customer" | "trade" | "staff" | "owner";
  isStaff: boolean;
};

/** The signed-in user (verified with Supabase Auth), or null. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("id", data.user.id)
    .maybeSingle();
  const role = (profile?.role ?? "customer") as Viewer["role"];
  return {
    id: data.user.id,
    email: data.user.email ?? profile?.email ?? null,
    fullName: profile?.full_name ?? (data.user.user_metadata?.full_name as string | undefined) ?? null,
    role,
    isStaff: role === "staff" || role === "owner",
  };
}

const PRICED_COLUMNS =
  "id, name, sale_mode, price_pence, min_length_m, length_step_m, max_length_m, weight_g_per_unit, swatch_enabled, swatch_price_pence, stock_qty, track_stock, is_active, product_variants(id, name, stock_qty, is_active, sort_order)";

/** Fresh pricing rows for the given products. Service role: never sent raw to the client. */
export async function getPricedProducts(ids: string[]): Promise<PricedProduct[]> {
  if (ids.length === 0) return [];
  const db = createAdminClient();
  let { data, error } = await db.from("products").select(PRICED_COLUMNS).in("id", ids).eq("is_active", true);
  // A database without the colours migration: price every product as single-colour.
  if (error && ["42703", "42P01", "PGRST200"].includes(error.code ?? "")) {
    const legacy = await db
      .from("products")
      .select("id, name, sale_mode, price_pence, min_length_m, length_step_m, max_length_m, weight_g_per_unit, swatch_enabled, swatch_price_pence, stock_qty, track_stock, is_active")
      .in("id", ids)
      .eq("is_active", true);
    ({ data, error } = { data: (legacy.data ?? []).map((p) => ({ ...p, product_variants: [] })) as typeof data, error: legacy.error });
  }
  if (error) throw error;
  return (data ?? []).map(({ product_variants, ...p }) => ({
    ...p,
    variants: ((product_variants ?? []) as { id: string; name: string; stock_qty: number; is_active: boolean; sort_order: number }[])
      .filter((v) => v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, name: v.name, stock_qty: Number(v.stock_qty) })),
    min_length_m: p.min_length_m == null ? null : Number(p.min_length_m),
    length_step_m: p.length_step_m == null ? null : Number(p.length_step_m),
    max_length_m: p.max_length_m == null ? null : Number(p.max_length_m),
    stock_qty: Number(p.stock_qty),
  })) as PricedProduct[];
}

export async function getShippingRates(): Promise<ShippingRate[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("shipping_rates")
    .select("id, name, carrier, min_weight_g, max_weight_g, price_pence, estimated_days")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

/** The admin-configured VAT rate, live at the moment of quoting. Defaults to 20 if the settings row is missing. */
export async function getVatRate(): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db.from("finance_settings").select("vat_rate").maybeSingle();
  if (error) throw error;
  return data ? Number(data.vat_rate) : 20;
}

export async function getStoreSettings() {
  const db = createAdminClient();
  const { data } = await db.from("store_settings").select("*").eq("id", 1).single();
  return data as {
    free_shipping_threshold_pence: number | null;
    collection_address: string | null;
    collection_hours: string | null;
    collection_enabled: boolean;
    invoice_terms_days: number;
    bank_details: string | null;
    low_stock_email: string | null;
    announcement: string | null;
  };
}

/** Look up a discount code and check it's currently usable. */
export async function findDiscount(code: string | null | undefined, email?: string | null): Promise<{ discount: Discount | null; error?: string }> {
  if (!code?.trim()) return { discount: null };
  const db = createAdminClient();
  const { data: d } = await db.from("discount_codes").select("*").eq("code", code.trim()).maybeSingle();
  const now = Date.now();
  if (!d || !d.is_active) return { discount: null, error: "That code isn't valid." };
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return { discount: null, error: "That code isn't active yet." };
  if (d.ends_at && new Date(d.ends_at).getTime() < now) return { discount: null, error: "That code has expired." };
  if (d.max_uses != null && d.uses >= d.max_uses) return { discount: null, error: "That code has been fully redeemed." };
  if (d.once_per_customer && email) {
    const { count } = await db.from("discount_redemptions").select("id", { count: "exact", head: true }).eq("discount_id", d.id).eq("email", email);
    if ((count ?? 0) > 0) return { discount: null, error: "You've already used this code." };
  }
  return { discount: { code: d.code, kind: d.kind, value: d.value, min_subtotal_pence: d.min_subtotal_pence } };
}
