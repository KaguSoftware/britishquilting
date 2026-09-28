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
          <FabricPlaceholder hex={p.colour_hex} name={p.name} />
        )}
        {!p.in_stock && (
          <span className="absolute left-3 top-3 bg-cream-50 px-2 py-0.5 font-serif text-sm italic text-ink">Sold out</span>
        )}
        {p.in_stock && p.low_stock && (
          <span className="absolute left-3 top-3 bg-cream-50 px-2 py-0.5 font-serif text-sm italic text-gold-600">Only a little left</span>
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

type Weave = "plain" | "sateen" | "twill" | "felt" | "paper";

function weaveFor(name = ""): Weave {
  const n = name.toLowerCase();
  if (/paper|card|tissue/.test(n)) return "paper";
  if (/bump|flannel|interlin|domette|wadding/.test(n)) return "felt";
  if (/sateen|satin|silk/.test(n)) return "sateen";
  if (/blackout|thermal|twill|drill/.test(n)) return "twill";
  return "plain";
}

/** Luminance 0..1 so light cloths get darker threads and vice versa. */
function lum(hex: string) {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
}

const tiles: Record<Weave, (ink: string, hi: string) => string> = {
  plain: (ink, hi) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><rect width='3' height='3' fill='${ink}'/><rect x='3' y='3' width='3' height='3' fill='${ink}'/><rect x='3' width='3' height='1' fill='${hi}'/><rect y='3' width='3' height='1' fill='${hi}'/></svg>`,
  twill: (ink, hi) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M-2 2l4-4M0 8l8-8M6 10l4-4' stroke='${ink}' stroke-width='1.6'/><path d='M-2 6l8-8M2 10l8-8' stroke='${hi}' stroke-width='.8'/></svg>`,
  sateen: (ink, hi) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='5'><rect width='10' height='5' fill='${hi}' opacity='.4'/><rect x='1' y='1' width='2' height='1' fill='${ink}'/><rect x='6' y='3' width='2' height='1' fill='${ink}'/></svg>`,
  felt: (ink, hi) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2 0'/></filter><rect width='80' height='80' filter='url(#f)'/></svg>`,
  paper: (ink) =>
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M24 0H0v24' fill='none' stroke='${ink}' stroke-width='.7'/><circle cx='12' cy='12' r='.8' fill='${ink}'/></svg>`,
};

/**
 * Woven stand-in until real photography is uploaded: the weave follows the
 * cloth (plain, twill, sateen, felted bump, dot-and-cross paper), threads are
 * tinted against the cloth colour, and a soft diagonal fold catches the light.
 */
export function FabricPlaceholder({ hex, name }: { hex: string | null; name?: string }) {
  const c = hex ?? "#e8dcc4";
  const weave = weaveFor(name);
  const dark = lum(c) < 0.45;
  const ink = dark ? "rgba(0,0,0,.24)" : "rgba(60,40,30,.1)";
  const hi = dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.4)";
  const svg = encodeURIComponent(tiles[weave](ink, hi)).replace(/'/g, "%27");
  const sheen = weave === "sateen" ? (dark ? ".18" : ".55") : dark ? ".08" : ".3";
  return (
    <div
      aria-hidden
      className="absolute inset-0 transition-transform duration-[1.2s] ease-(--ease-silk) group-hover:scale-[1.04]"
      style={{
        backgroundColor: c,
        backgroundImage: [
          // the fold: a lit ridge and its shadow running corner to corner
          `linear-gradient(118deg, transparent 36%, rgb(255 255 255 / ${sheen}) 46%, transparent 52%, rgb(0 0 0 / ${dark ? ".24" : ".1"}) 58%, transparent 74%)`,
          `radial-gradient(130% 90% at 20% 0%, rgb(255 255 255 / ${dark ? ".08" : ".3"}), transparent 60%)`,
          `linear-gradient(180deg, transparent 55%, rgb(0 0 0 / ${dark ? ".25" : ".1"}))`,
          `url("data:image/svg+xml,${svg}")`,
        ].join(", "),
      }}
    />
  );
}
