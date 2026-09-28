"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/components/cart/cart-store";
import { quoteCart, type CartQuote } from "@/lib/actions/cart";
import type { CheckoutInput } from "@/lib/actions/checkout";
import { isUkPhone, isValidUkPostcode, normalisePostcode } from "@/lib/checkout/helpers";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { RadioCard } from "@/components/ui/choice";
import { Disclosure } from "@/components/ui/disclosure";
import { ButtonLink } from "@/components/ui/button";
import { IconBasket, IconCheck, IconChevronDown, IconLock, IconPin, IconVan } from "@/components/icons";
import { cn, formatPence } from "@/lib/utils";
import { OrderSummary } from "./order-summary";
import { PaymentSection, ExpressCheckout, type PaymentMethod } from "./payment";

export type SavedAddress = {
  id: string;
  label: string | null;
  full_name: string;
  line1: string;
  line2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  phone: string | null;
  is_default: boolean;
};

export type CheckoutViewer = { email: string; fullName: string | null; phone: string | null; isTrade: boolean };

type Props = {
  viewer: CheckoutViewer | null;
  addresses: SavedAddress[];
  collection: { address: string; hours: string | null } | null;
  invoiceTermsDays: number;
  payments: { stripeKey: string | null; paypalClientId: string | null };
};

export type AddressForm = { fullName: string; line1: string; line2: string; city: string; county: string; postcode: string; phone: string };
const emptyAddress: AddressForm = { fullName: "", line1: "", line2: "", city: "", county: "", postcode: "", phone: "" };
export type Errors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let stripePromise: Promise<Stripe | null> | null = null;
const getStripePromise = (key: string) => (stripePromise ??= loadStripe(key).catch(() => null));

const appearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#4a1d5c",
    colorBackground: "#fbf8f2",
    colorText: "#1d1720",
    colorTextSecondary: "#4b4250",
    colorDanger: "#9b2c2c",
    borderRadius: "2px",
    fontSizeBase: "15px",
    spacingUnit: "4px",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  rules: {
    ".Input": { border: "1px solid #d9d0bf", boxShadow: "none", padding: "12px 14px" },
    ".Input:focus": { border: "1px solid #74418b", boxShadow: "0 0 0 3px rgba(181,148,196,0.35)" },
    ".Input--invalid": { border: "1px solid #9b2c2c" },
    ".Label": { fontWeight: "500", color: "#1d1720", marginBottom: "6px" },
    ".Tab": { border: "1px solid #d9d0bf", boxShadow: "none" },
    ".Tab--selected": { border: "1px solid #4a1d5c", boxShadow: "none" },
  },
};

