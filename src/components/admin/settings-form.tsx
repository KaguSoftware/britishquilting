"use client";

import { useState } from "react";
import { saveSettings } from "@/lib/actions/admin/store";
import { SaveBar, SwitchRow, useAction, useUnsavedGuard } from "./controls";
import { Card, Field, Input, Textarea, UnitInput } from "./ui";

type S = {
  collection_enabled: boolean;
  collection_address: string;
  collection_hours: string;
  invoice_terms_days: string;
  bank_details: string;
  low_stock_email: string;
  announcement: string;
};

export function SettingsForm({ initial }: { initial: S }) {
  const { run, pending } = useAction();
  const [s, setS] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(s) !== baseline;
  useUnsavedGuard(dirty);
  const set = <K extends keyof S>(k: K, v: S[K]) => setS((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-6">
      <Card title="Announcement bar" description="A short line across the top of every page. Leave empty to hide it.">
        <Field label="Message" htmlFor="ann" hint={`${s.announcement.length} of 200 letters`}>
          <Input id="ann" value={s.announcement} maxLength={200} onChange={(e) => set("announcement", e.target.value)} placeholder="e.g. Free delivery on orders over £75" />
        </Field>
        {s.announcement && <p className="mt-3 bg-aubergine-900 px-4 py-2 text-center text-sm text-cream-50">{s.announcement}</p>}
      </Card>

      <Card title="Collection from the shop">
        <div className="space-y-4">
          <SwitchRow checked={s.collection_enabled} onChange={(v) => set("collection_enabled", v)} title="Let customers collect in person" description="They'll see a 'Collect from the shop (free)' option at checkout." />
          {s.collection_enabled && (
            <>
              <Field label="Collection address" htmlFor="caddr">
                <Textarea id="caddr" value={s.collection_address} onChange={(e) => set("collection_address", e.target.value)} className="min-h-24" />
              </Field>
              <Field label="Opening hours for collection" htmlFor="chours">
                <Input id="chours" value={s.collection_hours} onChange={(e) => set("collection_hours", e.target.value)} placeholder="Mon to Fri, 9am to 5pm" />
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card title="Trade invoices" description="For approved trade customers who pay on account.">
        <div className="space-y-4">
          <Field label="Days to pay" htmlFor="terms" className="sm:max-w-xs">
            <UnitInput unit="days" id="terms" value={s.invoice_terms_days} onChange={(e) => set("invoice_terms_days", e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
          <Field label="Bank details printed on invoices" htmlFor="bank" hint="Account name, sort code and account number.">
            <Textarea id="bank" value={s.bank_details} onChange={(e) => set("bank_details", e.target.value)} className="min-h-28 font-mono text-sm" />
          </Field>
        </div>
      </Card>

      <Card title="Alerts">
        <Field label="Email me when stock runs low" htmlFor="lse" hint="Leave empty if you don't want these emails.">
          <Input id="lse" type="email" value={s.low_stock_email} onChange={(e) => set("low_stock_email", e.target.value)} placeholder="you@britishquilting.co.uk" />
        </Field>
      </Card>

      <SaveBar
        dirty={dirty}
        saving={pending}
        onDiscard={() => setS(JSON.parse(baseline))}
        onSave={async () => {
          const r = await run(() =>
            saveSettings({
              ...s,
              invoice_terms_days: Number(s.invoice_terms_days) || 0,
            }),
          );
          if (r.ok) setBaseline(JSON.stringify(s));
        }}
      />
    </div>
  );
}
