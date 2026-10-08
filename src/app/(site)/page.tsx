import Link from "next/link";
import { unstable_cache } from "next/cache";
import { IconArrowRight as ArrowRight, IconTape as Ruler, IconScissors as Scissors, IconVan as Truck } from "@/components/icons";
import { Hero, type HeroCategory } from "@/components/hero/hero";
import { Crown } from "@/components/site/brand";
import { Reveal } from "@/components/site/reveal";
import { ProductCard, type ProductCardData } from "@/components/shop/product-card";
import { createPublicClient } from "@/lib/supabase/server";

const FALLBACK: HeroCategory[] = [
  { slug: "linings", name: "Linings", blurb: "Cotton sateen and blackout, cut to your length." },
  { slug: "interlinings", name: "Interlinings", blurb: "Bump and domette for fuller, warmer drapes." },
  { slug: "paper", name: "Paper", blurb: "Pattern and tissue papers for the workroom." },
];

// Genuinely public (no viewer-specific data), so it's safe to cache: see src/lib/data/shop.ts
// for the same treatment of the shop/product/journal reads and the tags admin edits invalidate.
const getHomeData = unstable_cache(
  async () => {
    try {
      const supabase = createPublicClient();
      const [{ data: cats }, { data: featured }] = await Promise.all([
        supabase.from("categories").select("slug, name, description").is("parent_id", null).order("sort_order"),
        supabase
          .from("products_public")
          .select("id, slug, name, subtitle, sale_mode, price_pence, compare_at_pence, in_stock, low_stock, colour_hex, rating_avg, rating_count, product_images(storage_path, alt, sort_order)")
          .eq("is_featured", true)
          .order("sort_order")
          .limit(5),
      ]);
      return {
        categories: cats?.length ? cats.map((c) => ({ slug: c.slug, name: c.name, blurb: c.description ?? "" })) : FALLBACK,
        featured: (featured ?? []) as unknown as ProductCardData[],
      };
    } catch {
      return { categories: FALLBACK, featured: [] as ProductCardData[] };
    }
  },
  ["home-data"],
  { tags: ["categories", "products"], revalidate: 300 },
);

export default async function HomePage() {
  const { categories, featured } = await getHomeData();

  return (
    <>
      <Hero categories={categories} />

      {/* Promise strip */}
      <section className="border-b border-stone-300 bg-cream-50">
        <ul className="mx-auto grid max-w-7xl divide-stone-300 px-4 md:grid-cols-3 md:divide-x md:px-8">
          {[
            { icon: Scissors, t: "Cut to the centimetre", d: "Any length from 50cm, measured twice." },
            { icon: Truck, t: "Dispatched in 1–2 days", d: "Tracked UK delivery, or collect in London." },
            { icon: Ruler, t: "Swatches before you buy", d: "Feel the weight and hand of the cloth first." },
          ].map(({ icon: Icon, t, d }) => (
            <li key={t} className="flex items-center gap-4 py-6 md:justify-center md:px-6">
              <Icon className="size-5 shrink-0 text-gold-600" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium">{t}</p>
                <p className="text-sm text-ink-soft">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
          <Reveal className="flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-gold-600">The workroom favourites</p>
              <h2 className="font-display mt-3 text-5xl md:text-6xl">Most requested</h2>
            </div>
            <Link href="/shop/linings" className="hidden items-center gap-2 text-sm text-aubergine-700 hover:underline md:inline-flex">
              View all <ArrowRight className="size-4" />
            </Link>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-5 lg:grid-cols-5">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.08} className={i === 4 ? "hidden lg:block" : undefined}>
                <ProductCard p={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Story */}
      <section className="relative overflow-hidden bg-cream-200/60">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 py-24 md:grid-cols-2 md:px-8 md:py-36">
          <Reveal>
            <p className="eyebrow text-gold-600">Our story</p>
            <h2 className="font-display mt-4 text-5xl leading-[1.02] md:text-7xl">
              Three decades at the <em>cutting table.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="space-y-5 text-lg leading-relaxed text-ink-soft">
            <p>
              Since 1990 our family has supplied London&apos;s curtain makers, upholsterers and home sewists with the
              layers that make soft furnishings hang properly: the linings, interlinings and papers nobody sees but
              everybody notices.
            </p>
            <p>Every order is measured and cut by hand in our London workroom, then wrapped and sent the same week.</p>
            <Link href="/about" className="inline-flex items-center gap-2 pt-2 text-base text-aubergine-700 hover:underline">
              Read our story <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <Reveal className="text-center">
          <Crown className="mx-auto h-5 w-auto text-gold-500" />
          <h2 className="font-display mt-5 text-5xl md:text-6xl">Ordering by the metre</h2>
        </Reveal>
        <ol className="mt-16 grid gap-10 md:grid-cols-3">
          {[
            ["Choose your length", "Enter exactly what you need, in 10cm or 50cm steps depending on the cloth. The price updates as you type."],
            ["We measure & cut", "Your length is cut from the bolt by hand, checked for flaws, and rolled (never folded) where possible."],
            ["Delivered, tracked", "Sent tracked with Royal Mail or courier, or ready to collect from our London premises."],
          ].map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 0.1} className="border-t border-stone-300 pt-8">
              <span className="font-display text-6xl text-gold-500">0{i + 1}</span>
              <h3 className="font-display mt-4 text-3xl">{t}</h3>
              <p className="mt-3 text-ink-soft">{d}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Samples */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-24 md:px-8 md:pb-32">
        <Reveal>
          <Link href="/samples" className="group relative flex min-h-96 flex-col justify-end overflow-hidden border border-stone-300 bg-cream-50 p-10">
            <p className="eyebrow text-gold-600">Swatches</p>
            <h3 className="font-display mt-3 text-5xl">Feel it before you cut it.</h3>
            <p className="mt-3 max-w-md text-ink-soft">Order up to six swatches, posted first class, so you can check colour, weight and drape at home.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-aubergine-700">Choose swatches <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </Reveal>
      </section>
    </>
  );
}
