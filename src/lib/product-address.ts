import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Product web addresses are the product code without the colour letters: /product/lin5. Anything else under
 * /product/ (an old address like thermal-lining or lin5oys, a colour's code like lin1ivo, capitals) is sent on to
 * the right one. Plain fetch-based client with no cookies, so the request proxy can use it as well as the page.
 */

/** "lin5", "fab12": already a product's own address, so no lookup is needed. */
export const isProductAddress = (slug: string) => /^[a-z]{3}\d+$/.test(slug);

/** Where `/product/<slug>` should go, e.g. "/product/lin1?colour=<id>", or null when it is nothing we know. */
export async function resolveProductAddress(raw: string): Promise<string | null> {
  let slug: string;
  try {
    slug = decodeURIComponent(raw).toLowerCase();
  } catch {
    return null;
  }
  if (isProductAddress(slug)) return slug === raw ? null : `/product/${slug}`; // only the capitals were wrong
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: old }, { data: colour }, { data: full }] = await Promise.all([
    db.from("product_slug_redirects").select("product_id").eq("old_slug", slug).maybeSingle(),
    db.from("product_variants").select("id, product_id").eq("code", slug.toUpperCase()).eq("is_active", true).maybeSingle(),
    // A single-colour product's full code, e.g. lin2cha for /product/lin2.
    db.from("products_public").select("id").eq("code", slug.toUpperCase()).maybeSingle(),
  ]);
  const productId = old?.product_id ?? colour?.product_id ?? full?.id;
  if (!productId) return null;
  const { data: product } = await db.from("products_public").select("slug").eq("id", productId).maybeSingle();
  if (!product) return null;
  return `/product/${product.slug}${colour && !old ? `?colour=${colour.id}` : ""}`;
}
