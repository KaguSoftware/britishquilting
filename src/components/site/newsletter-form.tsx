"use client";

import { useActionState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { subscribe, type NewsletterState } from "@/lib/actions/newsletter";

export function NewsletterForm() {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribe, null);
  return (
    <form action={action} className="mt-8 max-w-sm">
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <div className="flex items-center border-b border-cream-100/30 focus-within:border-gold-500">
        <input
          id="nl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email address"
          className="h-12 flex-1 bg-transparent text-cream-50 placeholder:text-cream-100/40 focus:outline-none"
        />
        <button disabled={pending || state?.ok} aria-label="Subscribe" className="grid size-10 place-items-center text-gold-300 transition-transform hover:translate-x-0.5 disabled:opacity-60">
          {state?.ok ? <Check className="size-5" /> : <ArrowRight className="size-5" />}
        </button>
      </div>
      <p aria-live="polite" className={`mt-3 min-h-5 text-sm ${state?.ok ? "text-gold-300" : "text-red-300"}`}>{state?.message}</p>
    </form>
  );
}
