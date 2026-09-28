"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn, storageUrl } from "@/lib/utils";

type Img = { storage_path: string; alt: string | null };

/** Pinking-shear zigzag along the top edge of a sample label. */
const PINKED = "conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top / 10px 5px repeat-x, linear-gradient(#000 0 0) bottom / 100% calc(100% - 5px) no-repeat";

const weave = (c: string, scale = 1) => ({
  backgroundColor: c,
  backgroundImage: `repeating-linear-gradient(45deg, rgb(0 0 0 / .045) 0 ${2 * scale}px, transparent ${2 * scale}px ${5 * scale}px), repeating-linear-gradient(-45deg, rgb(255 255 255 / .07) 0 ${2 * scale}px, transparent ${2 * scale}px ${5 * scale}px), repeating-linear-gradient(0deg, rgb(0 0 0 / .02) 0 1px, transparent 1px ${3 * scale}px)`,
});

/** Main product visual with a magnifying lens on fine pointers. */
export function ProductGallery({ images, hex, name, label }: { images: Img[]; hex: string | null; name: string; label?: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const [lens, setLens] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const c = hex ?? "#e8dcc4";
  const img = images[active];
  const src = img ? storageUrl(img.storage_path)! : null;
  const ZOOM = 2.6;
  const LENS = 180;

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !box.current) return;
    const r = box.current.getBoundingClientRect();
    setLens({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
  };

  return (
    <div className="md:sticky md:top-28">
      <div
        ref={box}
        onPointerMove={onMove}
        onPointerLeave={() => setLens(null)}
        className="relative aspect-[4/5] cursor-crosshair overflow-hidden bg-cream-200 shadow-soft"
      >
        {src ? (
          <Image src={src} alt={img!.alt ?? name} fill priority sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />
        ) : (
          <>
            <div aria-hidden className="absolute inset-0" style={weave(c)} />
            {/* soft drape light + selvedge */}
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(100deg,transparent_0%,rgb(255_255_255/.22)_18%,transparent_32%,rgb(0_0_0/.06)_48%,transparent_60%,rgb(255_255_255/.16)_74%,transparent_90%)]" />
            <div aria-hidden className="absolute inset-y-0 right-0 w-5 bg-[repeating-linear-gradient(180deg,rgb(0_0_0/.08)_0_1px,transparent_1px_4px)] opacity-70" />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_25%_5%,rgb(255_255_255/.3),transparent_55%),linear-gradient(180deg,transparent_65%,rgb(0_0_0/.1))]" />
            <span className="sr-only">{name}, colour sample. Photography coming soon.</span>
          </>
        )}
        {lens && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full border border-cream-50/80 shadow-lift ring-1 ring-aubergine-950/10"
            style={{
              width: LENS,
              height: LENS,
              left: lens.x - LENS / 2,
              top: lens.y - LENS / 2,
              ...(src
                ? {
                    backgroundImage: `url(${src})`,
                    backgroundSize: `${lens.w * ZOOM}px ${lens.h * ZOOM}px`,
                    backgroundPosition: `${-(lens.x * ZOOM - LENS / 2)}px ${-(lens.y * ZOOM - LENS / 2)}px`,
                    backgroundRepeat: "no-repeat",
                  }
                : { ...weave(c, ZOOM), backgroundPosition: `${-lens.x * ZOOM}px ${-lens.y * ZOOM}px` }),
            }}
          />
        )}
        {!src && label && (
          <div aria-hidden className="pointer-events-none absolute bottom-6 left-6 drop-shadow-[0_6px_14px_rgb(28_10_36/0.18)]">
          <div className="w-52 bg-cream-50 px-5 pb-4 pt-6 text-ink" style={{ WebkitMask: PINKED, mask: PINKED }}>
            <p className="font-display text-xl leading-tight">{name}</p>
            <div className="mt-3 border-t border-stone-300 pt-2 text-xs leading-relaxed text-ink-soft">{label}</div>
            <p className="mt-2 text-[0.7rem] italic text-stone-500">British Quilting, London</p>
          </div>
          </div>
        )}
        <p className="pointer-events-none absolute right-5 top-5 hidden text-xs italic text-ink-soft/80 md:block">Hover to inspect the weave</p>
      </div>
      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-3" aria-label="Product images">
          {images.map((im, i) => (
            <li key={im.storage_path}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active}
                className={cn("relative block aspect-square w-full overflow-hidden bg-cream-200 ring-offset-2 ring-offset-cream-100 transition", i === active ? "ring-1 ring-aubergine-700" : "opacity-70 hover:opacity-100")}
              >
                <Image src={storageUrl(im.storage_path)!} alt="" fill sizes="120px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
