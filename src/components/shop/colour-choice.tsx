"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { photosFor } from "@/lib/photos";
import { ProductGallery } from "./product-gallery";

export type ColourOption = { id: string; name: string; colour_hex: string | null; in_stock: boolean; low_stock: boolean };
type Img = { storage_path: string; alt: string | null; sort_order: number; variant_id?: string | null };

type Ctx = { colours: ColourOption[]; selected: ColourOption | null; select: (id: string) => void; images: Img[] };
const ColourCtx = createContext<Ctx>({ colours: [], selected: null, select: () => {}, images: [] });

/**
 * Holds the colour picked on a product page so the gallery and the purchase panel agree.
 * The choice is mirrored into ?colour= so a link (or a back-in-stock email) opens on it.
 */
export function ColourProvider({ colours, initialId, images, children }: { colours: ColourOption[]; initialId: string | null; images: Img[]; children: ReactNode }) {
  const [id, setId] = useState(initialId);
  const select = useCallback((next: string) => {
    setId(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("colour", next);
      window.history.replaceState(window.history.state, "", url);
    } catch {}
  }, []);
  const value = useMemo(() => ({ colours, selected: colours.find((c) => c.id === id) ?? null, select, images }), [colours, id, select, images]);
  return <ColourCtx value={value}>{children}</ColourCtx>;
}

export const useColour = () => use(ColourCtx);

/** The product gallery, showing the photos of whichever colour is chosen. */
export function ColourGallery({ hex, name, label }: { hex: string | null; name: string; label: string | null }) {
  const { selected, images } = useColour();
  const shown = photosFor(images, selected?.id ?? null);
  const tag = selected ? [selected.name, label].filter(Boolean).join(" / ") : label;
  return <ProductGallery key={selected?.id ?? "all"} images={shown} hex={selected?.colour_hex ?? hex} name={name} label={tag || null} />;
}

/** Swatch buttons for choosing a colour, as a single-choice group. */
export function ColourSwatches() {
  const { colours, selected, select } = useColour();
  if (colours.length === 0) return null;
  const move = (from: number, step: number) => {
    const next = colours[(from + step + colours.length) % colours.length];
    select(next.id);
    document.getElementById(`colour-${next.id}`)?.focus();
  };
  return (
    <fieldset className="mt-8">
      <legend className="flex w-full items-baseline justify-between text-sm">
        <span>
          <span className="font-medium">Colour</span>
          <span className="text-ink-soft">{selected ? `, ${selected.name}` : ", please choose"}</span>
        </span>
        <span className="text-xs text-stone-500">
          {colours.length} {colours.length === 1 ? "colour" : "colours"}
        </span>
      </legend>
      <div role="radiogroup" aria-label="Colour" className="mt-3 flex flex-wrap gap-2.5">
        {colours.map((c, i) => {
          const on = c.id === selected?.id;
          return (
            <button
              key={c.id}
              id={`colour-${c.id}`}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${c.name}${c.in_stock ? "" : ", sold out"}`}
              title={c.name}
              tabIndex={on || (!selected && i === 0) ? 0 : -1}
              onClick={() => select(c.id)}
              onKeyDown={(e) => {
                const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (step) {
                  e.preventDefault();
                  move(i, step);
                }
              }}
              className={cn(
                "group relative grid size-12 place-items-center rounded-full border transition-colors duration-300",
                on ? "border-aubergine-700" : "border-transparent hover:border-stone-300",
              )}
            >
              <span className="relative block size-9 overflow-hidden rounded-full border border-ink/15" style={{ background: c.colour_hex ?? "#e8dcc4" }}>
                {!c.in_stock && (
                  <span aria-hidden className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-ink/60" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
