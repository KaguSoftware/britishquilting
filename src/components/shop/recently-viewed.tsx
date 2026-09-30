"use client";

import { useEffect, useState } from "react";
import { ProductCard, type ProductCardData } from "./product-card";
import { Reveal } from "@/components/site/reveal";

const KEY = "bq-recently-viewed";
const MAX = 10;
const SHOW = 4;

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Records the current product as viewed. Mount once per product page, renders nothing. */
export function RecordRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const ids = readIds().filter((id) => id !== productId);
      ids.unshift(productId);
      localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
    } catch {}
  }, [productId]);
  return null;
}

/** "You looked at these" rail, hydrated client-side from localStorage against the already-fetched catalogue. */
export function RecentlyViewedRail({ all, excludeId }: { all: ProductCardData[]; excludeId: string }) {
  const [items, setItems] = useState<ProductCardData[]>([]);

  useEffect(() => {
    const ids = readIds().filter((id) => id !== excludeId);
    const bySlug = new Map(all.map((p) => [p.id, p]));
    setItems(ids.map((id) => bySlug.get(id)).filter((p): p is ProductCardData => !!p).slice(0, SHOW));
  }, [all, excludeId]);

  if (!items.length) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
      <Reveal>
        <h2 className="font-display text-4xl md:text-5xl"><span className="mr-3 text-2xl italic text-gold-600">iv.</span>Recently viewed</h2>
      </Reveal>
      <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
        {items.map((p, i) => (
          <Reveal as="li" key={p.id} delay={i * 0.06}>
            <ProductCard p={p} />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
