"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { AnimatePresence, motion } from "motion/react";
import { quoteCart, type CartQuote } from "@/lib/actions/cart";
import { createOrder, type CheckoutInput, type CreateOrderResult } from "@/lib/actions/checkout";
import { isUkPhone } from "@/lib/checkout/helpers";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { IconCard, IconDocument, IconLock, IconSpinner } from "@/components/icons";
import { cn, formatPence } from "@/lib/utils";

export type PaymentMethod = "card" | "paypal" | "invoice";
type ServerError = Extract<CreateOrderResult, { ok: false }>;

type Lines = CheckoutInput["lines"];

/* ───────────────────────────────────────────── Express (Apple Pay / Google Pay) */

export function ExpressCheckout({
  quote,
  fulfilment,
  lines,
  appliedCode,
  collectionAddress,
  onRateChange,
  onServerError,
  disabled,
}: {
  quote: CartQuote;
  fulfilment: "delivery" | "collection";
  lines: Lines;
  appliedCode: string | null;
  collectionAddress: string | null;
  onRateChange: (id: string) => void;
  onServerError: (e: ServerError) => void;
  disabled: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amount = useRef(quote.total);
  const rate = useRef(quote.selectedRateId);

  useEffect(() => {
    amount.current = quote.total;
    rate.current = quote.selectedRateId;
  }, [quote.total, quote.selectedRateId]);

  const shippingRates = () => {
    const rates = quote.rates.map((r) => ({ id: r.id, displayName: r.name, amount: r.price }));
    // Wallets treat the first rate as the default, so lead with the one already chosen.
    return rates.sort((a, b) => (a.id === rate.current ? -1 : b.id === rate.current ? 1 : 0));
  };

  async function onConfirm(event: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements) return;
    setError(null);
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Please try again.");
      return;
    }
    const b = event.billingDetails;
    const s = event.shippingAddress;
    const phone = b?.phone && isUkPhone(b.phone) ? b.phone : "";
    const res = await createOrder({
      lines,
      fulfilment,
      rateId: fulfilment === "delivery" ? (event.shippingRate?.id ?? rate.current) : null,
      discountCode: appliedCode,
      email: b?.email ?? "",
      provider: "stripe",
      contactName: s?.name ?? b?.name ?? "",
      contactPhone: phone,
      address:
        fulfilment === "delivery" && s
          ? {
              fullName: s.name ?? b?.name ?? "",
              line1: s.address.line1 ?? "",
              line2: s.address.line2 ?? "",
              city: s.address.city ?? "",
              county: s.address.state ?? "",
              postcode: s.address.postal_code ?? "",
              phone,
            }
          : null,
      note: "",
    });
    if (!res.ok) {
      event.paymentFailed({ reason: res.fields && Object.keys(res.fields).some((k) => k.startsWith("address")) ? "invalid_shipping_address" : "fail" });
      setError(res.error);
      onServerError(res);
      return;
    }
    // Never charge a different amount from the one the wallet sheet showed.
    if (res.total !== amount.current) {
      event.paymentFailed({ reason: "fail" });
      setError(`Your total has been updated to ${formatPence(res.total)}. Please review your order and try again.`);
      onServerError({ ok: false, error: "Your total has changed. Please review it below.", requote: true });
      return;
    }
    const { error: payError } = await stripe.confirmPayment({
      elements,
      clientSecret: res.clientSecret!,
      confirmParams: { return_url: `${window.location.origin}${res.successUrl}` },
    });
    if (payError) setError(payError.message ?? "Your payment could not be completed.");
  }

  if (ready === false) return null;

  return (
    <section aria-label="Express checkout" className={cn("pb-9 transition-opacity", ready === null && "pointer-events-none opacity-0", disabled && "pointer-events-none opacity-50")}>
      <h2 className="mb-4 text-sm font-medium">Express checkout</h2>
      <ExpressCheckoutElement
        options={{
          buttonHeight: 48,
          buttonType: { applePay: "buy", googlePay: "buy" },
          buttonTheme: { applePay: "black", googlePay: "black" },
          paymentMethods: { link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
          layout: { maxColumns: 2, maxRows: 1, overflow: "never" },
        }}
        onReady={(e) => setReady(Boolean(e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean)))}
        onClick={(e) => {
          if (disabled) return e.reject();
          e.resolve({
            emailRequired: true,
            phoneNumberRequired: true,
            shippingAddressRequired: fulfilment === "delivery",
            allowedShippingCountries: ["GB"],
            ...(fulfilment === "delivery" ? { shippingRates: shippingRates() } : {}),
            business: { name: "British Quilting" },
          });
        }}
        onShippingAddressChange={(e) => (e.address.country === "GB" ? e.resolve() : e.reject())}
        onShippingRateChange={async (e) => {
          const res = await quoteCart({ lines, fulfilment: "delivery", rateId: e.shippingRate.id, discountCode: appliedCode });
          if (!res.ok || !res.valid) return e.reject();
          elements?.update({ amount: res.total });
          amount.current = res.total;
          rate.current = e.shippingRate.id;
          onRateChange(e.shippingRate.id);
          e.resolve();
        }}
        onConfirm={onConfirm}
      />
      {error && <FormMessage className="mt-4">{error}</FormMessage>}
      {fulfilment === "collection" && collectionAddress && (
        <p className="mt-3 text-sm text-ink-soft">Express orders will be set aside for collection from {collectionAddress.split("\n")[0]}.</p>
      )}
      <div className="mt-8 flex items-center gap-4 text-sm text-ink-soft" aria-hidden>
        <span className="h-px flex-1 bg-stone-300" />
        or complete your details below
        <span className="h-px flex-1 bg-stone-300" />
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────── Payment method list */

type SectionProps = {
  method: PaymentMethod;
  setMethod: (m: PaymentMethod) => void;
  payments: { stripeKey: string | null; paypalClientId: string | null };
  isTrade: boolean;
  invoiceTermsDays: number;
  total: number | null;
  canPay: boolean;
  checkForm: () => boolean;
  buildInput: (p: CheckoutInput["provider"]) => CheckoutInput;
  onServerError: (e: ServerError) => void;
  formError: string | null;
  setFormError: React.Dispatch<React.SetStateAction<string | null>>;
};

export function PaymentSection(p: SectionProps) {
  const cardOn = Boolean(p.payments.stripeKey);
  const paypalOn = Boolean(p.payments.paypalClientId);

  if (!cardOn && !paypalOn && !p.isTrade) {
    return (
      <FormMessage tone="info">
        Online payment is being set up and will be available very shortly. In the meantime, please{" "}
        <a href="/contact" className="underline underline-offset-4">contact us</a> and we&apos;ll take your order by phone or email. Your basket is saved.
      </FormMessage>
    );
  }

  const options: { id: PaymentMethod; label: string; sub: string; available: boolean; icon: React.ReactNode; show: boolean }[] = [
    { id: "card", label: "Card", sub: "Visa, Mastercard, Amex", available: cardOn, icon: <IconCard className="size-5" />, show: true },
    { id: "paypal", label: "PayPal", sub: "Pay with your PayPal account", available: paypalOn, icon: <PayPalMark />, show: true },
    { id: "invoice", label: "Pay by invoice", sub: `Trade account, ${p.invoiceTermsDays} day terms`, available: true, icon: <IconDocument className="size-5" />, show: p.isTrade },
  ];

  return (
    <div>
      <div role="radiogroup" aria-label="Payment method" className="divide-y divide-stone-300 border-y border-stone-300">
        {options
          .filter((o) => o.show)
          .map((o) => {
            const active = p.method === o.id && o.available;
            return (
              <div key={o.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-disabled={!o.available}
                  aria-controls={`pay-${o.id}`}
                  onClick={() => {
                    if (!o.available) return;
                    p.setMethod(o.id);
                    p.setFormError(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-4 px-1 py-4 text-left transition-colors duration-200",
                    active ? "bg-cream-50" : o.available ? "hover:bg-cream-50/60" : "cursor-not-allowed",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("grid size-5 shrink-0 place-items-center rounded-full border", active ? "border-aubergine-700" : "border-stone-500/60", !o.available && "opacity-40")}
                  >
                    <span className={cn("size-2.5 rounded-full bg-aubergine-700 transition-transform", active ? "scale-100" : "scale-0")} />
                  </span>
                  <span className={cn("min-w-0 flex-1", !o.available && "opacity-55")}>
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-sm text-ink-soft">{o.available ? o.sub : "Temporarily unavailable. Please choose another method."}</span>
                  </span>
                  <span className={cn("text-ink-soft", !o.available && "opacity-40")}>{o.icon}</span>
                </button>
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.div
                      id={`pay-${o.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.1, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-1 pb-6 pt-2">
                        {o.id === "card" && <CardPay {...p} />}
                        {o.id === "paypal" && <PayPalPay {...p} />}
                        {o.id === "invoice" && <InvoicePay {...p} />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
      </div>
      <p className="mt-5 text-xs leading-relaxed text-ink-soft">
        By placing your order you agree to our{" "}
        <a href="/legal/terms" className="underline underline-offset-2 hover:text-ink">terms of sale</a> and{" "}
        <a href="/legal/privacy" className="underline underline-offset-2 hover:text-ink">privacy policy</a>. Cut lengths are made to order; see our{" "}
        <a href="/help/returns" className="underline underline-offset-2 hover:text-ink">returns policy</a>.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────── Card */

function CardPay({ total, canPay, checkForm, buildInput, onServerError, formError, setFormError }: SectionProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripe || !elements || busy) return;
    if (!checkForm()) return;
    setBusy(true);
    setFormError(null);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setFormError(submitError.message ?? "Please check your card details.");
        return;
      }
      const res = await createOrder(buildInput("stripe"));
      if (!res.ok) {
        onServerError(res);
        return;
      }
      if (total != null && res.total !== total) {
        onServerError({ ok: false, error: `Your total has been updated to ${formatPence(res.total)}. Please check it and pay again.`, requote: true });
        return;
      }
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret: res.clientSecret!,
        confirmParams: { return_url: `${window.location.origin}${res.successUrl}` },
      });
      // Only reached on an immediate error; success redirects to return_url.
      if (error) setFormError(error.type === "card_error" || error.type === "validation_error" ? (error.message ?? "Your card was declined.") : "Something went wrong taking payment. You have not been charged. Please try again.");
    } catch (e) {
      console.error(e);
      setFormError("Something went wrong taking payment. You have not been charged. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={cn("min-h-[180px] transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}>
        <PaymentElement
          onReady={() => setReady(true)}
          onLoadError={() => setFormError("Card payment couldn't load. Please refresh the page or choose PayPal.")}
          options={{
            layout: { type: "tabs" },
            wallets: { applePay: "never", googlePay: "never" },
            fields: { billingDetails: { address: { country: "never" } } },
            defaultValues: { billingDetails: { address: { country: "GB" } } },
          }}
        />
      </div>
      {!ready && (
        <p className="-mt-[180px] flex h-[180px] items-center justify-center gap-2 text-sm text-ink-soft">
          <IconSpinner className="size-4 animate-spin" /> Loading secure card form
        </p>
      )}
      {formError && <FormMessage className="mt-5">{formError}</FormMessage>}
      <Button size="lg" className="mt-6 w-full" onClick={pay} loading={busy} disabled={!canPay || !ready || !stripe}>
        {busy ? "Processing payment" : (<><IconLock className="size-4" /> Pay {total != null ? formatPence(total) : ""}</>)}
      </Button>
    </div>
  );
}

/* ───────────────────────────────────────────── PayPal */

function PayPalPay(p: SectionProps) {
  return (
    <PayPalScriptProvider
      options={{
        clientId: p.payments.paypalClientId!,
        currency: "GBP",
        intent: "capture",
        components: "buttons",
        disableFunding: "card,credit,paylater",
        locale: "en_GB",
      }}
    >
      <PayPalInner {...p} />
    </PayPalScriptProvider>
  );
}

function PayPalInner({ total, canPay, checkForm, buildInput, onServerError, formError, setFormError }: SectionProps) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const router = useRouter();
  const [capturing, setCapturing] = useState(false);
  const expected = useRef(total);
  useEffect(() => {
    expected.current = total;
  }, [total]);

  if (isRejected)
    return <FormMessage>PayPal couldn&apos;t load. Please check your connection, or pay by card instead.</FormMessage>;

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">You&apos;ll confirm the payment in a PayPal window, then return here.</p>
      {isPending && (
        <p className="flex h-12 items-center gap-2 text-sm text-ink-soft">
          <IconSpinner className="size-4 animate-spin" /> Loading PayPal
        </p>
      )}
      {capturing ? (
        <p className="flex h-12 items-center gap-2 text-sm" role="status">
          <IconSpinner className="size-4 animate-spin" /> Confirming your payment with PayPal
        </p>
      ) : (
        <div className={cn(!canPay && "pointer-events-none opacity-50")}>
          <PayPalButtons
            style={{ layout: "vertical", color: "black", shape: "rect", label: "pay", height: 48, tagline: false }}
            disabled={!canPay}
            forceReRender={[total, canPay]}
            onClick={(_, actions) => {
              setFormError(null);
              return checkForm() ? actions.resolve() : actions.reject();
            }}
            createOrder={async () => {
              const res = await createOrder(buildInput("paypal"));
              if (!res.ok) {
                onServerError(res);
                throw new Error(res.error);
              }
              if (expected.current != null && res.total !== expected.current) {
                onServerError({ ok: false, error: `Your total has been updated to ${formatPence(res.total)}. Please check it and pay again.`, requote: true });
                throw new Error("total changed");
              }
              return res.paypalOrderId!;
            }}
            onApprove={async (data) => {
              setCapturing(true);
              try {
                const r = await fetch("/api/paypal/capture", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ paypalOrderId: data.orderID }),
                });
                const json = (await r.json()) as { ok: boolean; successUrl?: string; error?: string };
                if (json.ok && json.successUrl) {
                  router.push(json.successUrl);
                  return;
                }
                setFormError(json.error ?? "PayPal couldn't complete the payment. You have not been charged.");
              } catch {
                setFormError("We lost connection while confirming your PayPal payment. Please check your email before trying again.");
              }
              setCapturing(false);
            }}
            onCancel={() => setFormError("PayPal payment cancelled. You have not been charged.")}
            onError={(err) => {
              console.error("paypal", err);
              setFormError((prev) => prev ?? "PayPal ran into a problem. You have not been charged. Please try again or pay by card.");
            }}
          />
        </div>
      )}
      {formError && <FormMessage className="mt-4">{formError}</FormMessage>}
    </div>
  );
}

function PayPalMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
      <path d="M8.2 21H4.6a.5.5 0 0 1-.5-.6L6.9 3.5A.9.9 0 0 1 7.8 3h6c3.3 0 5.1 1.7 4.6 4.6-.6 3.6-3 5.2-6.4 5.2H10a.8.8 0 0 0-.8.7L8.2 21Z" opacity=".55" />
      <path d="M19.4 8.2c-.7 3.7-3.2 5.3-6.6 5.3h-1.6a.8.8 0 0 0-.8.7l-.9 5.5-.2 1.3H12a.7.7 0 0 0 .7-.6l.1-.4.6-3.8v-.2a.7.7 0 0 1 .7-.6h.5c2.9 0 5.1-1.2 5.8-4.6.3-1.4.1-2.6-.6-3.4l-.4.8Z" />
    </svg>
  );
}

/* ───────────────────────────────────────────── Invoice (approved trade only; the server re-checks) */

function InvoicePay({ total, canPay, checkForm, buildInput, onServerError, formError, setFormError, invoiceTermsDays }: SectionProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function place() {
    if (busy || !checkForm()) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await createOrder(buildInput("invoice"));
      if (!res.ok) {
        onServerError(res);
        setBusy(false);
        return;
      }
      router.push(res.successUrl);
    } catch {
      setFormError("We couldn't place your order just now. Please try again.");
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-soft">
        We&apos;ll prepare your order straight away and email an invoice with our bank details. Payment is due within {invoiceTermsDays} days.
      </p>
      {formError && <FormMessage className="mt-4">{formError}</FormMessage>}
      <Button size="lg" className="mt-6 w-full" onClick={place} loading={busy} disabled={!canPay}>
        Place order on account{total != null ? `, ${formatPence(total)}` : ""}
      </Button>
    </div>
  );
}
