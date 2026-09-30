"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {IconMail, IconCheck, IconMinus, IconPlus, IconScissors, IconBasket} from "@/components/icons";
import { useCart } from "@/components/cart/cart-store";
import { Stepper } from "@/components/cart/cart-drawer";
import Magnet from "@/components/reactbits/Magnet";
import { requestStockAlert, type FormState } from "@/lib/actions/shop";
import { MAX_SWATCHES, type SaleMode } from "@/lib/pricing";
import { cn, formatMetres, formatPence } from "@/lib/utils";
import { btnPrimary, btnSecondary, inputCls } from "./bits";

export type PurchaseProduct = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  saleMode: SaleMode;
  pricePence: number;
  comparePence: number | null;
  tradePricePence: number | null;
  minLength: number;
  step: number;
  maxLength: number | null;
  rollLength: number | null;
  inStock: boolean;
  lowStock: boolean;
  swatchEnabled: boolean;
  swatchPricePence: number;
  image: string | null;
};

const EPS = 1e-6;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function PurchasePanel({ p }: { p: PurchaseProduct }) {
  const { add, items, hydrated } = useCart();
  const unit = p.tradePricePence ?? p.pricePence;
  const isMetre = p.saleMode === "metre";
  const snap = (v: number) => {
    let n = Number.isFinite(v) ? v : p.minLength;
    n = Math.ceil(n / p.step - EPS) * p.step;
    n = Math.max(p.minLength, n);
    if (p.maxLength != null) n = Math.min(p.maxLength, n);
    return round2(n);
  };
  const [length, setLength] = useState(() => snap(Math.max(p.minLength, 1)));
  const [draft, setDraft] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const lengthId = useId();
  const addButtonRef = useRef<HTMLDivElement>(null);
  const [addButtonVisible, setAddButtonVisible] = useState(true);

  useEffect(() => {
    const el = addButtonRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setAddButtonVisible(e.isIntersecting), { rootMargin: "0px 0px -20% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const total = isMetre ? Math.round(unit * length * qty) : unit * qty;
  const swatchInCart = items.some((i) => i.productId === p.id && i.isSwatch);
  const swatchCount = items.filter((i) => i.isSwatch).length;
  const swatchFull = swatchCount >= MAX_SWATCHES;
  const chips = [1, 2, 5, 10].filter((c) => c >= p.minLength - EPS && (p.maxLength == null || c <= p.maxLength + EPS));

  const commit = (v: string) => {
    setDraft(null);
    setLength(snap(parseFloat(v)));
  };

  const addToBasket = () => {
    add({
      productId: p.id,
      lengthM: isMetre ? length : undefined,
      quantity: qty,
      name: p.name,
      subtitle: p.subtitle,
      slug: p.slug,
      image: p.image,
      saleMode: p.saleMode,
      unitPricePence: unit,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
    toast.success(`${p.name} added to your basket`, {
      description: isMetre ? `${qty} x ${formatMetres(length)}, cut to order` : `Quantity ${qty}`,
    });
  };

  const addSwatch = () => {
    add({
      productId: p.id,
      isSwatch: true,
      quantity: 1,
      name: p.name,
      subtitle: "Swatch",
      slug: p.slug,
      image: p.image,
      saleMode: p.saleMode,
      unitPricePence: p.swatchPricePence,
    });
    toast.success("Swatch added", { description: `${swatchCount + 1} of ${MAX_SWATCHES} swatches` });
  };

  return (
    <div>
      {/* Price */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-4xl tabular-nums md:text-5xl">{formatPence(unit)}</p>
        <p className="text-ink-soft">{isMetre ? "per metre" : p.saleMode === "roll" ? `per roll${p.rollLength ? ` of ${formatMetres(p.rollLength)}` : ""}` : "each"}</p>
        {p.tradePricePence != null ? (
          <p className="w-full text-sm">
            <span className="mr-3 border-l-2 border-gold-500 pl-2.5 font-medium text-aubergine-700">Your trade price</span>
            <span className="text-ink-soft">Retail <span className="line-through">{formatPence(p.pricePence)}</span></span>
          </p>
        ) : (
          p.comparePence != null && p.comparePence > p.pricePence && <p className="text-ink-soft line-through">{formatPence(p.comparePence)}</p>
        )}
      </div>
      <p className="mt-1 text-xs text-stone-500">Prices include VAT</p>

      <StockLine p={p} />

      {p.inStock ? (
        <div className="mt-8 space-y-7">
          {isMetre && (
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor={lengthId} className="text-sm font-medium">Length per piece</label>
                <span className="text-xs text-stone-500">
                  From {formatMetres(p.minLength)} in {p.step * 100}cm steps{p.maxLength ? `, up to ${formatMetres(p.maxLength)}` : ""}
                </span>
              </div>
              <div className="mt-3 flex h-16 items-stretch border border-stone-300 bg-cream-50 transition-colors focus-within:border-aubergine-700">
                <button
                  type="button"
                  aria-label={`Shorter by ${formatMetres(p.step)}`}
                  disabled={length <= p.minLength + EPS}
                  onClick={() => setLength((l) => snap(l - p.step))}
                  className="grid w-16 place-items-center border-r border-stone-300 transition-colors hover:bg-cream-100 disabled:opacity-30"
                >
                  <IconMinus className="size-4" />
                </button>
                <div className="relative flex flex-1 items-center justify-center">
                  <input
                    id={lengthId}
                    inputMode="decimal"
                    type="number"
                    step={p.step}
                    min={p.minLength}
                    max={p.maxLength ?? undefined}
                    value={draft ?? String(length)}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={(e) => commit(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
                    className="font-display w-24 bg-transparent text-center text-3xl tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span aria-hidden className="font-display -ml-4 text-2xl text-ink-soft">m</span>
                </div>
                <button
                  type="button"
                  aria-label={`Longer by ${formatMetres(p.step)}`}
                  disabled={p.maxLength != null && length >= p.maxLength - EPS}
                  onClick={() => setLength((l) => snap(l + p.step))}
                  className="grid w-16 place-items-center border-l border-stone-300 transition-colors hover:bg-cream-100 disabled:opacity-30"
                >
                  <IconPlus className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Quick lengths">
                {chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setDraft(null); setLength(snap(c)); }}
                    aria-pressed={Math.abs(length - c) < EPS}
                    className={cn(
                      "min-h-9 min-w-14 border px-3 text-sm tabular-nums transition-colors duration-300",
                      Math.abs(length - c) < EPS ? "border-aubergine-700 bg-aubergine-700 text-cream-50" : "border-stone-300 hover:border-aubergine-700",
                    )}
                  >
                    {c}m
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{isMetre ? "Pieces" : "Quantity"}</p>
              {isMetre && <p className="text-xs text-stone-500">Separate cuts of the same length</p>}
            </div>
            <Stepper value={qty} onChange={setQty} label={isMetre ? "pieces" : "quantity"} max={99} />
          </div>

          {/* Live total */}
          <div className="flex items-end justify-between border-y border-stone-300 py-5">
            <div className="text-sm text-ink-soft">
              {isMetre ? (
                <>
                  {qty} x {formatMetres(length)} = <span className="text-ink">{formatMetres(round2(length * qty))}</span>
                </>
              ) : (
                <>{qty} x {formatPence(unit)}</>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-ink-soft">Total</p>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={total}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="font-display text-3xl tabular-nums"
                  aria-live="polite"
                >
                  {formatPence(total)}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {isMetre && (
            <p className="flex items-start gap-2.5 text-sm text-ink-soft">
              <IconScissors className="mt-0.5 size-4 shrink-0 text-gold-600" strokeWidth={1.5} />
              <span>Cut to order by hand in London. Cut lengths are non-returnable unless faulty, so do measure twice.</span>
            </p>
          )}

          <div ref={addButtonRef} className="grid gap-3">
            <Magnet padding={40} magnetStrength={30} style={{ position: "relative", display: "block" }} innerClassName="grid">
              <button type="button" onClick={addToBasket} className={cn(btnPrimary, "min-h-14 text-base")}>
              <AnimatePresence mode="wait" initial={false}>
                {added ? (
                  <motion.span key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="inline-flex items-center gap-2">
                    <IconCheck className="size-4" /> Added to basket
                  </motion.span>
                ) : (
                  <motion.span key="add" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="inline-flex items-center gap-2">
                    <IconBasket className="size-4" strokeWidth={1.5} /> Add to basket, {formatPence(total)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            </Magnet>
            {p.swatchEnabled && <SwatchButton onClick={addSwatch} inCart={hydrated && swatchInCart} full={hydrated && swatchFull} price={p.swatchPricePence} />}
          </div>

          <div
            aria-hidden={addButtonVisible}
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-cream-50 px-4 pt-3 shadow-lift transition-transform duration-300 ease-(--ease-silk) md:hidden",
              "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              addButtonVisible && "translate-y-full",
            )}
          >
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink-soft">{p.name}</p>
                <p className="font-display text-xl leading-tight tabular-nums">{formatPence(total)}</p>
              </div>
              <button
                type="button"
                tabIndex={addButtonVisible ? -1 : 0}
                onClick={addToBasket}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-aubergine-800 px-5 text-sm font-medium text-cream-50 active:bg-aubergine-700"
              >
                <IconBasket className="size-4" strokeWidth={1.5} /> Add to basket
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <StockAlertForm productId={p.id} />
          {p.swatchEnabled && <SwatchButton onClick={addSwatch} inCart={hydrated && swatchInCart} full={hydrated && swatchFull} price={p.swatchPricePence} />}
        </div>
      )}
    </div>
  );
}

function StockLine({ p }: { p: PurchaseProduct }) {
  const [dot, text] = !p.inStock
    ? ["bg-danger", "Sold out for now"]
    : p.lowStock
      ? ["bg-gold-500", "Low stock, order soon"]
      : ["bg-success", "In stock, dispatched in 1 to 2 working days"];
  return (
    <p className="mt-6 flex items-center gap-2.5 text-sm">
      <span className="relative flex size-2">
        {p.inStock && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-50", dot)} />}
        <span className={cn("relative inline-flex size-2 rounded-full", dot)} />
      </span>
      {text}
    </p>
  );
}

function SwatchButton({ onClick, inCart, full, price }: { onClick: () => void; inCart: boolean; full: boolean; price: number }) {
  return (
    <button type="button" onClick={onClick} disabled={inCart || full} className={btnSecondary}>
      {inCart ? (
        <><IconCheck className="size-4" /> Swatch in your basket</>
      ) : full ? (
        <>Swatch limit reached ({MAX_SWATCHES})</>
      ) : (
        <>{`Order a swatch, ${price > 0 ? formatPence(price) : "free"}`}</>
      )}
    </button>
  );
}

export function StockAlertForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestStockAlert, null);
  const id = useId();
  if (state?.ok)
    return (
      <div className="flex items-start gap-3 border border-success/30 bg-success/5 p-5 text-sm" role="status">
        <IconCheck className="mt-0.5 size-4 text-success" /> {state.message}
      </div>
    );
  return (
    <form action={action} className="border border-stone-300 bg-cream-50 p-5">
      <p className="flex items-center gap-2 font-medium"><IconMail className="size-4 text-gold-600" strokeWidth={1.5} /> Email me when it&apos;s back</p>
      <p className="mt-1 text-sm text-ink-soft">One email, the day it&apos;s restocked. Nothing else.</p>
      <input type="hidden" name="productId" value={productId} />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={id} className="sr-only">Email address</label>
        <input id={id} name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={inputCls} aria-invalid={state ? !state.ok : undefined} />
        <button className={cn(btnPrimary, "shrink-0")} disabled={pending}>{pending ? "Saving..." : "Notify me"}</button>
      </div>
      {state && !state.ok && <p className="mt-2 text-sm text-danger" role="alert">{state.message}</p>}
    </form>
  );
}
