import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient, createClient, createPublicClient } from "@/lib/supabase/server";
import type { ProductCardData } from "@/components/shop/product-card";
import { resolveProductAddress } from "@/lib/product-address";

/** How long the public catalog/content reads below may go stale before refetching. */
const REVALIDATE_SECONDS = 300;

export type Category = { id: string; slug: string; name: string; description: string | null };

/** A colour as the shop sees it: whether it can be bought, never the raw stock figure. */
export type PublicVariant = { id: string; name: string; colour_hex: string | null; in_stock: boolean; low_stock: boolean; code?: string | null };

type VariantRow = { id: string; name: string; colour_hex: string | null; stock_qty: number; sort_order: number };

const VARIANT_COLUMNS = "product_variants(id, name, colour_hex, stock_qty, sort_order)";

/**
 * True when a read failed only because this database predates the colours migration
 * (no product_variants table, no product_images.variant_id). The shop then reads the
 * older columns and shows every product as single-colour instead of erroring.
 */
const coloursMissing = (e: { code?: string } | null) => Boolean(e && ["42703", "42P01", "PGRST200", "PGRST204"].includes(e.code ?? ""));

/** Variants in shop order with stock reduced to in/low flags, using the product's tracking and threshold. */
function publicVariants(rows: VariantRow[] | null | undefined, p: { track_stock?: boolean; low_stock_threshold?: number | null }): PublicVariant[] {
  const track = p.track_stock ?? true;
  const low = Number(p.low_stock_threshold ?? 0);
  return [...(rows ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => {
      const qty = Number(v.stock_qty);
      return { id: v.id, name: v.name, colour_hex: v.colour_hex, in_stock: !track || qty > 0, low_stock: track && qty > 0 && qty <= low };
    });
}

export type ProductDetail = ProductCardData & {
  /** e.g. LIN3; each colour has its own (see variants) */
  code?: string | null;
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
  variants: PublicVariant[];
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
  "id, slug, name, subtitle, category_id, sale_mode, price_pence, compare_at_pence, in_stock, low_stock, colour, colour_hex, composition, width_cm, swatch_enabled, swatch_price_pence, is_featured, sort_order, created_at, rating_avg, rating_count, product_images(storage_path, alt, sort_order, variant_id)";
/** LIST_COLUMNS for a database without the colours migration. */
const LIST_COLUMNS_LEGACY =
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

/**
 * These public catalog/content reads never see a signed-in viewer or per-viewer data
 * (reviews, wishlist state), so they're safe to cache across requests.
 * They use createPublicClient() (no cookies()/headers()) because unstable_cache forbids
 * Request-time APIs inside its scope, and are tagged so admin edits (see revalidateTag
 * calls next to revalidatePath in the admin actions) can invalidate them immediately.
 */

export const getCategories = cache(
  unstable_cache(
    async (): Promise<Category[]> => {
      const supabase = createPublicClient();
      const { data } = await supabase
        .from("categories")
        .select("id, slug, name, description")
        .is("parent_id", null)
        .order("sort_order");
      return data ?? [];
    },
    ["categories"],
    { tags: ["categories"], revalidate: REVALIDATE_SECONDS },
  ),
);

export const getListProducts = cache(
  unstable_cache(
    async (): Promise<ListProduct[]> => {
      const supabase = createPublicClient();
      const [list, colourRows, codeRows] = await Promise.all([
        supabase.from("products_public").select(LIST_COLUMNS).order("sort_order"),
        supabase.from("products").select(`id, track_stock, low_stock_threshold, ${VARIANT_COLUMNS}`).eq("is_active", true),
        // Separate, so the shop still lists everything on a database without product codes yet.
        supabase.from("products_public").select("id, code, code_base"),
      ]);
      const codes = new Map((codeRows.data ?? []).map((c) => [c.id as string, c as { code: string | null; code_base: string | null }]));
      let { data, error } = list;
      let colours = colourRows.data;
      const coloursError = colourRows.error;
      if (coloursMissing(error)) {
        const legacy = await supabase.from("products_public").select(LIST_COLUMNS_LEGACY).order("sort_order");
        ({ data, error } = { data: legacy.data as unknown as typeof data, error: legacy.error });
      }
      if (error) throw error;
      if (coloursMissing(coloursError)) colours = [];
      else if (coloursError) throw coloursError;
      const byId = new Map(
        (colours ?? []).map((c) => [c.id as string, publicVariants(c.product_variants as VariantRow[], c)]),
      );
      return ((data ?? []) as unknown as ListProduct[]).map((p) => {
        const variants = byId.get(p.id) ?? [];
        const c = codes.get(p.id);
        // Sold in colours: the product's own code (LIN1); otherwise the full one (LIN2CHA).
        return { ...p, variants, code: (variants.length > 1 ? c?.code_base : c?.code) ?? null };
      });
    },
    ["list-products"],
    { tags: ["products"], revalidate: REVALIDATE_SECONDS },
  ),
);

const num = (v: unknown) => (v == null ? null : Number(v));

export const getProduct = cache(async (raw: string): Promise<ProductDetail | null> => {
  // Addresses are product codes, which people may type in capitals: /product/LIN3RED.
  const slug = decodeURIComponent(raw).toLowerCase();
  return unstable_cache(
    async (): Promise<ProductDetail | null> => {
      const supabase = createPublicClient();
      let { data, error } = await supabase
        .from("products_public")
        .select("*, product_images(storage_path, alt, sort_order, variant_id)")
        .eq("slug", slug)
        .maybeSingle();
      if (coloursMissing(error)) {
        const legacy = await supabase.from("products_public").select("*, product_images(storage_path, alt, sort_order)").eq("slug", slug).maybeSingle();
        ({ data, error } = { data: legacy.data as typeof data, error: legacy.error });
      }
      if (error) throw error;
      if (!data) return null;
      const [{ data: stock }, { data: codes }] = await Promise.all([
        supabase.from("products").select(`track_stock, low_stock_threshold, ${VARIANT_COLUMNS}`).eq("id", data.id).maybeSingle(),
        // Separate, so a database without colour codes yet still shows its colours.
        supabase.from("product_variants").select("id, code").eq("product_id", data.id),
      ]);
      const codeOf = new Map((codes ?? []).map((c) => [c.id as string, c.code as string | null]));
      return {
        ...data,
        min_length_m: num(data.min_length_m),
        length_step_m: num(data.length_step_m),
        max_length_m: num(data.max_length_m),
        roll_length_m: num(data.roll_length_m),
        rating_avg: Number(data.rating_avg ?? 0),
        tags: data.tags ?? [],
        variants: stock ? publicVariants(stock.product_variants as VariantRow[], stock).map((v) => ({ ...v, code: codeOf.get(v.id) ?? null })) : [],
      } as ProductDetail;
    },
    ["product", slug],
    { tags: ["products", `product:${slug}`], revalidate: REVALIDATE_SECONDS },
  )();
});

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

export const getPublishedPosts = unstable_cache(
  async (): Promise<Post[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("posts")
      .select("id, slug, title, excerpt, cover_path, body_html, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false });
    return data ?? [];
  },
  ["published-posts"],
  { tags: ["posts"], revalidate: REVALIDATE_SECONDS },
);

export const getPost = cache(async (slug: string): Promise<Post | null> => {
  return unstable_cache(
    async (): Promise<Post | null> => {
      const supabase = createPublicClient();
      const { data } = await supabase
        .from("posts")
        .select("id, slug, title, excerpt, cover_path, body_html, published_at")
        .eq("status", "published")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
    ["post", slug],
    { tags: ["posts", `post:${slug}`], revalidate: REVALIDATE_SECONDS },
  )();
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
    for (const { hex, name } of productColours(p)) {
      const e = colours.get(hex) ?? { hex, name, count: 0 };
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

/** Every colour a product comes in: its colour range, or its single colour. */
function productColours(p: ListProduct) {
  const list = p.variants?.length
    ? p.variants.filter((v) => v.colour_hex).map((v) => ({ hex: v.colour_hex!.toLowerCase(), name: v.name }))
    : p.colour_hex
      ? [{ hex: p.colour_hex.toLowerCase(), name: p.colour ?? p.colour_hex }]
      : [];
  return [...new Map(list.map((c) => [c.hex, c])).values()];
}

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

export function applyFilters(products: ListProduct[], f: ShopFilters) {
  const out = products.filter(
    (p) =>
      (!f.colour.length || productColours(p).some((c) => f.colour.includes(c.hex))) &&
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

/** Where an address that isn't a live product should go (see resolveProductAddress). */
export const findProductAddress = cache((raw: string) => resolveProductAddress(raw));

export type SearchHit = { key: string; href: string; name: string; colour: string | null; code: string | null; price_pence: number; sale_mode: "metre" | "roll" | "unit"; image: string | null };

/**
 * The header search: products found by name or by code (LIN3, LIN3RED). A code that belongs to one colour
 * opens the product on that colour. Exact code matches come first.
 */
export async function searchShop(q: string, limit = 8): Promise<SearchHit[]> {
  const term = q.trim().replace(/[%,()\\*]/g, " ").trim().slice(0, 80);
  if (!term) return [];
  const supabase = createPublicClient();
  let cols = "id, slug, name, code, colour, price_pence, sale_mode, product_images(storage_path, sort_order, variant_id)";
  let [{ data: products, error }, { data: colours }] = await Promise.all([
    supabase.from("products_public").select(cols).or(`name.ilike.%${term}%,code.ilike.${term}%,code_base.ilike.${term}%`).order("sort_order").limit(limit),
    supabase.from("product_variants").select("id, name, code, product_id").ilike("code", `${term}%`).eq("is_active", true).limit(limit),
  ]);
  // A database without product codes yet: search by name only.
  if (coloursMissing(error)) {
    cols = "id, slug, name, colour, price_pence, sale_mode, product_images(storage_path, sort_order, variant_id)";
    ({ data: products, error } = await supabase.from("products_public").select(cols).ilike("name", `%${term}%`).order("sort_order").limit(limit));
    colours = [];
  }
  type Row = { id: string; slug: string; name: string; code: string | null; colour: string | null; price_pence: number; sale_mode: SearchHit["sale_mode"]; product_images: { storage_path: string; sort_order: number; variant_id?: string | null }[] | null };
  const byId = new Map(((products ?? []) as unknown as Row[]).map((p) => [p.id, p]));
  const missing = [...new Set((colours ?? []).map((c) => c.product_id as string))].filter((id) => !byId.has(id));
  if (missing.length) {
    const { data } = await supabase.from("products_public").select(cols).in("id", missing);
    for (const p of (data ?? []) as unknown as Row[]) byId.set(p.id, p);
  }
  const photo = (p: Row, variantId: string | null) => {
    const imgs = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return (imgs.find((i) => variantId && i.variant_id === variantId) ?? imgs.find((i) => !i.variant_id) ?? imgs[0])?.storage_path ?? null;
  };
  const upper = term.toUpperCase();
  const hits: (SearchHit & { rank: number })[] = [];
  for (const c of colours ?? []) {
    const p = byId.get(c.product_id as string);
    if (!p) continue; // hidden product
    const code = c.code as string;
    hits.push({ key: c.id as string, href: `/product/${p.slug}?colour=${c.id}`, name: p.name, colour: c.name as string, code, price_pence: p.price_pence, sale_mode: p.sale_mode, image: photo(p, c.id as string), rank: code === upper ? 0 : 1 });
  }
  const colourProducts = new Set((colours ?? []).map((c) => c.product_id as string));
  for (const p of byId.values()) {
    // Found only through one of its colours: that colour is already listed.
    if (colourProducts.has(p.id) && !p.name.toUpperCase().includes(upper) && !(p.code ?? "").toUpperCase().startsWith(upper)) continue;
    const code = p.code ?? null;
    hits.push({ key: p.id, href: `/product/${p.slug}`, name: p.name, colour: p.colour, code, price_pence: p.price_pence, sale_mode: p.sale_mode, image: photo(p, null), rank: code?.toUpperCase() === upper ? 0 : code?.toUpperCase().startsWith(upper) ? 1 : 2 });
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((h) => ({ key: h.key, href: h.href, name: h.name, colour: h.colour, code: h.code, price_pence: h.price_pence, sale_mode: h.sale_mode, image: h.image }));
}
