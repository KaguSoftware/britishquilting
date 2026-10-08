"use client";

import Image from "next/image";
import { FabricPlaceholder } from "@/components/shop/product-card";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconMinus as Minus, IconPlus as Plus, IconScissors as Scissors, IconClose as X } from "@/components/icons";
import { sameLine, toLine, useCart, type CartItem } from "./cart-store";
import { quoteCart, type CartQuote } from "@/lib/actions/cart";
import { formatMetres, formatPence } from "@/lib/utils";

export function CartDrawer() {
  const { items, open, setOpen, update, remove } = useCart();
  const [q, setQ] = useState<CartQuote | null>(null);
  const [, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // Re-quote from the server whenever the basket changes while open.
  useEffect(() => {
    if (!open || items.length === 0) return;
    const lines = items.map(toLine);
    const mine = ++seq.current;
    startTransition(async () => {
      const res = await quoteCart({ lines });
      // Ignore responses that arrive after a newer basket change.
      if (res.ok && mine === seq.current) setQ(res);
    });
  }, [open, items]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, setOpen]);

  const lineQuote = (i: CartItem) => q?.lines.find((l) => sameLine(i, l));
  const subtotal = q?.subtotal ?? items.reduce((s, i) => s + estimate(i), 0);
  const threshold = q?.freeThreshold ?? null;
  const toFree = threshold != null ? Math.max(0, threshold - subtotal) : null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Your basket">
          <motion.button
            aria-label="Close basket"
            className="absolute inset-0 bg-aubergine-950/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            data-lenis-prevent
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream-50 shadow-lift outline-none"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.6, ease: [0.2, 0.7, 0.1, 1] }}
          >
            <div className="flex items-center justify-between px-6 py-5">
              <h2 className="font-display text-3xl">Your basket</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="-mr-2 grid size-11 place-items-center rounded-full hover:bg-cream-200">
                <X className="size-5" />
              </button>
            </div>

            {threshold != null && items.length > 0 && (
              <div className="px-6 pb-4">
                <p className="text-sm text-ink-soft">
                  {toFree === 0 ? (
                    <>You&apos;ve unlocked <strong className="text-aubergine-700">free UK delivery</strong>.</>
                  ) : (
                    <>Add <strong className="text-aubergine-700">{formatPence(toFree!)}</strong> for free UK delivery.</>
                  )}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-cream-200">
                  <motion.div
                    className="h-full bg-gold-500"
                    animate={{ width: `${Math.min(100, (subtotal / threshold) * 100)}%` }}
                    transition={{ duration: 0.8, ease: [0.2, 0.7, 0.1, 1] }}
                  />
                </div>
              </div>
            )}

            <div className="stitch mx-6 opacity-50" />

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
                <Scissors className="size-8 text-gold-500" strokeWidth={1.25} />
                <p className="font-display mt-5 text-2xl">Nothing on the cutting table yet</p>
                <p className="mt-2 text-sm text-ink-soft">Browse our linings and interlinings, or order free swatches to feel the cloth first.</p>
                <Link href="/shop/linings" onClick={() => setOpen(false)} className="mt-8 bg-aubergine-700 px-6 py-3 text-sm text-cream-50 transition-colors hover:bg-aubergine-800">
                  Shop linings
                </Link>
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-stone-300/70 overflow-y-auto px-6">
                <AnimatePresence initial={false}>
                  {items.map((i) => {
                    const lq = lineQuote(i);
                    return (
                      <motion.li
                        key={i.key}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-4 py-5"
                      >
                        <div className="relative size-20 shrink-0 overflow-hidden bg-cream-200">
                          {i.image ? <Image src={i.image} alt="" fill sizes="80px" className="object-cover" /> : <FabricPlaceholder hex={null} name={i.name} />}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex justify-between gap-3">
                            <Link href={`/product/${i.slug}`} onClick={() => setOpen(false)} className="font-medium leading-snug hover:underline">
                              {i.name}
                            </Link>
                            <span className="shrink-0 tabular-nums">{formatPence(lq?.total ?? estimate(i))}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-ink-soft">
                            {[i.variantName, i.isSwatch ? "Swatch" : i.saleMode === "metre" ? `${formatMetres(i.lengthM ?? 0)} cut` : i.subtitle].filter(Boolean).join(", ")}
                          </p>
                          {lq?.error && <p className="mt-1 text-sm text-danger">{lq.error}</p>}
                          <div className="mt-auto flex items-center justify-between pt-3">
                            {i.isSwatch ? (
                              <span className="text-xs text-ink-soft">One per colour</span>
                            ) : (
                              <Stepper
                                value={i.quantity}
                                label={i.saleMode === "metre" ? "pieces" : "quantity"}
                                onChange={(n) => update(i.key, { quantity: n })}
                              />
                            )}
                            <button onClick={() => remove(i.key)} className="text-xs text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                              Remove
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}

            {items.length > 0 && (
              <div className="border-t border-stone-300 bg-cream-100 px-6 py-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-soft">Subtotal</span>
                  <span className="font-display text-3xl tabular-nums">{formatPence(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">Including VAT. Delivery and any codes are applied at checkout.</p>
                <Link
                  href="/checkout"
                  onClick={() => setOpen(false)}
                  className="mt-4 flex h-13 items-center justify-center bg-aubergine-700 text-cream-50 transition-colors hover:bg-aubergine-800"
                >
                  Checkout securely
                </Link>
                <button onClick={() => setOpen(false)} className="mt-2 w-full py-2 text-sm text-ink-soft hover:text-ink">
                  Continue shopping
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function estimate(i: CartItem) {
  if (i.isSwatch) return i.unitPricePence;
  return Math.round(i.unitPricePence * (i.saleMode === "metre" ? (i.lengthM ?? 0) : 1) * i.quantity);
}

export function Stepper({ value, onChange, label, min = 1, max = 999 }: { value: number; onChange: (n: number) => void; label: string; min?: number; max?: number }) {
  return (
    <div className="inline-flex h-9 items-center border border-stone-300 bg-cream-50" role="group" aria-label={label}>
      <button aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-full w-9 place-items-center disabled:opacity-30">
        <Minus className="size-3.5" />
      </button>
      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">{value}</span>
      <button aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-full w-9 place-items-center disabled:opacity-30">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