export function CheckoutClient({ viewer, addresses, collection, invoiceTermsDays, payments }: Props) {
  const { items, hydrated } = useCart();

  const lines = useMemo(() => items.map(({ productId, lengthM, quantity, isSwatch }) => ({ productId, lengthM, quantity, isSwatch })), [items]);
  const linesKey = JSON.stringify(lines);

  // Form state
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [quoteEmail, setQuoteEmail] = useState(viewer?.email ?? "");
  const [fulfilment, setFulfilment] = useState<"delivery" | "collection">("delivery");
  const defaultAddress = addresses[0] ?? null;
  const [savedId, setSavedId] = useState<string | "new">(defaultAddress?.id ?? "new");
  const [address, setAddress] = useState<AddressForm>(
    defaultAddress ? fromSaved(defaultAddress) : { ...emptyAddress, fullName: viewer?.fullName ?? "", phone: viewer?.phone ?? "" },
  );
  const [collectName, setCollectName] = useState(viewer?.fullName ?? "");
  const [collectPhone, setCollectPhone] = useState(viewer?.phone ?? "");
  const [note, setNote] = useState("");
  const [rateId, setRateId] = useState<string | null>(null);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(payments.stripeKey ? "card" : payments.paypalClientId ? "paypal" : viewer?.isTrade ? "invoice" : "card");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Server quote
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const seq = useRef(0);

  const requote = useCallback(
    async (overrides?: { rateId?: string | null; code?: string | null }) => {
      const id = ++seq.current;
      setQuoting(true);
      const res = await quoteCart({
        lines,
        fulfilment,
        rateId: overrides && "rateId" in overrides ? overrides.rateId : rateId,
        discountCode: overrides && "code" in overrides ? overrides.code : appliedCode,
        email: EMAIL.test(quoteEmail) ? quoteEmail : null,
      });
      if (id !== seq.current) return null;
      setQuoting(false);
      if (!res.ok) {
        setQuoteError(res.error);
        return null;
      }
      setQuoteError(null);
      setQuote(res);
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linesKey, fulfilment, rateId, appliedCode, quoteEmail],
  );

  useEffect(() => {
    if (!hydrated || lines.length === 0) return;
    // Short debounce so quick edits (quantity steps, typing) collapse into one server quote.
    const t = setTimeout(() => {
      void requote().then((res) => {
        // A code that stopped being valid (e.g. once-per-customer after entering email) is dropped with a message.
        if (res && appliedCode && !res.discountCode) {
          setCodeError(res.discountError ?? "That code no longer applies.");
          setAppliedCode(null);
        }
      });
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, requote]);

  async function applyCode() {
    const code = codeInput.trim();
    if (!code) return;
    setCodeBusy(true);
    setCodeError(null);
    const res = await requote({ code });
    setCodeBusy(false);
    if (!res) return;
    if (res.discountCode) {
      setAppliedCode(res.discountCode);
      setCodeInput("");
    } else {
      setCodeError(res.discountError ?? "That code isn't valid.");
    }
  }

  function removeCode() {
    setAppliedCode(null);
    setCodeError(null);
  }

  const selectedRateId = fulfilment === "delivery" ? (quote?.selectedRateId ?? null) : null;

  /* ─────────── validation mirrors the server so errors appear before any network call */
  const validate = useCallback((): Errors => {
    const e: Errors = {};
    if (!EMAIL.test(email.trim())) e.email = "Please enter a valid email address.";
    if (fulfilment === "delivery") {
      if (address.fullName.trim().length < 2) e["address.fullName"] = "Please enter the recipient's name.";
      if (address.line1.trim().length < 2) e["address.line1"] = "Please enter the first line of the address.";
      if (address.city.trim().length < 2) e["address.city"] = "Please enter a town or city.";
      if (!isValidUkPostcode(address.postcode)) e["address.postcode"] = "Please enter a valid UK postcode.";
      if (address.phone.trim() && !isUkPhone(address.phone)) e["address.phone"] = "Please enter a UK phone number.";
      if (!selectedRateId) e.rate = "Please choose a delivery option.";
    } else {
      if (collectName.trim().length < 2) e.contactName = "Please enter the name of the person collecting.";
      if (collectPhone.trim() && !isUkPhone(collectPhone)) e.contactPhone = "Please enter a UK phone number.";
    }
    return e;
  }, [email, fulfilment, address, collectName, collectPhone, selectedRateId]);

  const focusFirstError = (e: Errors) => {
    const first = Object.keys(e)[0];
    if (!first) return;
    const el = document.getElementById(`f-${first.replace(".", "-")}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /** Returns true when the form is ready to pay; shows errors otherwise. */
  const checkForm = useCallback(() => {
    const e = validate();
    setErrors(e);
    setFormError(Object.keys(e).length ? "Please check the highlighted details." : null);
    if (Object.keys(e).length) focusFirstError(e);
    return Object.keys(e).length === 0;
  }, [validate]);

  const buildInput = useCallback(
    (provider: CheckoutInput["provider"]): CheckoutInput => ({
      lines,
      fulfilment,
      rateId: selectedRateId,
      discountCode: appliedCode,
      email: email.trim(),
      provider,
      contactName: fulfilment === "delivery" ? address.fullName.trim() : collectName.trim(),
      contactPhone: fulfilment === "delivery" ? address.phone.trim() : collectPhone.trim(),
      address: fulfilment === "delivery" ? { ...address, postcode: normalisePostcode(address.postcode) } : null,
      note,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linesKey, fulfilment, selectedRateId, appliedCode, email, address, collectName, collectPhone, note],
  );

  /** Server rejected: show field errors and refresh the quote when prices may have moved. */
  const onServerError = useCallback(
    (res: { error: string; fields?: Record<string, string>; requote?: boolean }) => {
      setFormError(res.error);
      if (res.fields) {
        setErrors(res.fields);
        if (res.fields.discountCode) {
          setCodeError(res.fields.discountCode);
          setAppliedCode(null);
        }
        focusFirstError(res.fields);
      }
      if (res.requote) void requote();
    },
    [requote],
  );

  const clearError = (key: string) =>
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });

  /* ─────────── states */
  if (!hydrated) return <CheckoutSkeleton />;
  if (items.length === 0) return <EmptyCheckout />;

  const hasErrors = quote?.lines.some((l) => l.error) ?? false;
  const canPay = Boolean(quote?.valid) && !quoting;
  const stripeEnabled = Boolean(payments.stripeKey);

  const content = (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-24 md:px-8 md:pt-32 lg:pb-24 [&_input:not([type=radio]):not([type=checkbox])]:h-12">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-2 border-aubergine-900 pb-4 md:pb-5">
        <div>
          <nav aria-label="Breadcrumb" className="mb-3 hidden text-sm text-ink-soft md:block">
            <Link href="/" className="hover:text-ink hover:underline">Shop</Link>
            <span className="mx-2 text-stone-500">/</span>
            <span aria-current="page" className="text-ink">Checkout</span>
          </nav>
          <h1 className="font-display text-3xl md:text-5xl">Checkout</h1>
        </div>
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <IconLock className="size-4 text-gold-600" /> Secure, encrypted payment
        </p>
      </header>

      {/* Mobile summary disclosure */}
      <MobileSummary total={quote?.total ?? null}>
        <OrderSummary
          items={items}
          quote={quote}
          quoting={quoting}
          quoteError={quoteError}
          fulfilment={fulfilment}
          code={{ input: codeInput, setInput: setCodeInput, applied: appliedCode, error: codeError, busy: codeBusy, apply: applyCode, remove: removeCode }}
          idPrefix="m"
        />
      </MobileSummary>

      <div className="mt-2 grid gap-12 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
        <div className="min-w-0">
          {stripeEnabled && quote && quote.total > 0 && (
            <ExpressCheckout
              quote={quote}
              fulfilment={fulfilment}
              lines={lines}
              appliedCode={appliedCode}
              collectionAddress={collection?.address ?? null}
              onRateChange={setRateId}
              onServerError={onServerError}
              disabled={!canPay}
            />
          )}

          {/* 01 Contact */}
          <Step n="01" title="Contact" id="step-contact">
            {viewer ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-stone-300 bg-cream-50 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink-soft">Signed in as</p>
                  <p className="truncate font-medium">{viewer.email}</p>
                </div>
                {viewer.isTrade && <span className="text-sm text-aubergine-700">Trade prices applied</span>}
              </div>
            ) : (
              <>
                <Field id="f-email" label="Email address" error={errors.email} hint="For your order confirmation and delivery updates.">
                  <Input
                    id="f-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    aria-invalid={Boolean(errors.email) || undefined}
                    aria-describedby="f-email-msg"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearError("email");
                    }}
                    onBlur={() => setQuoteEmail(email.trim())}
                  />
                </Field>
                <p className="mt-3 text-sm text-ink-soft">
                  Have an account?{" "}
                  <Link href="/login?next=/checkout" className="text-aubergine-700 underline underline-offset-4 hover:text-aubergine-900">
                    Sign in
                  </Link>{" "}
                  for saved addresses and trade prices.
                </p>
              </>
            )}
          </Step>

          {/* 02 Delivery */}
          <Step n="02" title="Delivery" id="step-delivery">
            {collection && (
              <div role="radiogroup" aria-label="How would you like to receive your order?" className="grid grid-cols-2 border border-stone-300">
                {(
                  [
                    { v: "delivery", label: "Delivery", sub: "Tracked across the UK", Icon: IconVan },
                    { v: "collection", label: "Click & collect", sub: "Free, from London", Icon: IconPin },
                  ] as const
                ).map(({ v, label, sub, Icon }, i) => {
                  const active = fulfilment === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setFulfilment(v);
                        setErrors({});
                      }}
                      className={cn(
                        "relative flex items-center gap-3 px-4 py-4 text-left transition-colors duration-300",
                        i === 1 && "border-l border-stone-300",
                        active ? "bg-cream-50 text-ink" : "text-ink-soft hover:bg-cream-50/60",
                      )}
                    >
                      <Icon className={cn("size-5 shrink-0", active ? "text-aubergine-700" : "text-stone-500")} />
                      <span>
                        <span className="block font-medium text-ink">{label}</span>
                        <span className="block text-sm">{sub}</span>
                      </span>
                      {active && <motion.span layoutId="fulfil-rule" className="absolute inset-x-0 bottom-0 h-0.5 bg-aubergine-700" />}
                    </button>
                  );
                })}
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {fulfilment === "delivery" ? (
                <motion.div key="delivery" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  {addresses.length > 0 && (
                    <fieldset className="mt-6">
                      <legend className="mb-3 text-sm font-medium">Deliver to</legend>
                      <div className="space-y-2">
                        {addresses.map((a) => (
                          <RadioRow
                            key={a.id}
                            name="saved-address"
                            checked={savedId === a.id}
                            onChange={() => {
                              setSavedId(a.id);
                              setAddress(fromSaved(a));
                              setErrors({});
                            }}
                          >
                            <span className="block font-medium">{a.label || a.full_name}</span>
                            <span className="block text-sm text-ink-soft">
                              {[a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ")}
                            </span>
                          </RadioRow>
                        ))}
                        <RadioRow
                          name="saved-address"
                          checked={savedId === "new"}
                          onChange={() => {
                            setSavedId("new");
                            setAddress({ ...emptyAddress, fullName: viewer?.fullName ?? "", phone: viewer?.phone ?? "" });
                          }}
                        >
                          <span className="font-medium">Use a new address</span>
                        </RadioRow>
                      </div>
                    </fieldset>
                  )}

                  {(addresses.length === 0 || savedId === "new") && (
                    <AddressFields address={address} setAddress={setAddress} errors={errors} clearError={clearError} />
                  )}

                  <fieldset className="mt-8">
                    <legend className="mb-3 text-sm font-medium">Delivery method</legend>
                    <RateList quote={quote} quoting={quoting} selected={selectedRateId} onSelect={(id) => { setRateId(id); clearError("rate"); }} error={errors.rate} />
                  </fieldset>
                </motion.div>
              ) : (
                <motion.div key="collection" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <div className="mt-6 border-l-2 border-gold-500 bg-cream-50 px-5 py-4">
                    <p className="font-medium">Collect from our London workroom</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{collection?.address}</p>
                    {collection?.hours && <p className="mt-1 text-sm text-ink-soft">{collection.hours}</p>}
                    <p className="mt-3 text-sm text-ink-soft">We&apos;ll email you when your order is cut and ready, usually within one working day.</p>
                  </div>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <Field id="f-contactName" label="Name of person collecting" error={errors.contactName}>
                      <Input
                        id="f-contactName"
                        autoComplete="name"
                        value={collectName}
                        aria-invalid={Boolean(errors.contactName) || undefined}
                        aria-describedby="f-contactName-msg"
                        onChange={(e) => {
                          setCollectName(e.target.value);
                          clearError("contactName");
                        }}
                      />
                    </Field>
                    <Field id="f-contactPhone" label="Phone" optional error={errors.contactPhone} hint="In case we need to reach you.">
                      <Input
                        id="f-contactPhone"
                        type="tel"
                        autoComplete="tel"
                        value={collectPhone}
                        aria-invalid={Boolean(errors.contactPhone) || undefined}
                        aria-describedby="f-contactPhone-msg"
                        onChange={(e) => {
                          setCollectPhone(e.target.value);
                          clearError("contactPhone");
                        }}
                      />
                    </Field>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Disclosure
              className="mt-8"
              buttonClassName="w-auto justify-start gap-2 text-sm text-aubergine-700 hover:text-aubergine-900"
              summary="Add a note for our cutting room"
            >
              <Field id="f-note" label="Order note" optional className="mt-4">
                <Textarea id="f-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery instructions, or anything about your cuts." />
              </Field>
            </Disclosure>
          </Step>

          {/* 03 Payment */}
          <Step n="03" title="Payment" id="step-payment" last>
            {hasErrors && (
              <FormMessage className="mb-5">Some items in your basket need attention before you can pay. Please review them in the summary.</FormMessage>
            )}
            <PaymentSection
              method={method}
              setMethod={setMethod}
              payments={payments}
              isTrade={Boolean(viewer?.isTrade)}
              invoiceTermsDays={invoiceTermsDays}
              total={quote?.total ?? null}
              canPay={canPay}
              checkForm={checkForm}
              buildInput={buildInput}
              onServerError={onServerError}
              formError={formError}
              setFormError={setFormError}
            />
          </Step>
        </div>

        <aside className="hidden lg:block" aria-label="Order summary">
          <div className="sticky top-28">
            <OrderSummary
              items={items}
              quote={quote}
              quoting={quoting}
              quoteError={quoteError}
              fulfilment={fulfilment}
              code={{ input: codeInput, setInput: setCodeInput, applied: appliedCode, error: codeError, busy: codeBusy, apply: applyCode, remove: removeCode }}
              idPrefix="d"
            />
          </div>
        </aside>
      </div>
      {(payments.stripeKey || payments.paypalClientId || viewer?.isTrade) && <MobilePayBar total={quote?.total ?? null} label={method === "invoice" ? "Place order" : "Pay"} />}
    </div>
  );

  if (!stripeEnabled) return content;
  return (
    <Elements
      stripe={getStripePromise(payments.stripeKey!)}
      options={{
        mode: "payment",
        amount: Math.max(quote?.total ?? 0, 30),
        currency: "gbp",
        appearance,
      }}
    >
      {content}
    </Elements>
  );
}

function fromSaved(a: SavedAddress): AddressForm {
  return {
    fullName: a.full_name,
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    county: a.county ?? "",
    postcode: a.postcode,
    phone: a.phone ?? "",
  };
}

function Step({ n, title, id, children, last }: { n: string; title: string; id: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section id={`${id}-section`} aria-labelledby={id} className={cn("border-t border-stone-300 py-9 first:border-t-0 lg:first:border-t", last && "pb-0")}>
      <div className="mb-6 flex items-baseline gap-4">
        <span className="font-display text-lg tabular-nums text-gold-600" aria-hidden>
          {n}
        </span>
        <h2 id={id} className="font-display text-3xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function RadioRow({ name, checked, onChange, children, aside }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <RadioCard name={name} checked={checked} onChange={onChange} aside={aside} className="items-center">
      {children}
    </RadioCard>
  );
}

function AddressFields({
  address,
  setAddress,
  errors,
  clearError,
}: {
  address: AddressForm;
  setAddress: React.Dispatch<React.SetStateAction<AddressForm>>;
  errors: Errors;
  clearError: (k: string) => void;
}) {
  const bind = (k: keyof AddressForm) => ({
    id: `f-address-${k}`,
    value: address[k],
    "aria-invalid": Boolean(errors[`address.${k}`]) || undefined,
    "aria-describedby": `f-address-${k}-msg`,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setAddress((a) => ({ ...a, [k]: v }));
      clearError(`address.${k}`);
    },
  });
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <Field id="f-address-fullName" label="Full name" error={errors["address.fullName"]} className="sm:col-span-2">
        <Input {...bind("fullName")} autoComplete="shipping name" />
      </Field>
      <Field id="f-address-line1" label="Address" error={errors["address.line1"]} className="sm:col-span-2">
        <Input {...bind("line1")} autoComplete="shipping address-line1" placeholder="House number and street" />
      </Field>
      <Field id="f-address-line2" label="Flat, suite or building" optional className="sm:col-span-2">
        <Input {...bind("line2")} autoComplete="shipping address-line2" />
      </Field>
      <Field id="f-address-city" label="Town or city" error={errors["address.city"]}>
        <Input {...bind("city")} autoComplete="shipping address-level2" />
      </Field>
      <Field id="f-address-county" label="County" optional>
        <Input {...bind("county")} autoComplete="shipping address-level1" />
      </Field>
      <Field id="f-address-postcode" label="Postcode" error={errors["address.postcode"]} hint="UK addresses only.">
        <Input
          {...bind("postcode")}
          autoComplete="shipping postal-code"
          autoCapitalize="characters"
          className="uppercase"
          maxLength={10}
          onBlur={() => address.postcode && setAddress((a) => ({ ...a, postcode: normalisePostcode(a.postcode) }))}
        />
      </Field>
      <Field id="f-address-phone" label="Phone" optional error={errors["address.phone"]} hint="For the courier, if they need to reach you.">
        <Input {...bind("phone")} type="tel" autoComplete="shipping tel" />
      </Field>
      <p className="text-sm text-ink-soft sm:col-span-2">Country: United Kingdom</p>
    </div>
  );
}

function RateList({
  quote,
  quoting,
  selected,
  onSelect,
  error,
}: {
  quote: CartQuote | null;
  quoting: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  error?: string;
}) {
  if (!quote)
    return (
      <div className="space-y-px" aria-busy="true" aria-label="Loading delivery options">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 animate-pulse bg-cream-200/70" />
        ))}
      </div>
    );
  if (quote.rates.length === 0)
    return (
      <FormMessage tone="info">
        We couldn&apos;t find a delivery option for this basket&apos;s weight. Please choose click &amp; collect, or{" "}
        <Link href="/contact" className="underline underline-offset-4">contact us</Link> for a delivery quote.
      </FormMessage>
    );
  return (
    <>
      <div id="f-rate" tabIndex={-1} className={cn("space-y-2 outline-none", quoting && "opacity-70")}>
        {quote.rates.map((r) => (
          <RadioRow
            key={r.id}
            name="rate"
            checked={selected === r.id}
            onChange={() => onSelect(r.id)}
            aside={
              <span className={cn("shrink-0 tabular-nums", r.price === 0 ? "font-medium text-success" : "")}>{r.price === 0 ? "Free" : formatPence(r.price)}</span>
            }
          >
            <span className="block font-medium">{r.name}</span>
            {r.estimated_days && <span className="block text-sm text-ink-soft">{r.estimated_days}</span>}
          </RadioRow>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}

function MobileSummary({ total, children }: { total: number | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-300 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-summary"
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm text-aubergine-700">
          <IconBasket className="size-4" />
          {open ? "Hide order summary" : "Show order summary"}
          <IconChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} />
        </span>
        <span className="font-display text-2xl tabular-nums">{total != null ? formatPence(total) : "..."}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="mobile-summary"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.7, 0.1, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-24 md:px-8 md:pt-32" aria-busy="true" aria-label="Loading checkout">
      <div className="h-12 w-56 animate-pulse bg-cream-200" />
      <div className="mt-5 h-0.5 bg-aubergine-900" />
      <div className="mt-10 grid gap-16 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse bg-cream-200/70" />
          ))}
        </div>
        <div className="hidden h-96 animate-pulse bg-cream-200/70 lg:block" />
      </div>
    </div>
  );
}

function EmptyCheckout() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 pb-28 pt-36 text-center md:pb-36 md:pt-44">
      <IconBasket className="size-10 text-gold-600" strokeWidth={1.2} />
      <h1 className="font-display mt-6 text-4xl md:text-5xl">Your basket is empty</h1>
      <p className="mt-4 max-w-md text-ink-soft">
        There&apos;s nothing to check out just yet. Browse our linings and interlinings, or order swatches to feel the cloth before you buy.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop/linings" size="lg">Shop linings</ButtonLink>
        <ButtonLink href="/samples" size="lg" variant="secondary">Order swatches</ButtonLink>
      </div>
      <p className="mt-10 flex items-center gap-2 text-sm text-ink-soft">
        <IconCheck className="size-4 text-success" /> Your basket is saved on this device.
      </p>
    </div>
  );
}

/**
 * Phone only: a slim total + pay bar pinned to the bottom until the payment step scrolls into view.
 * Hides while typing so it never covers a focused field above the keyboard.
 */
function MobilePayBar({ total, label }: { total: number | null; label: string }) {
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const el = document.getElementById("step-payment-section");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPaymentVisible(e.isIntersecting), { rootMargin: "0px 0px -35% 0px" });
    io.observe(el);
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|IFRAME)$/.test(t.tagName) && (t as HTMLInputElement).type !== "radio";
    const onIn = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      io.disconnect();
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  const hidden = paymentVisible || typing;
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-cream-50 px-4 pt-3 shadow-lift transition-transform duration-300 ease-(--ease-silk) lg:hidden",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        hidden && "translate-y-full",
      )}
    >
      <div className="mx-auto flex max-w-xl items-center gap-4">
        <div className="min-w-0">
          <p className="text-xs text-ink-soft">Total, incl. VAT</p>
          <p className="font-display text-2xl leading-tight tabular-nums">{total != null ? formatPence(total) : "..."}</p>
        </div>
        <button
          type="button"
          tabIndex={hidden ? -1 : 0}
          onClick={() => document.getElementById("step-payment-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="ml-auto inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-sm bg-aubergine-800 px-5 text-sm font-medium text-cream-50 active:bg-aubergine-700"
        >
          <IconLock className="size-4" /> {label}
          {total != null ? ` ${formatPence(total)}` : ""}
        </button>
      </div>
    </div>
  );
}
