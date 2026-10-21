"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconClose, IconSearch } from "@/components/icons";
import { searchShopProducts } from "@/lib/actions/shop";
import type { SearchHit } from "@/lib/data/shop";
import { cn, formatPence, storageUrl } from "@/lib/utils";

const PER = { metre: "/ metre", roll: "/ roll", unit: "" } as const;

/**
 * The search in the site header. The icon opens a bar under the header; type a product's name or its code
 * (LIN3, LIN3RED) and pick from what turns up. Enter opens the highlighted one, Esc closes.
 */
export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState("");
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  const close = () => {
    setOpen(false);
    setQ("");
    setHits([]);
    setSearched("");
  };

  // Leaving the page closes it.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) close();
  }

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // Ask as you type, a moment after the last key.
  useEffect(() => {
    const term = q.trim();
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const found = term ? await searchShopProducts(term).catch(() => []) : [];
      if (n !== seq.current) return; // a newer search has started
      setHits(found);
      setSearched(term);
      setActive(0);
    }, term ? 200 : 0);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && hits[active] && searched === q.trim()) {
      // Only once the results are for what is typed now, never a list left over from earlier keys.
      e.preventDefault();
      router.push(hits[active].href);
      close();
    }
  };

  const typed = q.trim();
  return (
    <>
      <button type="button" onClick={() => (open ? close() : setOpen(true))} aria-label={open ? "Close search" : "Search products"} aria-expanded={open} className="grid size-11 place-items-center">
        {open ? <IconClose className="size-[22px]" /> : <IconSearch className="size-[22px]" />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="shade"
              className="fixed inset-0 top-[calc(var(--announce-offset,0px)+4rem)] -z-10 bg-aubergine-950/25 md:top-[calc(var(--announce-offset,0px)+5rem)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              aria-hidden
            />
            <motion.div
              key="panel"
              role="search"
              className="absolute inset-x-0 top-full border-b border-stone-300 bg-cream-100 text-ink"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mx-auto max-w-3xl px-4 pb-6 pt-5 md:px-8">
                <div className="flex items-center gap-3 border-b border-ink/40 pb-2 transition-colors focus-within:border-aubergine-700">
                  <IconSearch className="size-5 shrink-0 text-ink-soft" />
                  <input
                    ref={input}
                    role="combobox"
                    aria-expanded={hits.length > 0}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
                    aria-label="Search by product name or code"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Search by name or code, e.g. LIN3RED"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent font-display text-2xl outline-none placeholder:text-stone-500/70 md:text-3xl"
                    // The underline shows focus here, in place of the site-wide gold ring.
                    style={{ outline: "none" }}
                  />
                </div>

                <ul id={listId} role="listbox" className="bq-scroll mt-2 max-h-[60svh] overflow-y-auto">
                  {hits.map((h, i) => {
                    const img = storageUrl(h.image);
                    return (
                      <li key={h.key} role="presentation">
                        <Link
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={i === active}
                          href={h.href}
                          onClick={close}
                          onMouseEnter={() => setActive(i)}
                          className={cn("grid grid-cols-[48px_1fr_auto] items-center gap-4 border-b border-ink/10 py-3", i === active && "bg-cream-200/70")}
                        >
                          <span className="relative size-12 overflow-hidden rounded-[2px] bg-cream-200">
                            {img && <img src={img} alt="" className="absolute inset-0 size-full object-cover" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{h.colour ? `${h.name}, ${h.colour}` : h.name}</span>
                            {h.code && <span className="block text-sm tabular-nums text-ink-soft">{h.code}</span>}
                          </span>
                          <span className="pr-1 text-right text-sm tabular-nums">
                            {formatPence(h.price_pence)} <span className="text-ink-soft">{PER[h.sale_mode]}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {typed && searched === typed && hits.length === 0 && (
                  <p className="mt-4 text-ink-soft">
                    Nothing matches &ldquo;{typed}&rdquo;. Try part of the name, or a code like LIN3.
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
