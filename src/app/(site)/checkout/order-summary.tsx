"use client";

import Image from "next/image";
import type { CartItem } from "@/components/cart/cart-store";
import type { CartQuote } from "@/lib/actions/cart";
import { IconClose, IconLock, IconParcel, IconScissors, IconTag } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatMetres, formatPence } from "@/lib/utils";

type CodeState = {
  input: string;
  setInput: (v: string) => void;
  applied: string | null;
  error: string | null;
  busy: boolean;
  apply: () => void;
  remove: () => void;
};

/** The order set out like a cutting-room receipt: hairline rules, tabular figures, one strong total. */
export function OrderSummary({
  items,
  quote,
  quoting,
  quoteError,
  fulfilment,
  code,
  idPrefix,
}: {
  items: CartItem[];
  quote: CartQuote | null;
  quoting: boolean;
  quoteError: string | null;
  fulfilment: "delivery" | "collection";
  code: CodeState;
  idPrefix: string;
}) {
  const lineQuote = (i: CartItem) =>
    quote?.lines.find((l) => l.productId === i.productId && l.isSwatch === Boolean(i.isSwatch) && (i.isSwatch || l.lengthM === i.lengthM));
  const codeId = `${idPrefix}-discount`;
  const deliveryLabel =
    fulfilment === "collection"
      ? "Click & collect"
      : (quote?.rates.find((r) => r.id === quote.selectedRateId)?.name ?? "Delivery");

  return (
    <div className="bg-cream-50 px-5 pb-6 pt-5 shadow-soft md:px-7">
      <div className="flex items-baseline justify-between border-b-2 border-aubergine-900 pb-3">
        <h2 className="font-display text-2xl">Your order</h2>
        <span className="text-sm text-ink-soft">
          {items.length} {items.length === 1 ? "line" : "lines"}
        </span>
      </div>

      <ul className="divide-y divide-stone-300/80">
        {items.map((i) => {
          const lq = lineQuote(i);
          return (
            <li key={i.key} className="flex gap-4 py-4">
              <div className="relative size-16 shrink-0 overflow-hidden bg-cream-200">
                {i.image && <Image src={i.image} alt="" fill sizes="64px" className="object-cover" />}
                {!i.isSwatch && i.quantity > 1 && (
                  <span className="absolute right-0 top-0 bg-aubergine-900 px-1.5 text-xs tabular-nums text-cream-50">x{i.quantity}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{i.name}</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {i.isSwatch
                    ? "Swatch"
                    : i.saleMode === "metre"
                      ? `${formatMetres(i.lengthM ?? 0)} cut${i.quantity > 1 ? `, ${i.quantity} pieces` : ""}`
                      : i.subtitle ?? `Qty ${i.quantity}`}
                </p>
                {lq?.error && <p className="mt-1 text-sm text-danger">{lq.error}</p>}
              </div>
              <span className={cn("shrink-0 text-sm tabular-nums", !lq && "text-stone-500")}>
                {lq ? (lq.error ? "..." : lq.total === 0 ? "Free" : formatPence(lq.total)) : "..."}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Discount code */}
      <div className="border-t border-stone-300 pt-4">
        {code.applied ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <IconTag className="size-4 text-gold-600" />
              Code <strong className="font-medium tracking-wide">{code.applied}</strong> applied
            </span>
            <button type="button" onClick={code.remove} className="inline-flex items-center gap-1 text-ink-soft hover:text-ink" aria-label={`Remove code ${code.applied}`}>
              <IconClose className="size-3.5" /> Remove
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              code.apply();
            }}
          >
            <label htmlFor={codeId} className="mb-1.5 block text-sm font-medium">
              Discount code
            </label>
            <div className="flex gap-2">
              <Input
                id={codeId}
                value={code.input}
                onChange={(e) => code.setInput(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="uppercase"
                maxLength={40}
                aria-invalid={Boolean(code.error) || undefined}
                aria-describedby={code.error ? `${codeId}-msg` : undefined}
              />
              <Button type="submit" variant="secondary" loading={code.busy} disabled={!code.input.trim()} className="h-12 px-5">
                Apply
              </Button>
            </div>
            {code.error && (
              <p id={`${codeId}-msg`} role="alert" className="mt-1.5 text-sm text-danger">
                {code.error}
              </p>
            )}
          </form>
        )}
      </div>

      {/* Totals */}
      <dl className={cn("mt-5 space-y-2 border-t border-stone-300 pt-4 text-sm transition-opacity", quoting && "opacity-60")} aria-live="polite" aria-busy={quoting}>
        <Row label="Subtotal" value={quote ? formatPence(quote.subtotal) : null} />
        {quote && quote.discount > 0 && <Row label={`Discount${quote.discountCode ? ` (${quote.discountCode})` : ""}`} value={`-${formatPence(quote.discount)}`} accent />}
        <Row
          label={deliveryLabel}
          value={quote ? (fulfilment === "collection" || quote.shipping === 0 ? "Free" : formatPence(quote.shipping)) : null}
        />
        <div className="flex items-baseline justify-between border-t-2 border-aubergine-900 pt-4">
          <dt className="font-medium">Total</dt>
          <dd className="font-display text-4xl tabular-nums">{quote ? formatPence(quote.total) : <Placeholder w="w-28" h="h-9" />}</dd>
        </div>
        <p className="text-right text-xs text-ink-soft">
          {quote ? (quote.vatRate > 0 ? `Includes ${formatPence(quote.vat)} VAT at ${quote.vatRate}%` : "No VAT charged") : "Including VAT"}
        </p>
      </dl>

      {quoteError && <p role="alert" className="mt-4 text-sm text-danger">{quoteError}</p>}

      {quote && fulfilment === "delivery" && quote.freeThreshold != null && quote.subtotal - quote.discount < quote.freeThreshold && (
        <p className="mt-4 border-l-2 border-gold-500 pl-3 text-sm text-ink-soft">
          Spend {formatPence(quote.freeThreshold - (quote.subtotal - quote.discount))} more for free standard delivery.
        </p>
      )}

      <ul className="mt-6 space-y-3 border-t border-stone-300 pt-5 text-sm text-ink-soft">
        <li className="flex gap-3">
          <IconLock className="mt-0.5 size-4 shrink-0 text-gold-600" />
          <span>Encrypted payment. Card details go straight to Stripe and never touch our servers.</span>
        </li>
        <li className="flex gap-3">
          <IconScissors className="mt-0.5 size-4 shrink-0 text-gold-600" />
          <span>Measured twice and cut by hand in our London workroom.</span>
        </li>
        <li className="flex gap-3">
          <IconParcel className="mt-0.5 size-4 shrink-0 text-gold-600" />
          <span>Dispatched in one to two working days with tracking.</span>
        </li>
      </ul>
      <p className="mt-5 text-xs tracking-wide text-stone-500">Visa · Mastercard · Amex · Apple Pay · Google Pay · PayPal</p>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={cn("tabular-nums", accent && "text-success")}>{value ?? <Placeholder />}</dd>
    </div>
  );
}

function Placeholder({ w = "w-14", h = "h-4" }: { w?: string; h?: string }) {
  return <span className={cn("inline-block animate-pulse bg-cream-200 align-middle", w, h)} aria-label="Calculating" />;
}
