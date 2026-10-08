"use client";

import { useActionState } from "react";
import { IconCheck } from "@/components/icons";
import { sendContact, type FormState } from "@/lib/actions/shop";
import { cn } from "@/lib/utils";
import { RadioCard } from "@/components/ui/choice";
import { Label, btnPrimary, inputCls } from "./bits";

const TOPICS = [
  ["product", "A fabric question"],
  ["order", "An existing order"],
  ["other", "Something else"],
] as const;

export function ContactForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(sendContact, null);

  if (state?.ok)
    return (
      <div role="status" className="border border-stone-300 bg-cream-50 p-10">
        <IconCheck className="size-6 text-success" />
        <p className="font-display mt-4 text-3xl">Message received.</p>
        <p className="mt-2 text-ink-soft">{state.message}</p>
      </div>
    );

  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">What&apos;s it about?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOPICS.map(([v, l], i) => (
            <RadioCard key={v} name="topic" value={v} defaultChecked={i === 0} title={l} className="min-h-12 items-center px-3 py-2.5" />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-name">Your name</Label>
          <input id="c-name" name="name" required autoComplete="name" className={inputCls} />
        </div>
        <div>
          <Label htmlFor="c-email">Email</Label>
          <input id="c-email" name="email" type="email" required autoComplete="email" className={inputCls} />
        </div>
      </div>
      <div>
        <Label htmlFor="c-phone" hint="Optional">Phone</Label>
        <input id="c-phone" name="phone" type="tel" autoComplete="tel" className={inputCls} />
      </div>
      <div>
        <Label htmlFor="c-message">Message</Label>
        <textarea id="c-message" name="message" required minLength={10} rows={6} placeholder="Window sizes, fabric names, order numbers: anything that helps." className={inputCls} />
      </div>
      <div aria-hidden className="absolute -left-[9999px]">
        <label>Company <input name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state && !state.ok && <p role="alert" className="border-l-2 border-danger pl-4 text-sm">{state.message}</p>}
      <button className={cn(btnPrimary, "w-full sm:w-auto")} disabled={pending}>{pending ? "Sending..." : "Send message"}</button>
    </form>
  );
}
