import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/utils";

const STATIC = ["", "/shop", "/samples", "/about", "/contact", "/faq", "/journal", "/help/delivery", "/help/returns", "/legal/terms", "/legal/privacy", "/track"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createAdminClient();
  const [{ data: products }, { data: categories }, { data: posts }] = await Promise.all([
    db.from("products").select("slug, updated_at").eq("is_active", true),
    db.from("categories").select("slug").eq("is_visible", true),
    db.from("posts").select("slug, updated_at").eq("status", "published"),
  ]);
  return [
    ...STATIC.map((p) => ({ url: `${siteUrl}${p}` })),
    ...(categories ?? []).map((c) => ({ url: `${siteUrl}/shop/${c.slug}` })),
    ...(products ?? []).map((p) => ({ url: `${siteUrl}/product/${p.slug}`, lastModified: p.updated_at })),
    ...(posts ?? []).map((p) => ({ url: `${siteUrl}/journal/${p.slug}`, lastModified: p.updated_at })),
  ];
}
