import { staffDb } from "@/lib/actions/admin/guard";
import Link from "next/link";
import { OfferManager, type OfferProduct } from "@/components/admin/offer-manager";

export const metadata = { title: "Special offers" };

export default async function OffersPage() {
  const { db } = await staffDb();
  const { data } = await db
    .from("products")
    .select("id, name, colour, sale_mode, price_pence, compare_at_pence, is_active, product_images(storage_path, sort_order, variant_id)")
    .order("name");
  const products: OfferProduct[] = (data ?? []).map((p) => {
    // Shared photos lead; a colour's own photo stands in when there are none.
    const imgs = [...(p.product_images ?? [])].sort((a, b) => Number(a.variant_id != null) - Number(b.variant_id != null) || a.sort_order - b.sort_order);
    return {
      id: p.id,
      name: p.name,
      colour: p.colour,
      sale_mode: p.sale_mode,
      price_pence: p.price_pence,
      compare_at_pence: p.compare_at_pence,
      is_active: p.is_active,
      image: imgs[0]?.storage_path ?? null,
    };
  });
  return (
    <div>
      <p className="mb-5 max-w-2xl text-[0.95rem] text-ink-soft">
        Put a product on offer at a lower price. It shows under Special Offers on the shop with the old price crossed out, until you end the offer. This is
        the same as the &ldquo;Was price&rdquo; on a{" "}
        <Link href="/admin/products" className="text-aubergine-700 underline-offset-2 hover:underline">
          product
        </Link>
        , so a discount set in either place shows in both.
      </p>
      <OfferManager products={products} />
    </div>
  );
}
