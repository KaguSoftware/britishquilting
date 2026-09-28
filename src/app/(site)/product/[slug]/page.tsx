import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {IconArrowRight, IconCheck, IconSwatch, IconScissors, IconVan} from "@/components/icons";
import { Reveal } from "@/components/site/reveal";
import { ProductCard } from "@/components/shop/product-card";
import { ProductGallery } from "@/components/shop/product-gallery";
import { PurchasePanel } from "@/components/shop/purchase-panel";
import { ReviewForm } from "@/components/shop/review-form";
import { WishlistToggle } from "@/components/shop/wishlist-toggle";
import { Accordion, Breadcrumbs, Stars } from "@/components/shop/bits";
import { getViewer } from "@/lib/data/catalog";
import { getCategories, getListProducts, getOwnReview, getProduct, getReviews, getTradePrice, isWishlisted } from "@/lib/data/shop";
import { formatMetres, siteUrl, storageUrl } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Fabric not found" };
  const img = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
  const description = p.seo_description ?? p.subtitle ?? p.description?.slice(0, 160) ?? undefined;
  return {
    title: p.seo_title ?? p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, description, images: img ? [storageUrl(img.storage_path)!] : undefined },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const [viewer, reviews, categories, all] = await Promise.all([getViewer().catch(() => null), getReviews(p.id), getCategories(), getListProducts()]);
  const [tradePrice, ownReview, saved] = await Promise.all([
    viewer?.isTrade ? getTradePrice(p.id) : Promise.resolve(null),
    viewer ? getOwnReview(p.id, viewer.id) : Promise.resolve(null),
    viewer ? isWishlisted(p.id, viewer.id) : Promise.resolve(null),
  ]);
  const category = categories.find((c) => c.id === p.category_id) ?? null;
  const images = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const related = all
    .filter((x) => x.id !== p.id)
    .sort((a, b) => Number(b.category_id === p.category_id) - Number(a.category_id === p.category_id) || a.sort_order - b.sort_order)
    .slice(0, 4);
  const isMetre = p.sale_mode === "metre";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description ?? p.subtitle ?? undefined,
    sku: p.slug,
    url: `${siteUrl}/product/${p.slug}`,
    image: images.map((i) => storageUrl(i.storage_path)),
    brand: { "@type": "Brand", name: "British Quilting" },
    color: p.colour ?? undefined,
    material: p.composition ?? undefined,
    category: category?.name,
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: (p.price_pence / 100).toFixed(2),
      availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteUrl}/product/${p.slug}`,
      seller: { "@type": "Organization", name: "British Quilting" },
      ...(isMetre ? { priceSpecification: { "@type": "UnitPriceSpecification", price: (p.price_pence / 100).toFixed(2), priceCurrency: "GBP", unitCode: "MTR" } } : {}),
    },
    ...(p.rating_count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(p.rating_avg).toFixed(1), reviewCount: p.rating_count } } : {}),
    ...(reviews.length
      ? {
          review: reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author_name },
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            name: r.title ?? undefined,
            reviewBody: r.body ?? undefined,
            datePublished: r.created_at.slice(0, 10),
          })),
        }
      : {}),
  };

  const specs: [string, string | null][] = [
    ["Composition", p.composition],
    ["Width", p.width_cm ? `${p.width_cm}cm` : null],
    ["Weight", p.weight_gsm ? `${p.weight_gsm} gsm` : null],
    ["Colour", p.colour],
    ["Sold", isMetre ? `By the metre, from ${formatMetres(p.min_length_m ?? 0.5)}` : p.sale_mode === "roll" ? `Full roll${p.roll_length_m ? ` of ${formatMetres(p.roll_length_m)}` : ""}` : "Each"],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="mx-auto max-w-7xl px-4 pt-24 md:px-8 md:pt-32">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/shop", label: "Shop" },
            ...(category ? [{ href: `/shop/${category.slug}`, label: category.name }] : []),
            { label: p.name },
          ]}
        />
      </div>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-8 md:grid-cols-[1.1fr_1fr] md:gap-14 md:px-8 lg:gap-20">
        <ProductGallery images={images} hex={p.colour_hex} name={p.name} label={[p.colour, p.composition, p.width_cm ? `${p.width_cm}cm wide` : null].filter(Boolean).join(" / ") || null} />

        <div>
          <Reveal>
            {category && <p className="eyebrow text-gold-600">{category.name}</p>}
            <h1 className="font-display mt-3 text-5xl leading-[1.02] text-balance md:text-6xl">{p.name}</h1>
            {p.subtitle && <p className="mt-3 text-lg text-ink-soft">{p.subtitle}</p>}
            {p.rating_count > 0 && (
              <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-aubergine-700">
                <Stars value={Number(p.rating_avg)} /> {Number(p.rating_avg).toFixed(1)} ({p.rating_count} review{p.rating_count === 1 ? "" : "s"})
              </a>
            )}
          </Reveal>

          <div className="stitch my-8" />

          <PurchasePanel
            p={{
              id: p.id,
              slug: p.slug,
              name: p.name,
              subtitle: p.subtitle,
              saleMode: p.sale_mode,
              pricePence: p.price_pence,
              comparePence: p.compare_at_pence,
              tradePricePence: tradePrice,
              minLength: p.min_length_m ?? 0.5,
              step: p.length_step_m ?? 0.5,
              maxLength: p.max_length_m,
              rollLength: p.roll_length_m,
              inStock: p.in_stock,
              lowStock: p.low_stock,
              swatchEnabled: p.swatch_enabled,
              swatchPricePence: p.swatch_price_pence,
              image: images[0]?.storage_path ? storageUrl(images[0].storage_path) : null,
            }}
          />

          <div className="mt-4">
            <WishlistToggle productId={p.id} saved={saved} next={`/product/${p.slug}`} />
          </div>

          {viewer && !viewer.isTrade && (
            <p className="mt-5 text-sm text-ink-soft">
              Buying for a workroom? <Link href="/trade" className="text-aubergine-700 underline underline-offset-4">Trade prices are available</Link>.
            </p>
          )}

          <ul className="mt-10 grid grid-cols-3 gap-3 text-center text-xs text-ink-soft">
            {[
              [IconScissors, "Hand cut in London"],
              [IconVan, "Tracked UK delivery"],
              [IconSwatch, "Free swatches"],
            ].map(([Icon, t]) => {
              const I = Icon as typeof IconScissors;
              return (
                <li key={t as string} className="flex flex-col items-center gap-2 border border-stone-300/70 px-2 py-4">
                  <I className="size-5 text-gold-600" strokeWidth={1.5} />
                  {t as string}
                </li>
              );
            })}
          </ul>

          <div className="mt-10 border-t border-stone-300">
            <Accordion title="Details" defaultOpen>
              {p.description && <p className="mb-5 whitespace-pre-line">{p.description}</p>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2.5">
                {specs.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-stone-500">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {p.care && (
                <>
                  <p className="mt-5 font-medium text-ink">Care</p>
                  <p className="mt-1">{p.care}</p>
                </>
              )}
            </Accordion>
            <Accordion title="Delivery & collection">
              <p>Orders placed before 1pm on a working day are usually cut and dispatched within 1 to 2 working days, tracked with Royal Mail or courier. Long lengths are rolled, never folded, where possible.</p>
              <p className="mt-3">Prefer to collect? Choose collection at checkout and we&apos;ll email you when it&apos;s ready at our London premises.</p>
              <Link href="/help/delivery" className="mt-3 inline-flex items-center gap-1.5 text-aubergine-700 hover:underline">Delivery details <IconArrowRight className="size-3.5" /></Link>
            </Accordion>
            <Accordion title="Returns">
              <p>
                {isMetre
                  ? "Because this fabric is cut to your length, it can't be returned unless it's faulty or we've cut it incorrectly. If in doubt, order a swatch first."
                  : "Unused, uncut items in their original condition can be returned within 14 days of delivery. Faulty items are always replaced or refunded."}
              </p>
              <Link href="/help/returns" className="mt-3 inline-flex items-center gap-1.5 text-aubergine-700 hover:underline">Returns policy <IconArrowRight className="size-3.5" /></Link>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="scroll-mt-24 border-t border-stone-300 bg-cream-50">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-[320px_1fr] lg:gap-20">
          <Reveal>
            <h2 className="font-display text-5xl"><span className="mr-3 text-2xl italic text-gold-600">ii.</span>Reviews</h2>
            {p.rating_count > 0 ? (
              <div className="mt-6">
                <p className="font-display text-6xl tabular-nums">{Number(p.rating_avg).toFixed(1)}</p>
                <div className="mt-2"><Stars value={Number(p.rating_avg)} size="md" /></div>
                <p className="mt-2 text-sm text-ink-soft">Based on {p.rating_count} review{p.rating_count === 1 ? "" : "s"}</p>
                <RatingBars reviews={reviews} />
              </div>
            ) : (
              <p className="mt-5 text-ink-soft">No reviews yet. If you&apos;ve sewn with this cloth, we&apos;d love to hear how it went.</p>
            )}
          </Reveal>

          <div className="space-y-12">
            {reviews.length > 0 && (
              <ul className="divide-y divide-stone-300 border-y border-stone-300">
                {reviews.map((r) => (
                  <li key={r.id} className="py-8">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Stars value={r.rating} />
                      {r.title && <p className="font-display text-2xl">{r.title}</p>}
                    </div>
                    {r.body && <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{r.body}</p>}
                    <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                      <span className="text-ink">{r.author_name}</span>
                      <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</time>
                      {r.verified_purchase && (
                        <span className="inline-flex items-center gap-1 text-success"><IconCheck className="size-3.5" /> Verified purchase</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <h3 className="font-display text-3xl">Write a review</h3>
              <div className="mt-5">
                {!viewer ? (
                  <p className="text-ink-soft">
                    <Link href={`/login?next=/product/${p.slug}%23reviews`} className="text-aubergine-700 underline underline-offset-4">Sign in</Link> to share your experience with this fabric.
                  </p>
                ) : ownReview ? (
                  <p className="border border-stone-300 bg-cream-100 p-5 text-ink-soft">
                    {ownReview.status === "pending"
                      ? "Thank you for your review. It's with our team and will appear once approved."
                      : ownReview.status === "approved"
                        ? "Thank you, your review is published above."
                        : "Thank you for your review."}
                  </p>
                ) : (
                  <ReviewForm productId={p.id} slug={p.slug} defaultName={viewer.fullName?.split(" ")[0] ?? ""} />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <Reveal className="flex items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-4xl md:text-5xl"><span className="mr-3 text-2xl italic text-gold-600">iii.</span>You may also need</h2>
            </div>
            <Link href={category ? `/shop/${category.slug}` : "/shop"} className="hidden items-center gap-2 text-sm text-aubergine-700 hover:underline md:inline-flex">
              View all <IconArrowRight className="size-4" />
            </Link>
          </Reveal>
          <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
            {related.map((r, i) => (
              <Reveal as="li" key={r.id} delay={i * 0.06}>
                <ProductCard p={r} />
              </Reveal>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function RatingBars({ reviews }: { reviews: { rating: number }[] }) {
  if (!reviews.length) return null;
  return (
    <ul className="mt-6 space-y-1.5" aria-label="Rating breakdown">
      {[5, 4, 3, 2, 1].map((n) => {
        const c = reviews.filter((r) => r.rating === n).length;
        return (
          <li key={n} className="flex items-center gap-3 text-xs text-ink-soft">
            <span className="w-3 tabular-nums">{n}</span>
            <span className="h-1 flex-1 bg-stone-300/60"><span className="block h-full bg-gold-500" style={{ width: `${(c / reviews.length) * 100}%` }} /></span>
            <span className="w-5 text-right tabular-nums">{c}</span>
          </li>
        );
      })}
    </ul>
  );
}
