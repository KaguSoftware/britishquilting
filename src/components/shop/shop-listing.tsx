import Link from "next/link";
import { Suspense } from "react";
import {IconArrowRight} from "@/components/icons";
import { Reveal } from "@/components/site/reveal";
import { ProductCard } from "@/components/shop/product-card";
import { FilterBar } from "@/components/shop/filter-bar";
import { FilterPendingOverlay, FilterTransitionProvider } from "@/components/shop/filter-transition";
import { Breadcrumbs, EmptyState, btnSecondary } from "@/components/shop/bits";
import { applyFilters, buildFacets, parseFilters, type Category, type ListProduct } from "@/lib/data/shop";
import { cn } from "@/lib/utils";

export const CATEGORY_COPY: Record<string, { eyebrow: string; title: string; lede: string; note: string }> = {
  all: {
    eyebrow: "The full cloth room",
    title: "Everything we cut",
    lede: "Linings, interlinings and workroom paper, measured and cut by hand in London. Order exactly the length you need, from 50cm.",
    note: "Not sure which? Order up to six free swatches first.",
  },
  linings: {
    eyebrow: "Linings",
    title: "The layer that makes a curtain hang",
    lede: "Cotton sateen in whites, ivories and colours, plus thermal and blackout. Close woven, soft to handle, and cut square from the bolt.",
    note: "Most linings are 137cm wide. Wide-width sateen avoids seams on large windows.",
  },
  interlinings: {
    eyebrow: "Interlinings",
    title: "Weight, warmth and that full drape",
    lede: "Bump, domette, flannelette and synthetic sarille. The hidden layer that gives hand-made curtains their generous, insulated fall.",
    note: "Bump is the heaviest; domette is lighter and ideal for Roman blinds.",
  },
  paper: {
    eyebrow: "Workroom paper",
    title: "Pattern, tracing and tissue",
    lede: "The papers our workroom customers rely on for drafting, templating and wrapping finished work. Sold by the roll and pack.",
    note: "Acid-free tissue keeps stored textiles safe from yellowing.",
  },
};

export function ShopListing({
  category,
  categories,
  products,
  searchParams,
}: {
  category: Category | null;
  categories: Category[];
  products: ListProduct[];
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const copy = CATEGORY_COPY[category?.slug ?? "all"] ?? {
    eyebrow: category?.name ?? "Shop",
    title: category?.name ?? "Shop",
    lede: category?.description ?? "",
    note: "",
  };
  const filters = parseFilters(searchParams);
  const facets = buildFacets(products);
  const results = applyFilters(products, filters);
  const hasFilters = filters.colour.length + filters.composition.length + filters.width.length > 0 || filters.inStock;
  const heroSwatches = products.filter((p) => p.colour_hex).slice(0, 7);

  return (
    <>
      <header className="relative overflow-hidden border-b border-stone-300 bg-cream-50 pt-16 md:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_90%_at_90%_0%,rgb(201_164_92/.14),transparent_65%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 md:px-8 md:pb-16 md:pt-14 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <Breadcrumbs items={[{ href: "/", label: "Home" }, ...(category ? [{ href: "/shop", label: "Shop" }, { label: category.name }] : [{ label: "Shop" }])]} />
            <Reveal className="mt-10">
              <p className="eyebrow text-gold-600">{copy.eyebrow}</p>
              <h1 className="font-display mt-4 text-5xl leading-[1.02] text-balance md:text-7xl">{copy.title}</h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">{copy.lede}</p>
            </Reveal>
          </div>
          {heroSwatches.length > 2 && (
            <Reveal delay={0.15} className="hidden lg:block">
              <div aria-hidden className="flex h-56 items-end justify-end gap-2">
                {heroSwatches.map((p, i) => (
                  <div
                    key={p.id}
                    className="w-12 origin-bottom shadow-soft"
                    style={{
                      height: `${60 + ((i * 37) % 40)}%`,
                      backgroundColor: p.colour_hex!,
                      backgroundImage:
                        "repeating-linear-gradient(45deg, rgb(0 0 0 / .04) 0 2px, transparent 2px 5px), linear-gradient(90deg, rgb(255 255 255 / .25), transparent 40%, rgb(0 0 0 / .08))",
                    }}
                  />
                ))}
              </div>
              {copy.note && <p className="mt-5 text-right text-sm italic text-ink-soft">{copy.note}</p>}
            </Reveal>
          )}
        </div>
        <nav aria-label="Categories" className="relative mx-auto max-w-7xl px-4 md:px-8">
          <ul className="-mb-px flex gap-7 overflow-x-auto [scrollbar-width:none]">
            {[{ slug: "", name: "All" }, ...categories].map((c) => {
              const on = (category?.slug ?? "") === c.slug;
              return (
                <li key={c.slug || "all"}>
                  <Link
                    href={c.slug ? `/shop/${c.slug}` : "/shop"}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "block whitespace-nowrap border-b-2 pb-4 text-sm transition-colors",
                      on ? "border-gold-500 text-ink" : "border-transparent text-ink-soft hover:text-aubergine-700",
                    )}
                  >
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8 md:pb-32">
        <FilterTransitionProvider>
          <Suspense fallback={<div className="h-[82px] border-b border-stone-300" />}>
            <FilterBar facets={facets} count={results.length} total={products.length} />
          </Suspense>

          <FilterPendingOverlay>
            {results.length > 0 ? (
              <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 md:mt-14 md:grid-cols-4 md:gap-x-5 lg:grid-cols-5">
                {results.map((p, i) => (
                  <Reveal as="li" key={p.id} delay={(i % 5) * 0.06}>
                    <ProductCard p={p} />
                  </Reveal>
                ))}
              </ul>
            ) : (
              <div className="mt-12">
                <EmptyState
                  title={hasFilters ? "Nothing matches just yet" : "This shelf is being restocked"}
                  action={
                    <Link href={hasFilters ? (category ? `/shop/${category.slug}` : "/shop") : "/contact"} className={btnSecondary}>
                      {hasFilters ? "Clear filters" : "Ask the workroom"} <IconArrowRight className="size-4" />
                    </Link>
                  }
                >
                  {hasFilters
                    ? "Try removing a filter or two. We also cut plenty of cloth that isn't online, so do ask."
                    : "We're cutting new stock for this range. Call or message and we'll tell you what's on the bolt today."}
                </EmptyState>
              </div>
            )}
          </FilterPendingOverlay>
        </FilterTransitionProvider>
      </section>
    </>
  );
}
