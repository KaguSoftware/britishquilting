"use client";

import { useState } from "react";
import { saveBirthdaySettings } from "@/lib/actions/admin/marketing";
import { birthdayOfferLabel, type BirthdaySettings } from "@/lib/birthday";
import { parsePounds } from "@/lib/finance/calc";
import { formatPence } from "@/lib/utils";
import { IconGift } from "@/components/icons";
import { Card, Field, MoneyInput, UnitInput } from "./ui";
import { SaveBar, Segmented, SwitchRow, useAction, useUnsavedGuard } from "./controls";

type F = { enabled: boolean; kind: "percent" | "fixed"; percent: string; pounds: string; days: string; minimum: string };

const toForm = (s: BirthdaySettings): F => ({
  enabled: s.birthday_enabled,
  kind: s.birthday_kind,
  percent: s.birthday_kind === "percent" ? String(s.birthday_value) : "10",
  pounds: s.birthday_kind === "fixed" ? (s.birthday_value / 100).toFixed(2) : "",
  days: String(s.birthday_days),
  minimum: s.birthday_min_subtotal_pence ? (s.birthday_min_subtotal_pence / 100).toFixed(2) : "",
});

function toSettings(f: F): BirthdaySettings {
  return {
    birthday_enabled: f.enabled,
    birthday_kind: f.kind,
    birthday_value: f.kind === "percent" ? Math.trunc(Number(f.percent) || 0) : (parsePounds(f.pounds) ?? 0),
    birthday_days: Math.trunc(Number(f.days) || 0),
    birthday_min_subtotal_pence: parsePounds(f.minimum) ?? 0,
  };
}

/** The automatic birthday treat: what it takes off and for how long. Only the owner can change it. */
export function BirthdayForm({ initial, canEdit }: { initial: BirthdaySettings; canEdit: boolean }) {
  const { run, pending } = useAction();
  const [f, setF] = useState(() => toForm(initial));
  const [baseline, setBaseline] = useState(() => JSON.stringify(toForm(initial)));
  const dirty = JSON.stringify(f) !== baseline;
  useUnsavedGuard(dirty && canEdit);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((x) => ({ ...x, [k]: v }));
  const s = toSettings(f);
  const days = s.birthday_days;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <IconGift className="size-5 text-gold-600" /> Birthday treat
        </span>
      }
      description="Customers who give us their birthday get an email on the day, and the discount is taken off at checkout automatically, no code needed. Once per birthday."
    >
      <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-70">
        <SwitchRow checked={f.enabled} onChange={(v) => set("enabled", v)} title="Send birthday treats" description="Switch off to stop both the emails and the discount." />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="What comes off">
            <Segmented
              value={f.kind}
              onChange={(v) => set("kind", v)}
              options={[
                { value: "percent", label: "Percentage" },
                { value: "fixed", label: "Amount in £" },
              ]}
              className="w-full"
            />
          </Field>
          {f.kind === "percent" ? (
            <Field label="Percentage off" htmlFor="b-pct">
              <UnitInput unit="%" id="b-pct" value={f.percent} onChange={(e) => set("percent", e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
          ) : (
            <Field label="Amount off" htmlFor="b-amt">
              <MoneyInput id="b-amt" value={f.pounds} onChange={(e) => set("pounds", e.target.value)} placeholder="0.00" />
            </Field>
          )}
          <Field label="How long it lasts" htmlFor="b-days" hint="Counting the birthday itself. Up to 60 days.">
            <UnitInput unit="days" id="b-days" value={f.days} onChange={(e) => set("days", e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
          <Field label="Minimum spend (optional)" htmlFor="b-min" hint="Leave empty for any order.">
            <MoneyInput id="b-min" value={f.minimum} onChange={(e) => set("minimum", e.target.value)} placeholder="0.00" />
          </Field>
        </div>
      </fieldset>

      <p className="mt-6 border-t border-ink/10 pt-4 font-display text-lg leading-snug text-aubergine-900">
        {f.enabled && s.birthday_value > 0 && days > 0 ? (
          <>
            <em>&ldquo;{birthdayOfferLabel(s)}</em> for {days === 1 ? "the birthday only" : `${days} days from their birthday`}
            {s.birthday_min_subtotal_pence ? `, on orders of ${formatPence(s.birthday_min_subtotal_pence)} or more` : ""}.&rdquo;
          </>
        ) : (
          <span className="text-stone-500">Birthday treats are off.</span>
        )}
      </p>
      {!canEdit && <p className="mt-2 text-sm text-stone-500">Only the owner can change the birthday treat.</p>}

      {canEdit && (
        <SaveBar
          dirty={dirty}
          saving={pending}
          onDiscard={() => setF(JSON.parse(baseline))}
          onSave={async () => {
            const r = await run(() => saveBirthdaySettings(toSettings(f)));
            if (r.ok) setBaseline(JSON.stringify(f));
          }}
        />
      )}
    </Card>
  );
}
