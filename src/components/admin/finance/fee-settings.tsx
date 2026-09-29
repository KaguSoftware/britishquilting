"use client";

import { useState } from "react";
import { saveFinanceSettings, saveVatRate } from "@/lib/actions/admin/finance";
import type { FeeSettings } from "@/lib/finance/calc";
import { Button, Field, MoneyInput, UnitInput } from "../ui";
import { useAction, useConfirm } from "../controls";

/** Fee rates and VAT rate share one grid so every field in this card lines up, even though they save separately. */
export function FeeSettingsForm({ settings }: { settings: FeeSettings }) {
  const fees = useAction();
  const vat = useAction();
  const confirm = useConfirm();
  const [f, setF] = useState({
    stripe_pct: String(settings.stripe_pct),
    stripe_fixed: (settings.stripe_fixed_pence / 100).toFixed(2),
    paypal_pct: String(settings.paypal_pct),
    paypal_fixed: (settings.paypal_fixed_pence / 100).toFixed(2),
  });
  const [vatRate, setVatRate] = useState(String(settings.vat_rate));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.]/g, "") }));

  const saveFees = () =>
    fees.run(() =>
      saveFinanceSettings({
        stripe_pct: Number(f.stripe_pct),
        stripe_fixed_pence: Math.round(Number(f.stripe_fixed) * 100),
        paypal_pct: Number(f.paypal_pct),
        paypal_fixed_pence: Math.round(Number(f.paypal_fixed) * 100),
      }),
    );

  const saveVat = async () => {
    const n = Number(vatRate);
    if (
      await confirm({
        title: "Change the VAT rate?",
        description: "Applies to orders placed from now on. Past orders keep the rate they were placed at.",
        confirmLabel: "Yes, change it",
      })
    )
      vat.run(() => saveVatRate({ vat_rate: n }));
  };

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
        <Field label="VAT rate" htmlFor="vr">
          <UnitInput unit="%" id="vr" value={vatRate} onChange={(e) => setVatRate(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">Fees estimate what Stripe and PayPal charge you. VAT applies to orders placed from now on; set it to 0 if you aren&apos;t VAT registered.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={saveFees} disabled={fees.pending}>
            {fees.pending ? "Saving..." : "Save fee rates"}
          </Button>
          <Button variant="secondary" onClick={saveVat} disabled={vat.pending || !vatRate || Number.isNaN(Number(vatRate))}>
            {vat.pending ? "Saving..." : "Save VAT rate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
