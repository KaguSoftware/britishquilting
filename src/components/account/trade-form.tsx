"use client";

import { useActionState, useId } from "react";
import { IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";
import { applyForTrade, type FormState } from "@/lib/actions/account";

const BUSINESS_TYPES = [
  "Curtain and blind workroom",
  "Interior designer",
  "Upholsterer",
  "Soft furnishings retailer",
  "Hotel or contract",
  "Theatre or film",
  "Other",
];

export function TradeForm({ defaultCompany }: { defaultCompany?: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(applyForTrade, null);
  const uid = useId();
  const fe = state?.fieldErrors;
  const id = (k: string) => `${uid}-${k}`;
  const aria = (k: string) => ({ id: id(k), name: k, "aria-invalid": Boolean(fe?.[k]) || undefined, "aria-describedby": `${id(k)}-msg` });

  if (state?.ok) {
    return (
      <div className="border-t-2 border-aubergine-900 pt-8" role="status">
        <IconCheck className="size-7 text-success" />
        <p className="font-display mt-4 text-3xl text-aubergine-900">Application received</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{state.message} We&apos;ll email you as soon as your account is approved.</p>
      </div>
    );
  }

  return (
    <form action={action} className="border-t-2 border-aubergine-900 pt-8" noValidate>
      {state?.message && <FormMessage className="mb-6">{state.message}</FormMessage>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={id("company_name")} label="Company or trading name" error={fe?.company_name} className="sm:col-span-2">
          <Input {...aria("company_name")} autoComplete="organization" required defaultValue={defaultCompany ?? ""} />
        </Field>
        <Field id={id("business_type")} label="Type of business" error={fe?.business_type} className="sm:col-span-2">
          <Select {...aria("business_type")} required defaultValue="">
            <option value="" disabled>Choose one</option>
            {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field id={id("vat_number")} label="VAT number" optional error={fe?.vat_number} hint="If VAT registered">
          <Input {...aria("vat_number")} placeholder="GB 123 4567 89" className="uppercase" />
        </Field>
        <Field id={id("company_number")} label="Company number" optional error={fe?.company_number} hint="Companies House">
          <Input {...aria("company_number")} placeholder="01234567" inputMode="text" className="uppercase" />
        </Field>
        <Field id={id("website")} label="Website or Instagram" optional error={fe?.website} className="sm:col-span-2">
          <Input {...aria("website")} type="url" inputMode="url" placeholder="yourworkroom.co.uk" />
        </Field>
        <Field id={id("message")} label="Anything we should know?" optional error={fe?.message} className="sm:col-span-2" hint="Typical monthly volume, the cloths you use most, delivery needs.">
          <Textarea {...aria("message")} rows={4} />
        </Field>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={pending}>{pending ? "Sending" : "Apply for a trade account"}</Button>
        <p className="text-xs text-stone-500">Reviewed personally, usually within one working day.</p>
      </div>
    </form>
  );
}
