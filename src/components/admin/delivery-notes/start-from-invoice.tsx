"use client";

import { useRouter } from "next/navigation";
import { InvoicePicker } from "./invoice-picker";

/** First step of a new delivery note: which invoice is it for? */
export function StartFromInvoice({ customerId }: { customerId?: string | null }) {
  const router = useRouter();
  return (
    <section className="border-y border-ink/80 py-6">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-lg tabular-nums text-gold-600">i.</span>
        <h2 className="font-display text-2xl text-aubergine-900">Which invoice is it for?</h2>
      </div>
      <p className="mt-2 max-w-xl text-sm text-ink-soft sm:pl-9">
        A delivery note sends out the goods on one invoice. You can split them across several places on the next step.
      </p>
      <div className="mt-4 max-w-xl sm:pl-9">
        <InvoicePicker customerId={customerId} onPick={(o) => router.push(`/admin/delivery-notes/new?invoice=${o.id}`)} />
      </div>
    </section>
  );
}
