"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { IconPencil, IconPin, IconPlus, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox, Field, FormMessage } from "@/components/ui/field";
import { deleteAddress, saveAddress, setDefaultAddress, type FormState } from "@/lib/actions/account";
import type { Address } from "@/lib/data/account";
import { EmptyState } from "./section";

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [editing, setEditing] = useState<Address | "new" | null>(null);

  if (editing) {
    return <AddressForm address={editing === "new" ? null : editing} isFirst={addresses.length === 0} onDone={() => setEditing(null)} />;
  }

  if (addresses.length === 0) {
    return (
      <EmptyState
        icon={<IconPin className="size-8" strokeWidth={1.25} />}
        title="No saved addresses"
        action={
          <Button onClick={() => setEditing("new")}>
            <IconPlus className="size-4" /> Add an address
          </Button>
        }
      >
        Save your home or workroom address for a quicker checkout next time.
      </EmptyState>
    );
  }

  return (
    <div>
      <ul className="grid gap-px border border-stone-300 bg-stone-300 sm:grid-cols-2">
        {addresses.map((a) => (
          <AddressCard key={a.id} a={a} onEdit={() => setEditing(a)} />
        ))}
        <li className="bg-cream-100">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex h-full min-h-44 w-full flex-col items-center justify-center gap-2 text-sm text-aubergine-700 transition-colors duration-300 hover:bg-cream-50"
          >
            <IconPlus className="size-5" /> Add another address
          </button>
        </li>
      </ul>
    </div>
  );
}

function AddressCard({ a, onEdit }: { a: Address; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<FormState>) =>
    start(async () => {
      const r = await fn();
      if (r?.ok) toast.success(r.message);
      else if (r?.message) toast.error(r.message);
    });

  return (
    <li className="flex flex-col bg-cream-100 p-6" aria-busy={pending || undefined}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-xl text-aubergine-900">{a.label || a.full_name}</p>
        {a.is_default && <span className="border-b border-gold-500 pb-0.5 text-xs text-gold-600">Default</span>}
      </div>
      <address className="mt-3 flex-1 text-sm not-italic leading-relaxed text-ink-soft">
        {a.label && <span className="block text-ink">{a.full_name}</span>}
        <span className="block">{a.line1}</span>
        {a.line2 && <span className="block">{a.line2}</span>}
        <span className="block">
          {a.city}
          {a.county ? `, ${a.county}` : ""}
        </span>
        <span className="block tracking-wide text-ink">{a.postcode}</span>
        {a.phone && <span className="mt-1 block">{a.phone}</span>}
      </address>

      {confirming ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-stone-300 pt-4" role="group" aria-label="Confirm removal">
          <span className="text-sm">Remove this address?</span>
          <Button size="sm" variant="danger" loading={pending} onClick={() => run(() => deleteAddress(a.id))}>
            Remove
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-300 pt-4 text-sm">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 text-aubergine-700 hover:underline underline-offset-4">
            <IconPencil className="size-3.5" /> Edit
          </button>
          {!a.is_default && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setDefaultAddress(a.id))}
              className="text-aubergine-700 underline-offset-4 hover:underline disabled:opacity-50"
            >
              {pending ? "Saving" : "Make default"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ml-auto inline-flex items-center gap-1.5 text-ink-soft transition-colors hover:text-danger"
            aria-label={`Remove address ${a.line1}`}
          >
            <IconTrash className="size-3.5" /> Remove
          </button>
        </div>
      )}
    </li>
  );
}

function AddressForm({ address, isFirst, onDone }: { address: Address | null; isFirst: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAddress, null);
  const uid = useId();
  const fe = state?.fieldErrors;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const f = (name: keyof Address, label: string, opts: { optional?: boolean; auto?: string; className?: string; hint?: string; upper?: boolean; type?: string } = {}) => {
    const id = `${uid}-${name}`;
    return (
      <Field id={id} label={label} optional={opts.optional} error={fe?.[name]} hint={opts.hint} className={opts.className}>
        <Input
          id={id}
          name={name}
          type={opts.type ?? "text"}
          autoComplete={opts.auto}
          required={!opts.optional}
          defaultValue={(address?.[name] as string | null) ?? ""}
          aria-invalid={Boolean(fe?.[name]) || undefined}
          aria-describedby={`${id}-msg`}
          className={opts.upper ? "uppercase" : undefined}
        />
      </Field>
    );
  };

  return (
    <form action={action} className="border-t-2 border-aubergine-900 pt-6" noValidate>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-2xl text-aubergine-900">{address ? "Edit address" : "New address"}</h3>
        <span className="text-xs text-stone-500">UK addresses only</span>
      </div>
      <input type="hidden" name="id" value={address?.id ?? ""} />
      {state?.message && !state.ok && <FormMessage className="mb-6">{state.message}</FormMessage>}
      <div className="grid gap-5 sm:grid-cols-2">
        {f("label", "Label", { optional: true, hint: "For example Home or Workroom" })}
        {f("full_name", "Full name", { auto: "name" })}
        {f("line1", "Address line 1", { auto: "address-line1", className: "sm:col-span-2" })}
        {f("line2", "Address line 2", { auto: "address-line2", optional: true, className: "sm:col-span-2" })}
        {f("city", "Town or city", { auto: "address-level2" })}
        {f("county", "County", { auto: "address-level1", optional: true })}
        {f("postcode", "Postcode", { auto: "postal-code", upper: true })}
        {f("phone", "Phone", { auto: "tel", optional: true, type: "tel", hint: "In case the courier needs you" })}
      </div>
      {!isFirst && !address?.is_default && (
        <Checkbox name="is_default" label="Use as my default address" className="mt-6" />
      )}
      {address?.is_default && <input type="hidden" name="is_default" value="on" />}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>{pending ? "Saving" : address ? "Save changes" : "Save address"}</Button>
        <Button variant="ghost" onClick={onDone} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
