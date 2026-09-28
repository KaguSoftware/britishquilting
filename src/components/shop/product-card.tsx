import Image from "next/image";
import Link from "next/link";
import { IconStar as Star } from "@/components/icons";
import { formatPence, storageUrl } from "@/lib/utils";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  sale_mode: "metre" | "roll" | "unit";
  price_pence: number;
  compare_at_pence: number | null;
  in_stock: boolean;
  low_stock: boolean;
  colour_hex: string | null;
  rating_avg: number;
  rating_count: number;
  product_images?: { storage_path: string; alt: string | null; sort_order: number }[];
};

const unitLabel = { metre: "/ metre", roll: "/ roll", unit: "" } as const;

export function ProductCard({ p, sizes = "(min-width: 768px) 25vw, 50vw" }: { p: ProductCardData; sizes?: string }) {
  const imgs = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const [first, second] = imgs;
  return (
    <Link href={`/product/${p.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-cream-200">
        {first ? (
          <>
            <Image
              src={storageUrl(first.storage_path)!}
              alt={first.alt ?? p.name}
              fill
              sizes={sizes}
              className="object-cover transition-[transform,opacity] duration-[1.2s] ease-(--ease-silk) group-hover:scale-[1.04]"
            />
            {second && (
              <Image
                src={storageUrl(second.storage_path)!}
                alt=""
                fill
                sizes={sizes}
                className="object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <FabricPlaceholder hex={p.colour_hex} />
        )}
        {!p.in_stock && (
          <span className="absolute left-3 top-3 bg-cream-50/90 px-2.5 py-1 text-[0.7rem] uppercase tracking-widest">Sold out</span>
        )}
        {p.in_stock && p.low_stock && (
          <span className="absolute left-3 top-3 bg-gold-100/95 px-2.5 py-1 text-[0.7rem] uppercase tracking-widest text-gold-600">Low stock</span>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-xl leading-tight md:text-2xl">{p.name}</h3>
          {p.subtitle && <p className="mt-0.5 truncate text-sm text-ink-soft">{p.subtitle}</p>}
        </div>
        {p.rating_count > 0 && (
          <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs text-ink-soft">
            <Star className="size-3 fill-gold-500 text-gold-500" /> {Number(p.rating_avg).toFixed(1)}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm">
        <span className="tabular-nums">{formatPence(p.price_pence)}</span>
        <span className="text-ink-soft"> {unitLabel[p.sale_mode]}</span>
        {p.compare_at_pence != null && p.compare_at_pence > p.price_pence && (
          <span className="ml-2 text-ink-soft line-through">{formatPence(p.compare_at_pence)}</span>
        )}
      </p>
    </Link>
  );
}

/** Woven-looking stand-in until real photography is uploaded. */
export function FabricPlaceholder({ hex }: { hex: string | null }) {
  const c = hex ?? "#e8dcc4";
  return (
    <div
      aria-hidden
      className="absolute inset-0 transition-transform duration-[1.2s] ease-(--ease-silk) group-hover:scale-[1.04]"
      style={{
        backgroundColor: c,
        backgroundImage: `repeating-linear-gradient(45deg, rgb(0 0 0 / .035) 0 2px, transparent 2px 5px), repeating-linear-gradient(-45deg, rgb(255 255 255 / .06) 0 2px, transparent 2px 5px), radial-gradient(120% 90% at 30% 10%, rgb(255 255 255 / .35), transparent 60%), linear-gradient(180deg, transparent 60%, rgb(0 0 0 / .08))`,
      }}
    />
  );
}
