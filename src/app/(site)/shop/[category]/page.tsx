import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_COPY, ShopListing } from "@/components/shop/shop-listing";
import { getCategories, getListProducts } from "@/lib/data/shop";

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  const cat = (await getCategories()).find((c) => c.slug === category);
  if (!cat) return { title: "Not found" };
  return {
    title: `${cat.name}, cut to order`,
    description: cat.description ?? CATEGORY_COPY[cat.slug]?.lede,
    alternates: { canonical: `/shop/${cat.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/shop/[category]">) {
  const [{ category }, sp, categories, all] = await Promise.all([params, searchParams, getCategories(), getListProducts()]);
  const cat = categories.find((c) => c.slug === category);
  if (!cat) notFound();
  return <ShopListing category={cat} categories={categories} products={all.filter((p) => p.category_id === cat.id)} searchParams={sp} />;
}
