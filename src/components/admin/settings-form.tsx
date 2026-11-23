"use client";

import { Fragment, useState } from "react";
import { Marquee } from "@/components/site/marquee";
import { IconClose, IconPlus } from "@/components/icons";
import { saveSettings } from "@/lib/actions/admin/store";
import { SaveBar, SwitchRow, useAction, useUnsavedGuard } from "./controls";
import { btn, Card, Field, Input, Textarea } from "./ui";

type S = {
  collection_enabled: boolean;
  collection_address: string;
  collection_hours: string;
  invoice_terms_days: string;
  bank_details: string;
  low_stock_email: string;
  announcement_messages: string[];
  announcement_rotate: boolean;
};

function AnnouncementPreview({ messages, together }: { messages: string[]; together: boolean }) {
  if (messages.length === 0)
    return (
      <p className="rounded-[3px] border border-dashed border-stone-300 px-5 py-4 text-center text-sm text-stone-500">
        The bar is hidden. Type a message to show it.
      </p>
    );
  const cls = "font-display text-lg leading-snug text-gold-100 md:text-xl";
  if (!together)
    return (
      <div className="rounded-[3px] bg-aubergine-950 py-4 animate-announce-glow">
        <Marquee messages={messages} itemClassName={cls} />
      </div>
    );
  return (
    <div className="flex items-center justify-center overflow-hidden rounded-[3px] bg-aubergine-950 px-5 py-4 animate-announce-glow">
      <p className="flex items-center whitespace-nowrap">
        {messages.map((m, i) => (
          <Fragment key={i}>
            {i > 0 && <span aria-hidden className="mx-6 inline-block h-px w-6 shrink-0 border-t border-dashed border-gold-500/80" />}
            <span className={cls}>{m}</span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: S }) {
  const { run, pending } = useAction();
  const [s, setS] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(s) !== baseline;
  useUnsavedGuard(dirty);
  const set = <K extends keyof S>(k: K, v: S[K]) => setS((x) => ({ ...x, [k]: v }));

  const messages = s.announcement_messages.map((m) => m.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      <Card
        title="Announcement bar"
        description="Short lines across the top of every page. Remove all messages to hide the bar."
        className="border-gold-500/70 bg-gold-100/40 shadow-glow"
      >
        <div className="space-y-2">
          {(s.announcement_messages.length ? s.announcement_messages : [""]).map((m, i, all) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right font-display text-sm text-stone-500">{i + 1}</span>
              <Input
                aria-label={`Message ${i + 1}`}
                value={m}
                maxLength={200}
                onChange={(e) => set("announcement_messages", all.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="e.g. Free delivery on orders over £75"
                className="text-base font-medium text-aubergine-900"
              />
              <button
                type="button"
                aria-label={`Remove message ${i + 1}`}
                onClick={() => set("announcement_messages", all.filter((_, j) => j !== i))}
                className="grid size-10 shrink-0 place-items-center text-stone-500 transition-colors hover:text-danger"
              >
                <IconClose className="size-4" />
              </button>
            </div>
          ))}
        </div>
        {s.announcement_messages.length < 10 && (
          <button
            type="button"
            onClick={() => set("announcement_messages", [...(s.announcement_messages.length ? s.announcement_messages : [""]), ""])}
            className={`${btn("secondary", "sm")} mt-3`}
          >
            <IconPlus className="size-4" />
            Add another message
          </button>
        )}
        <div className="mt-5">
          <SwitchRow
            checked={s.announcement_rotate}
            onChange={(v) => set("announcement_rotate", v)}
            title="Show all messages together in the band"
            description="On: every message is shown at once, side by side, and the bar stays still. Off: the same band scrolls across the bar as a marquee."
          />
        </div>
        <p className="mb-2 mt-5 text-xs text-ink-soft">How it looks on the shop</p>
        <AnnouncementPreview messages={messages} together={s.announcement_rotate} />
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
