import "server-only";
import { cache } from "react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ProductCardData } from "@/components/shop/product-card";

export type Category = { id: string; slug: string; name: string; description: string | null };

export type ProductDetail = ProductCardData & {
  description: string | null;
  category_id: string | null;
  min_length_m: number | null;
  length_step_m: number | null;
  max_length_m: number | null;
  roll_length_m: number | null;
  swatch_enabled: boolean;
  swatch_price_pence: number;
  colour: string | null;
  composition: string | null;
  width_cm: number | null;
  weight_gsm: number | null;
  care: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  is_featured: boolean;
  sort_order: number;
};

export type Review = {
  id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean;
  created_at: string;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_path: string | null;
  body_html: string;
  published_at: string | null;
};

const LIST_COLUMNS =
  "id, slug, name, subtitle, category_id, sale_mode, price_pence, compare_at_pence, in_stock, low_stock, colour, colour_hex, composition, width_cm, swatch_enabled, swatch_price_pence, is_featured, sort_order, created_at, rating_avg, rating_count, product_images(storage_path, alt, sort_order)";

export type ListProduct = ProductCardData & {
  category_id: string | null;
  colour: string | null;
  composition: string | null;
  width_cm: number | null;
  swatch_enabled: boolean;
  swatch_price_pence: number;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
};

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, slug, name, description")
    .is("parent_id", null)
    .order("sort_order");
  return data ?? [];
});

export const getListProducts = cache(async (): Promise<ListProduct[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products_public").select(LIST_COLUMNS).order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as ListProduct[];
});

const num = (v: unknown) => (v == null ? null : Number(v));

export const getProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products_public")
    .select("*, product_images(storage_path, alt, sort_order)")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    min_length_m: num(data.min_length_m),
    length_step_m: num(data.length_step_m),
    max_length_m: num(data.max_length_m),
    roll_length_m: num(data.roll_length_m),
    rating_avg: Number(data.rating_avg ?? 0),
    tags: data.tags ?? [],
  } as ProductDetail;
});

/** Trade price for an approved trade viewer only. Service role, server-side. */
export async function getTradePrice(productId: string) {
  const db = createAdminClient();
  const { data } = await db.from("products").select("trade_price_pence").eq("id", productId).maybeSingle();
  return (data?.trade_price_pence as number | null) ?? null;
}

export async function getReviews(productId: string): Promise<Review[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, author_name, rating, title, body, verified_purchase, created_at")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getOwnReview(productId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, status")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();
  return data as { id: string; status: "pending" | "approved" | "rejected" } | null;
}

export async function getPublishedPosts(): Promise<Post[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, slug, title, excerpt, cover_path, body_html, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });
  return data ?? [];
}

export const getPost = cache(async (slug: string): Promise<Post | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, slug, title, excerpt, cover_path, body_html, published_at")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

/* ───────────────────────── listing filters */

export type ShopFilters = {
  colour: string[];
  composition: string[];
  width: string[];
  inStock: boolean;
  sort: "featured" | "price-asc" | "price-desc" | "newest";
};

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? v.split(",") : []).map((s) => s.trim()).filter(Boolean);

export function parseFilters(sp: Record<string, string | string[] | undefined>): ShopFilters {
  const sort = typeof sp.sort === "string" ? sp.sort : "featured";
  return {
    colour: list(sp.colour).map((c) => c.toLowerCase()),
    composition: list(sp.composition),
    width: list(sp.width),
    inStock: sp.stock === "1",
    sort: (["featured", "price-asc", "price-desc", "newest"] as const).includes(sort as ShopFilters["sort"])
      ? (sort as ShopFilters["sort"])
      : "featured",
  };
}

export type Facets = {
  colours: { hex: string; name: string; count: number }[];
  compositions: { value: string; count: number }[];
  widths: { value: string; count: number }[];
};

export function buildFacets(products: ListProduct[]): Facets {
  const colours = new Map<string, { hex: string; name: string; count: number }>();
  const comps = new Map<string, number>();
  const widths = new Map<string, number>();
  for (const p of products) {
    if (p.colour_hex) {
      const hex = p.colour_hex.toLowerCase();
      const e = colours.get(hex) ?? { hex, name: p.colour ?? p.colour_hex, count: 0 };
      e.count++;
      colours.set(hex, e);
    }
    if (p.composition) comps.set(p.composition, (comps.get(p.composition) ?? 0) + 1);
    if (p.width_cm) widths.set(String(p.width_cm), (widths.get(String(p.width_cm)) ?? 0) + 1);
  }
  return {
    colours: [...colours.values()].sort((a, b) => luminance(b.hex) - luminance(a.hex)),
    compositions: [...comps].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value)),
    widths: [...widths].map(([value, count]) => ({ value, count })).sort((a, b) => Number(a.value) - Number(b.value)),
  };
}

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

export function applyFilters(products: ListProduct[], f: ShopFilters) {
  const out = products.filter(
    (p) =>
      (!f.colour.length || (p.colour_hex && f.colour.includes(p.colour_hex.toLowerCase()))) &&
      (!f.composition.length || (p.composition && f.composition.includes(p.composition))) &&
      (!f.width.length || (p.width_cm && f.width.includes(String(p.width_cm)))) &&
      (!f.inStock || p.in_stock),
  );
  const by = {
    featured: (a: ListProduct, b: ListProduct) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order,
    "price-asc": (a: ListProduct, b: ListProduct) => a.price_pence - b.price_pence,
    "price-desc": (a: ListProduct, b: ListProduct) => b.price_pence - a.price_pence,
    newest: (a: ListProduct, b: ListProduct) => b.created_at.localeCompare(a.created_at),
  }[f.sort];
  return out.sort(by);
}

export async function isWishlisted(productId: string, userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("wishlist_items")
    .select("product_id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
