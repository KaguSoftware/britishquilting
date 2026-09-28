"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {IconCheck, IconFilter, IconClose} from "@/components/icons";
import { cn } from "@/lib/utils";

type Facets = {
  colours: { hex: string; name: string; count: number }[];
  compositions: { value: string; count: number }[];
  widths: { value: string; count: number }[];
};

const SORTS = [
  ["featured", "Featured"],
  ["price-asc", "Price, low to high"],
  ["price-desc", "Price, high to low"],
  ["newest", "Newest"],
] as const;

export function FilterBar({ facets, count, total }: { facets: Facets; count: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const get = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  const colours = get("colour");
  const comps = get("composition");
  const widths = get("width");
  const inStock = sp.get("stock") === "1";
  const sort = sp.get("sort") ?? "featured";
  const active = colours.length + comps.length + widths.length + (inStock ? 1 : 0);

  const push = (next: URLSearchParams) => {
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  const toggle = (k: string, v: string) => {
    const cur = get(k);
    const nextVals = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    const next = new URLSearchParams(sp);
    if (nextVals.length) next.set(k, nextVals.join(","));
    else next.delete(k);
    push(next);
  };
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    push(next);
  };
  const clear = () => {
    const next = new URLSearchParams();
    if (sort !== "featured") next.set("sort", sort);
    push(next);
  };

  const panel = (
    <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_auto] md:gap-10">
      {facets.colours.length > 0 && (
        <fieldset>
          <legend className="mb-4 text-sm font-medium text-ink">Colour</legend>
          <div className="flex flex-wrap gap-2.5">
            {facets.colours.map((c) => {
              const on = colours.includes(c.hex);
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => toggle("colour", c.hex)}
                  aria-pressed={on}
                  title={c.name}
                  className={cn(
                    "group relative grid size-9 place-items-center rounded-full ring-1 ring-stone-300 ring-offset-2 ring-offset-cream-50 transition-all duration-300 hover:ring-aubergine-500",
                    on && "ring-2 ring-aubergine-700",
                  )}
                  style={{ backgroundColor: c.hex }}
                >
                  <span className="sr-only">{c.name}</span>
                  <span aria-hidden className="absolute inset-0 rounded-full bg-[repeating-linear-gradient(45deg,rgb(0_0_0/.05)_0_1px,transparent_1px_3px)]" />
                  {on && <IconCheck aria-hidden className={cn("relative size-4", isDark(c.hex) ? "text-cream-50" : "text-aubergine-800")} strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {facets.compositions.length > 0 && (
        <fieldset>
          <legend className="mb-4 text-sm font-medium text-ink">Composition</legend>
          <div className="flex flex-wrap gap-2">
            {facets.compositions.map((c) => (
              <Chip key={c.value} on={comps.includes(c.value)} onClick={() => toggle("composition", c.value)}>
                {c.value} <span className="text-stone-500">{c.count}</span>
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      {facets.widths.length > 0 && (
        <fieldset>
          <legend className="mb-4 text-sm font-medium text-ink">Width</legend>
          <div className="flex flex-wrap gap-2">
            {facets.widths.map((w) => (
              <Chip key={w.value} on={widths.includes(w.value)} onClick={() => toggle("width", w.value)}>
                {w.value}cm <span className="text-stone-500">{w.count}</span>
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-4 text-sm font-medium text-ink">Availability</legend>
        <button
          type="button"
          role="switch"
          aria-checked={inStock}
          onClick={() => set("stock", inStock ? null : "1")}
          className="inline-flex min-h-10 items-center gap-3 text-sm"
        >
          <span className={cn("relative h-6 w-11 rounded-full transition-colors duration-300", inStock ? "bg-aubergine-700" : "bg-stone-300")}>
            <span className={cn("absolute top-1 size-4 rounded-full bg-cream-50 shadow transition-transform duration-300 ease-(--ease-silk)", inStock ? "translate-x-6" : "translate-x-1")} />
          </span>
          In stock only
        </button>
      </fieldset>
    </div>
  );

  return (
    <div className="border-b border-stone-300">
      <div className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="filters-panel"
            className="inline-flex min-h-11 items-center gap-2.5 border border-stone-300 bg-cream-50 px-4 text-sm transition-colors hover:border-aubergine-700"
          >
            <IconFilter className="size-4" strokeWidth={1.5} />
            Refine
            {active > 0 && <span className="tabular-nums text-ink-soft">({active})</span>}
          </button>
          {active > 0 && (
            <button type="button" onClick={clear} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-ink-soft hover:text-aubergine-700">
              <IconClose className="size-3.5" /> Clear all
            </button>
          )}
        </div>
        <div className="flex items-center gap-5">
          <p className={cn("text-sm text-ink-soft tabular-nums transition-opacity", pending && "opacity-50")} aria-live="polite">
            {count === total ? `${total} ${total === 1 ? "fabric" : "fabrics"}` : `${count} of ${total}`}
          </p>
          <label className="relative inline-flex items-center">
            <span className="sr-only">Sort by</span>
            <select
              value={sort}
              onChange={(e) => set("sort", e.target.value === "featured" ? null : e.target.value)}
              className="min-h-11 appearance-none border border-stone-300 bg-cream-50 py-2 pl-4 pr-10 text-sm transition-colors hover:border-aubergine-700"
            >
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <svg aria-hidden viewBox="0 0 10 6" className="pointer-events-none absolute right-4 w-2.5 text-ink-soft"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
          </label>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="filters-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.1, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-8 pt-2">{panel}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 border px-3.5 text-sm transition-colors duration-300",
        on ? "border-aubergine-700 bg-aubergine-700 text-cream-50 [&_span]:text-cream-100/70" : "border-stone-300 bg-cream-50 hover:border-aubergine-700",
      )}
    >
      {children}
    </button>
  );
}

function isDark(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
}
