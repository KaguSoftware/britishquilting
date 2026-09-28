"use client";

import Link from "next/link";
import { toast } from "sonner";
import { IconCheck, IconPlus } from "@/components/icons";
import { useCart } from "@/components/cart/cart-store";
import { MAX_SWATCHES, type SaleMode } from "@/lib/pricing";
import { cn, formatPence } from "@/lib/utils";

export type SwatchProduct = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  colour_hex: string | null;
  composition: string | null;
  width_cm: number | null;
  sale_mode: SaleMode;
  swatch_price_pence: number;
  image: string | null;
};

const PINKED =
  "conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 12px 6px repeat-x, linear-gradient(#000 0 0) top / 100% calc(100% - 6px) no-repeat";

/** A sample card with a pinked lower edge, like the ones pinned in the workroom. */
export function SwatchCard({ p, index }: { p: SwatchProduct; index: number }) {
  const { items, add, hydrated } = useCart();
  const inCart = hydrated && items.some((i) => i.productId === p.id && i.isSwatch);
  const count = items.filter((i) => i.isSwatch).length;
  const full = hydrated && !inCart && count >= MAX_SWATCHES;

  const onAdd = () => {
    add({
      productId: p.id,
      isSwatch: true,
      quantity: 1,
      name: p.name,
      subtitle: "Swatch",
      slug: p.slug,
      image: p.image,
      saleMode: p.sale_mode,
      unitPricePence: p.swatch_price_pence,
    });
    toast.success(`${p.name} swatch added`, { description: `${count + 1} of ${MAX_SWATCHES} swatches chosen` });
  };

  return (
    <article className="group">
      <div className="drop-shadow-[0_8px_16px_rgb(28_10_36/0.10)] transition-[filter] duration-500 group-hover:drop-shadow-[0_16px_28px_rgb(28_10_36/0.16)]">
      <div className="bg-cream-50 p-3 pb-0" style={{ WebkitMask: PINKED, mask: PINKED }}>
        <div
          className="aspect-square transition-transform duration-700 ease-(--ease-silk) group-hover:scale-[1.02]"
          style={{
            backgroundColor: p.colour_hex ?? "#efe6d6",
            backgroundImage:
              "repeating-linear-gradient(45deg, rgb(0 0 0 / .045) 0 2px, transparent 2px 5px), repeating-linear-gradient(-45deg, rgb(255 255 255 / .07) 0 2px, transparent 2px 5px), radial-gradient(120% 90% at 30% 10%, rgb(255 255 255 / .3), transparent 60%)",
          }}
        />
        <div className="px-1 pb-6 pt-4">
          <p className="flex items-baseline justify-between gap-3 text-xs text-stone-500">
            <span className="tabular-nums">No. {String(index + 1).padStart(2, "0")}</span>
            <span>{p.width_cm ? `${p.width_cm}cm` : ""}</span>
          </p>
          <h3 className="font-display mt-1 text-xl leading-tight">
            <Link href={`/product/${p.slug}`} className="hover:text-aubergine-700">{p.name}</Link>
          </h3>
          <p className="mt-0.5 min-h-5 truncate text-sm text-ink-soft">{p.composition ?? p.subtitle}</p>
        </div>
      </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={inCart || full}
        aria-label={inCart ? `${p.name} swatch is in your basket` : `Add ${p.name} swatch`}
        className={cn(
          "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border text-sm transition-colors duration-300",
          inCart
            ? "border-success/40 text-success"
            : "border-stone-300 text-aubergine-700 hover:border-aubergine-700 hover:bg-aubergine-700 hover:text-cream-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-aubergine-700",
        )}
      >
        {inCart ? <><IconCheck className="size-4" /> In your basket</> : <><IconPlus className="size-4" /> {p.swatch_price_pence > 0 ? `Add swatch, ${formatPence(p.swatch_price_pence)}` : "Add free swatch"}</>}
      </button>
    </article>
  );
}

export function SwatchCounter() {
  const { items, hydrated, setOpen } = useCart();
  const n = hydrated ? items.filter((i) => i.isSwatch).length : 0;
  return (
    <div className="flex items-center gap-5" aria-live="polite">
      <ol className="flex gap-1.5" aria-label={`${n} of ${MAX_SWATCHES} swatches chosen`}>
        {Array.from({ length: MAX_SWATCHES }).map((_, i) => (
          <li key={i} className={cn("h-8 w-6 border transition-colors duration-500", i < n ? "border-aubergine-700 bg-aubergine-700" : "border-stone-300 bg-cream-50")} />
        ))}
      </ol>
      <p className="text-sm text-ink-soft">
        <span className="font-medium text-ink tabular-nums">{n} of {MAX_SWATCHES}</span> chosen
        {n > 0 && (
          <>
            {" "}
            <button type="button" onClick={() => setOpen(true)} className="text-aubergine-700 underline underline-offset-4">Review basket</button>
          </>
        )}
      </p>
    </div>
  );
}
