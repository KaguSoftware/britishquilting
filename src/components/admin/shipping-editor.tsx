"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@/components/icons";
import { saveShipping } from "@/lib/actions/admin/store";
import { CARRIERS, penceToPounds, poundsToPence } from "./format";
import { SaveBar, Switch, SwitchRow, useAction, useUnsavedGuard } from "./controls";
import { Card, Field, Input, MoneyInput, UnitInput } from "./ui";
import { Dropdown } from "@/components/ui/dropdown";

type Rate = {
  id?: string;
  key: string;
  name: string;
  carrier: string;
  minKg: string;
  maxKg: string;
  price: string;
  estimated_days: string;
  is_active: boolean;
};

type DbRate = { id: string; name: string; carrier: string; min_weight_g: number; max_weight_g: number | null; price_pence: number; estimated_days: string | null; is_active: boolean };

const kg = (g: number | null) => (g == null ? "" : String(g / 1000));
const grams = (v: string) => (v.trim() === "" ? null : Math.round(Number(v) * 1000));

export function ShippingEditor({ rates, freeThreshold }: { rates: DbRate[]; freeThreshold: number | null }) {
  const { run, pending } = useAction();
  const initial = {
    rates: rates.map<Rate>((r) => ({ id: r.id, key: r.id, name: r.name, carrier: r.carrier, minKg: kg(r.min_weight_g), maxKg: kg(r.max_weight_g), price: penceToPounds(r.price_pence), estimated_days: r.estimated_days ?? "", is_active: r.is_active })),
    freeOn: freeThreshold != null,
    free: freeThreshold != null ? penceToPounds(freeThreshold) : "75.00",
  };
  const [state, setState] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(state) !== baseline;
  useUnsavedGuard(dirty);

  const update = (key: string, patch: Partial<Rate>) => setState((s) => ({ ...s, rates: s.rates.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const save = async () => {
    const res = await run(() =>
      saveShipping({
        freeThresholdPence: state.freeOn ? poundsToPence(state.free) : null,
        rates: state.rates.map((r) => ({
          id: r.id,
          name: r.name,
          carrier: r.carrier as "royal_mail",
          min_weight_g: grams(r.minKg) ?? 0,
          max_weight_g: grams(r.maxKg),
          price_pence: poundsToPence(r.price) ?? 0,
          estimated_days: r.estimated_days || null,
          is_active: r.is_active,
        })),
      }),
    );
    if (res.ok) setBaseline(JSON.stringify(state));
  };

  return (
    <div className="space-y-6">
      <Card title="Free delivery">
        <SwitchRow checked={state.freeOn} onChange={(v) => setState((s) => ({ ...s, freeOn: v }))} title="Offer free delivery on bigger orders" description="Customers see how much more they need to spend to get it." />
        {state.freeOn && (
          <Field label="Free delivery on orders over" htmlFor="free" className="mt-4 sm:max-w-xs">
            <MoneyInput id="free" value={state.free} onChange={(e) => setState((s) => ({ ...s, free: e.target.value }))} />
          </Field>
        )}
      </Card>

      <div>
        <div className="mb-3 flex items-baseline justify-between border-b border-ink/80 pb-2">
          <h2 className="font-display text-2xl text-aubergine-900">Delivery options</h2>
          <span className="text-sm text-stone-500">{state.rates.filter((r) => r.is_active).length} switched on</span>
        </div>
        <ul className="space-y-3">
          {state.rates.map((r) => (
            <li key={r.key} className="rounded-[3px] border border-ink/12 bg-cream-50 p-4">
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <Field label="Name customers see" htmlFor={`n-${r.key}`}>
                  <Input id={`n-${r.key}`} value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder="e.g. Royal Mail Tracked 48" />
                </Field>
                <Field label="Courier" htmlFor={`c-${r.key}`}>
                  <Dropdown id={`c-${r.key}`} value={r.carrier} onChange={(v) => update(r.key, { carrier: v })} sheetTitle="Courier" options={CARRIERS.map((c) => ({ value: c.value, label: c.label }))} />
                </Field>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Price" htmlFor={`p-${r.key}`}>
                  <MoneyInput id={`p-${r.key}`} value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} />
                </Field>
                <Field label="Parcels from" htmlFor={`min-${r.key}`}>
                  <UnitInput unit="kg" id={`min-${r.key}`} value={r.minKg} onChange={(e) => update(r.key, { minKg: e.target.value.replace(/[^\d.]/g, "") })} />
                </Field>
                <Field label="Up to" htmlFor={`max-${r.key}`} hint="Empty means any weight.">
                  <UnitInput unit="kg" id={`max-${r.key}`} value={r.maxKg} onChange={(e) => update(r.key, { maxKg: e.target.value.replace(/[^\d.]/g, "") })} />
                </Field>
                <Field label="How long it takes" htmlFor={`d-${r.key}`}>
                  <Input id={`d-${r.key}`} value={r.estimated_days} onChange={(e) => update(r.key, { estimated_days: e.target.value })} placeholder="2 to 3 working days" />
                </Field>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3">
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Switch checked={r.is_active} onChange={(v) => update(r.key, { is_active: v })} /> {r.is_active ? "Customers can choose this" : "Switched off"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const before = state.rates;
                    setState((s) => ({ ...s, rates: s.rates.filter((x) => x.key !== r.key) }));
                    toast("Option removed", { description: "It goes for good when you save.", action: { label: "Undo", onClick: () => setState((s) => ({ ...s, rates: before })) } });
                  }}
                  className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-danger/80"
                >
                  <IconTrash className="size-4" /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setState((s) => ({
              ...s,
              rates: [...s.rates, { key: crypto.randomUUID(), name: "", carrier: "royal_mail", minKg: "0", maxKg: "", price: "", estimated_days: "", is_active: true }],
            }))
          }
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] border border-dashed border-ink/25 text-sm text-aubergine-800 hover:bg-cream-50"
        >
          <IconPlus className="size-4" /> Add a delivery option
        </button>
      </div>

      <SaveBar dirty={dirty} saving={pending} onSave={save} onDiscard={() => setState(JSON.parse(baseline))} />
    </div>
  );
}
