import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, EmptyState, btnSecondary } from "@/components/shop/bits";
import { SwatchCard, SwatchCounter } from "@/components/shop/swatch-card";
import { Reveal } from "@/components/site/reveal";
import { getCategories, getListProducts } from "@/lib/data/shop";
import { MAX_SWATCHES } from "@/lib/pricing";
import { storageUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Free fabric swatches",
  description: `Order up to ${MAX_SWATCHES} free swatches of our linings and interlinings to check colour, weight and drape before you cut.`,
  alternates: { canonical: "/samples" },
};

export default async function SamplesPage() {
  const [categories, products] = await Promise.all([getCategories(), getListProducts()]);
  const swatchable = products.filter((p) => p.swatch_enabled && p.sale_mode !== "unit");
  const groups = categories
    .map((c) => ({ c, items: swatchable.filter((p) => p.category_id === c.id) }))
    .filter((g) => g.items.length > 0);
  let n = 0;

  return (
    <>
      <PageHeader
        eyebrow="Swatches"
        title={<>Feel it before <em>you cut it.</em></>}
        lede={`Choose up to ${MAX_SWATCHES} swatches and we'll post them first class, free of charge, usually the next working day. Hold them to the light, test the drape, and pin them against your face fabric.`}
        crumbs={[{ href: "/", label: "Home" }, { label: "Swatches" }]}
      >
        <div className="mt-12 flex flex-col gap-8 border-t border-stone-300 pt-8 md:flex-row md:items-center md:justify-between">
          <SwatchCounter />
          <ol className="grid gap-x-10 gap-y-2 text-sm text-ink-soft sm:grid-cols-3">
            {["Add swatches below", "Check out, no charge", "Posted first class"].map((t, i) => (
              <li key={t} className="flex items-baseline gap-2.5">
                <span className="font-display text-lg text-gold-600 tabular-nums">{i + 1}</span> {t}
              </li>
            ))}
          </ol>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        {groups.length === 0 ? (
          <EmptyState title="Swatches are being cut" action={<Link href="/contact" className={btnSecondary}>Request by message</Link>}>
            Our swatch cards are being restocked. Send us a note with the fabrics you&apos;re considering and we&apos;ll post them by hand.
          </EmptyState>
        ) : (
          <div className="space-y-24">
            {groups.map(({ c, items }, gi) => (
              <section key={c.id} aria-labelledby={`sw-${c.slug}`}>
                <Reveal className="grid gap-4 border-b border-stone-300 pb-6 md:grid-cols-[1fr_1.2fr] md:items-end">
                  <h2 id={`sw-${c.slug}`} className="font-display text-4xl md:text-5xl">
                    <span className="mr-4 text-2xl italic text-gold-600">{["i", "ii", "iii", "iv", "v"][gi] ?? gi + 1}.</span>
                    {c.name}
                  </h2>
                  {c.description && <p className="text-ink-soft md:text-right">{c.description}</p>}
                </Reveal>
                <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:gap-x-6 lg:grid-cols-5">
                  {items.map((p, i) => {
                    const idx = n++;
                    const img = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
                    return (
                      <Reveal as="li" key={p.id} delay={(i % 5) * 0.05}>
                        <SwatchCard
                          index={idx}
                          p={{
                            id: p.id,
                            slug: p.slug,
                            name: p.name,
                            subtitle: p.subtitle,
                            colour_hex: p.colour_hex,
                            composition: p.composition,
                            width_cm: p.width_cm,
                            sale_mode: p.sale_mode,
                            swatch_price_pence: p.swatch_price_pence,
                            image: img ? storageUrl(img.storage_path) : null,
                          }}
                        />
                      </Reveal>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <Reveal className="mt-24 grid gap-10 border-t border-stone-300 pt-12 md:grid-cols-3">
          {[
            ["How big are they?", "Each swatch is roughly 15 by 15cm, cut from the same bolts we cut your order from, so colour and weight match exactly."],
            ["Is there a catch?", `None. Up to ${MAX_SWATCHES} per order, and you can add them alongside fabric. Swatches ship free even on their own.`],
            ["Need more than six?", "Trade customers and workrooms can request a full sample book. Just ask us and tell us about the project."],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="font-display text-2xl">{t}</h3>
              <p className="mt-2 text-ink-soft">{d}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </>
  );
}
