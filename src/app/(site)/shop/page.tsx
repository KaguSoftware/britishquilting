import type { Metadata } from "next";
import { ShopListing } from "@/components/shop/shop-listing";
import { getCategories, getListProducts } from "@/lib/data/shop";

export const metadata: Metadata = {
  title: "Shop all fabrics",
  description: "Curtain linings, interlinings and workroom paper, cut to your length in London and delivered across the UK.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const [sp, categories, products] = await Promise.all([searchParams, getCategories(), getListProducts()]);
  return <ShopListing category={null} categories={categories} products={products} searchParams={sp} />;
}
