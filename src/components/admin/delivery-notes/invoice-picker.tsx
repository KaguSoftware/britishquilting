"use client";

import { searchInvoicesForNote, type InvoiceOption } from "@/lib/actions/admin/delivery-notes";
import { manualInvoiceNo } from "@/lib/invoices";
import { formatPence } from "@/lib/utils";
import { formatDate } from "../format";
import { SearchSelect } from "../search-select";

/** Choose the invoice a delivery note is for, from those that don't have one yet. */
export function InvoicePicker({ onPick, customerId }: { onPick: (o: InvoiceOption) => void; customerId?: string | null }) {
  return (
    <SearchSelect<InvoiceOption>
      search={(q) => searchInvoicesForNote(q, customerId)}
      onPick={onPick}
      itemKey={(o) => o.id}
      placeholder="Search invoices by number or who they're for"
      label="Choose the invoice"
      renderItem={(o) => (
        <span className="flex items-baseline gap-3">
          <span className="font-display tabular-nums text-aubergine-900">{manualInvoiceNo(o.number)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.95rem] text-ink">{o.name}</span>
            <span className="block truncate text-xs text-ink-soft">
              {[formatDate(o.issued_on), `${o.lines} product${o.lines === 1 ? "" : "s"}`, o.company].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="text-sm tabular-nums">{formatPence(o.total_pence)}</span>
        </span>
      )}
      empty={(q) => (q ? `No invoice without a delivery note matches “${q}”.` : "Every invoice already has a delivery note.")}
    />
  );
}
