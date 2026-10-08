import { IconHeart } from "@/components/icons";
import { EmptyState, SectionHead } from "@/components/account/section";
import { WishlistRemove } from "@/components/account/wishlist-remove";
import { ProductCard, type ProductCardData } from "@/components/shop/product-card";
import { ButtonLink } from "@/components/ui/button";
import { requireViewer } from "@/lib/data/account";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const viewer = await requireViewer("/account/wishlist");
  const supabase = await createClient();

  const { data: saved } = await supabase
    .from("wishlist_items")
    .select("product_id, created_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false });
  const ids = (saved ?? []).map((s) => s.product_id);

  let products: ProductCardData[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("products_public")
      .select(
        "id, slug, name, subtitle, sale_mode, price_pence, compare_at_pence, in_stock, low_stock, colour_hex, rating_avg, rating_count, product_images(storage_path, alt, sort_order)",
      )
      .in("id", ids);
    const byId = new Map(((data ?? []) as unknown as ProductCardData[]).map((p) => [p.id, p]));
    products = ids.map((id) => byId.get(id)).filter((p): p is ProductCardData => Boolean(p));
  }
  const unavailable = ids.length - products.length;

  return (
    <section>
      <SectionHead title="Wishlist">
        {products.length ? "Cloths you've set aside. Prices shown are today's." : "Save cloths while you plan a project and come back to them here."}
      </SectionHead>
      {products.length ? (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
            {products.map((p) => (
              <li key={p.id} className="relative">
                <WishlistRemove productId={p.id} name={p.name} />
                <ProductCard p={p} sizes="(min-width: 1024px) 22vw, 45vw" />
              </li>
            ))}
          </ul>
          {unavailable > 0 && (
            <p className="mt-10 border-t border-stone-300 pt-5 text-sm text-ink-soft">
              {unavailable} saved {unavailable === 1 ? "cloth is" : "cloths are"} no longer available and {unavailable === 1 ? "has" : "have"} been hidden.
            </p>
          )}
        </>
      ) : (
        <EmptyState
          icon={<IconHeart className="size-8" strokeWidth={1.25} />}
          title="Nothing saved yet"
          action={<ButtonLink href="/shop/linings">Explore the collection</ButtonLink>}
        >
          Tap the heart on any cloth to keep it here for later.
        </EmptyState>
      )}
    </section>
  );
}
