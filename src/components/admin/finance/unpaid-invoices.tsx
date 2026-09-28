"use client";

import Link from "next/link";
import { useState } from "react";
import { markInvoicePaid } from "@/lib/actions/admin/orders";
import type { UnpaidInvoice } from "@/lib/data/finance";
import { cn, formatPence } from "@/lib/utils";
import { formatDate } from "../format";
import { Button } from "../ui";
import { useAction, useConfirm } from "../controls";

export function UnpaidInvoices({ invoices }: { invoices: UnpaidInvoice[] }) {
  const { run } = useAction();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const total = invoices.reduce((a, i) => a + i.total_pence, 0);
  const overdue = invoices.filter((i) => i.overdue);

  if (!invoices.length) return <p className="py-4 text-sm text-ink-soft">Every trade invoice has been paid. Nothing owed to you.</p>;

  const pay = async (inv: UnpaidInvoice) => {
    const yes = await confirm({
      title: `Mark #${inv.number} as paid?`,
      description: `${formatPence(inv.total_pence)} from ${inv.name}. It will count in today's takings and the customer gets a receipt email.`,
      confirmLabel: "Yes, it's paid",
    });
    if (!yes) return;
    setBusy(inv.id);
    await run(() => markInvoicePaid(inv.id));
    setBusy(null);
  };

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">
        <span className="font-display text-[1.6rem] tabular-nums text-aubergine-900">{formatPence(total)}</span> owed on {invoices.length}{" "}
        {invoices.length === 1 ? "invoice" : "invoices"}
        {overdue.length > 0 && <span className="text-danger">, {overdue.length} overdue</span>}
      </p>
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <Link href={`/admin/orders/${inv.id}`} className="min-w-0 flex-1 hover:text-aubergine-700">
              <p className="truncate text-[0.95rem]">
                #{inv.number} <span className="text-ink-soft">{inv.name}</span>
              </p>
              <p className={cn("text-xs", inv.overdue ? "text-danger" : "text-stone-500")}>
                {inv.invoice_due_at ? `${inv.overdue ? "Was due" : "Due"} ${formatDate(inv.invoice_due_at)}` : `Invoiced ${formatDate(inv.created_at)}`}
              </p>
            </Link>
            <span className="tabular-nums">{formatPence(inv.total_pence)}</span>
            <Button size="sm" variant="secondary" onClick={() => pay(inv)} disabled={busy === inv.id}>
              {busy === inv.id ? "Saving..." : "Mark paid"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
