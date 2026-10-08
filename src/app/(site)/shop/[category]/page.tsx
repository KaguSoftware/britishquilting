import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_COPY, ShopListing } from "@/components/shop/shop-listing";
import { getCategories, getListProducts, type Category } from "@/lib/data/shop";
import { sectionFor } from "@/lib/shop-sections";

/** A real category, or a nav section that has no category row yet. Null when neither exists. */
async function resolve(slug: string): Promise<Category | null> {
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (cat) return cat;
  const section = sectionFor(slug);
  return section ? { id: `section:${section.slug}`, slug: section.slug, name: section.name, description: section.description } : null;
}

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  const cat = await resolve(category);
  if (!cat) return { title: "Not found" };
  return {
    title: sectionFor(cat.slug)?.kind === "offers" ? cat.name : `${cat.name}, cut to order`,
    description: cat.description ?? CATEGORY_COPY[cat.slug]?.lede,
    alternates: { canonical: `/shop/${cat.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/shop/[category]">) {
  const [{ category }, sp, categories, all] = await Promise.all([params, searchParams, getCategories(), getListProducts()]);
  const cat = await resolve(category);
  if (!cat) notFound();
  const section = sectionFor(cat.slug);
  const products =
    section?.kind === "offers"
      ? all.filter((p) => p.compare_at_pence != null && p.compare_at_pence > p.price_pence)
      : all.filter((p) => p.category_id === cat.id);
  return <ShopListing category={cat} categories={categories} products={products} searchParams={sp} />;
}
