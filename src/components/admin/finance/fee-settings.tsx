"use client";

import { useState } from "react";
import { saveFinanceSettings, saveVatRate } from "@/lib/actions/admin/finance";
import type { FeeSettings } from "@/lib/finance/calc";
import { Button, Field, MoneyInput, UnitInput } from "../ui";
import { useAction, useConfirm } from "../controls";

export function VatRateForm({ vatRate }: { vatRate: number }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [value, setValue] = useState(String(vatRate));
  const save = async () => {
    const n = Number(value);
    if (
      await confirm({
        title: "Change the VAT rate?",
        description: "Applies to orders placed from now on. Past orders keep the rate they were placed at.",
        confirmLabel: "Yes, change it",
      })
    )
      run(() => saveVatRate({ vat_rate: n }));
  };
  return (
    <div>
      <Field label="VAT rate" htmlFor="vr">
        <UnitInput unit="%" id="vr" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} />
      </Field>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">Set to 0 if you aren&apos;t VAT registered.</p>
        <Button variant="secondary" onClick={save} disabled={pending || !value || Number.isNaN(Number(value))}>
          {pending ? "Saving..." : "Save VAT rate"}
        </Button>
      </div>
    </div>
  );
}

export function FeeSettingsForm({ settings }: { settings: FeeSettings }) {
  const { run, pending } = useAction();
  const [f, setF] = useState({
    stripe_pct: String(settings.stripe_pct),
    stripe_fixed: (settings.stripe_fixed_pence / 100).toFixed(2),
    paypal_pct: String(settings.paypal_pct),
    paypal_fixed: (settings.paypal_fixed_pence / 100).toFixed(2),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.]/g, "") }));
  const save = () =>
    run(() =>
      saveFinanceSettings({
        stripe_pct: Number(f.stripe_pct),
        stripe_fixed_pence: Math.round(Number(f.stripe_fixed) * 100),
        paypal_pct: Number(f.paypal_pct),
        paypal_fixed_pence: Math.round(Number(f.paypal_fixed) * 100),
      }),
    );
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Stripe, percentage" htmlFor="sp">
          <UnitInput unit="%" id="sp" value={f.stripe_pct} onChange={set("stripe_pct")} />
        </Field>
        <Field label="Stripe, per payment" htmlFor="sf">
          <MoneyInput id="sf" value={f.stripe_fixed} onChange={set("stripe_fixed")} />
        </Field>
        <Field label="PayPal, percentage" htmlFor="pp">
          <UnitInput unit="%" id="pp" value={f.paypal_pct} onChange={set("paypal_pct")} />
        </Field>
        <Field label="PayPal, per payment" htmlFor="pf">
          <MoneyInput id="pf" value={f.paypal_fixed} onChange={set("paypal_fixed")} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">Used to estimate fees on each order. Bank transfers for trade invoices cost nothing.</p>
        <Button variant="secondary" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save fee rates"}
        </Button>
      </div>
    </div>
  );
}
