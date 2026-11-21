"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { Field, Input } from "../ui";

type Addr = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  alt_line1: string | null;
  alt_line2: string | null;
  alt_city: string | null;
  alt_county: string | null;
  alt_postcode: string | null;
};

const FIRST = ["line1", "line2", "city", "county", "postcode"] as const;
const SECOND = ["alt_line1", "alt_line2", "alt_city", "alt_county", "alt_postcode"] as const;
const LABELS = ["First line", "Second line", "Town or city", "County", "Postcode"];
const SPANS = ["sm:col-span-3", "sm:col-span-3", "sm:col-span-2", "sm:col-span-2", "sm:col-span-2"];

/**
 * The address and the optional second address, each folded away until wanted (or already filled in).
 * Sits inside a six-column grid form.
 */
export function AddressFields<T extends Addr>({ value, onChange, idPrefix }: { value: T; onChange: (patch: Partial<Addr>) => void; idPrefix: string }) {
  const hasFirst = FIRST.some((k) => value[k]);
  const hasSecond = SECOND.some((k) => value[k]);
  const block = (keys: typeof FIRST | typeof SECOND) =>
    keys.map((k, i) => (
      <Field key={k} label={LABELS[i]} htmlFor={`${idPrefix}-${k}`} className={SPANS[i]}>
        <Input
          id={`${idPrefix}-${k}`}
          value={value[k] ?? ""}
          onChange={(e) => onChange({ [k]: e.target.value })}
          className={k.endsWith("postcode") ? "uppercase" : undefined}
          autoComplete="off"
        />
      </Field>
    ));
  const summary = (title: string, keys: readonly string[], hint?: string) => (
    <span className="flex flex-wrap items-baseline gap-x-3">
      {title}
      <span className="text-xs font-normal text-stone-500">
        {[value[keys[0] as keyof Addr], value[keys[2] as keyof Addr], value[keys[4] as keyof Addr]].filter(Boolean).join(", ") || hint}
      </span>
    </span>
  );
  return (
    <>
      <Disclosure
        defaultOpen={hasFirst}
        className="border-t border-ink/10 sm:col-span-6"
        buttonClassName="text-sm font-medium text-ink"
        panelClassName="grid gap-4 p-1 pb-2 sm:grid-cols-6"
        summary={summary("Address", FIRST)}
      >
        {block(FIRST)}
      </Disclosure>
      <Disclosure
        defaultOpen={hasSecond}
        className="border-t border-ink/10 sm:col-span-6"
        buttonClassName="text-sm font-medium text-ink"
        panelClassName="grid gap-4 p-1 pb-2 sm:grid-cols-6"
        summary={summary("Second address", SECOND, "Optional, e.g. a warehouse or site")}
      >
        {block(SECOND)}
      </Disclosure>
    </>
  );
}
