import type { ReactNode } from "react";
import { PrintButton } from "@/components/admin/orders/print-button";

/** Everything an invoice prints, already formatted. Order and manual invoices both map into this. */
export type InvoiceDoc = {
  label: string;
  issued: string;
  due?: string | null;
  status: string;
  reference?: { label: string; value: string } | null;
  billTo: string[];
  email?: string | null;
  phone?: string | null;
  lines: {
    key: string;
    description: string;
    quantity: string;
    unit: string;
    amount: string;
  }[];
  /** Rows above the total, e.g. subtotal, discount, delivery. */
  adjustments?: { label: string; value: string }[];
  total: string;
  vat?: string | null;
  note?: string | null;
};

/** Placeholder text, shown dashed so it is obvious what still needs real details. */
function Placeholder({ children }: { children: ReactNode }) {
  return <span className="border-b border-dashed border-black/40 text-black/55">{children}</span>;
}

// Placeholder layout. The final invoice design will replace this once we have the example.
export function InvoiceDocument({ doc }: { doc: InvoiceDoc }) {
  return (
    <div className="min-h-svh bg-white text-black print:min-h-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { .grain::after { display: none !important; } body { background: #fff !important; } }`}</style>
      <div className="mx-auto max-w-[760px] px-8 py-10 print:p-0">
        <div className="mb-8 flex items-center justify-between gap-4 print:hidden">
          <p className="text-sm text-stone-500">To save a PDF, choose &ldquo;Save as PDF&rdquo; as the printer.</p>
          <PrintButton auto={false} label="Save as PDF" />
        </div>

        <header className="flex items-start justify-between border-b-2 border-black pb-5">
          <div>
            <p className="font-display text-3xl">British Quilting</p>
            <p className="mt-1 text-sm leading-relaxed">
              <Placeholder>Business address</Placeholder>
              <br />
              <Placeholder>VAT number</Placeholder>
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl">Invoice</p>
            <p className="mt-1 font-display text-xl tabular-nums">{doc.label}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 py-6">
          <div>
            <p className="mb-1 text-xs font-semibold">Bill to</p>
            <address className="text-base not-italic leading-snug">
              {doc.billTo.map((l, i) => (
                <span key={i} className="block">
                  {l}
                </span>
              ))}
            </address>
            {doc.email && <p className="mt-2 text-sm">{doc.email}</p>}
            {doc.phone && <p className="text-sm tabular-nums">{doc.phone}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 text-sm">
            <dt className="font-semibold">Invoice date</dt>
            <dd className="text-right">{doc.issued}</dd>
            {doc.reference && (
              <>
                <dt className="font-semibold">{doc.reference.label}</dt>
                <dd className="text-right tabular-nums">{doc.reference.value}</dd>
              </>
            )}
            {doc.due && (
              <>
                <dt className="font-semibold">Payment due</dt>
                <dd className="text-right">{doc.due}</dd>
              </>
            )}
            <dt className="font-semibold">Status</dt>
            <dd className="text-right">{doc.status}</dd>
          </dl>
        </section>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y-2 border-black text-xs">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Quantity</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.key} className="border-b border-black/20 align-top">
                <td className="py-3 pr-4">{l.description}</td>
                <td className="py-3 text-right tabular-nums">{l.quantity}</td>
                <td className="py-3 text-right tabular-nums">{l.unit}</td>
                <td className="py-3 text-right tabular-nums">{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 grid w-72 grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
          {doc.adjustments?.map((a) => (
            <div key={a.label} className="contents">
              <dt>{a.label}</dt>
              <dd className="text-right">{a.value}</dd>
            </div>
          ))}
          <dt className="mt-2 border-t-2 border-black pt-2 font-semibold">Total</dt>
          <dd className="mt-2 border-t-2 border-black pt-2 text-right font-display text-2xl">{doc.total}</dd>
          {doc.vat && (
            <>
              <dt className="text-xs">Includes VAT of</dt>
              <dd className="text-right text-xs">{doc.vat}</dd>
            </>
          )}
        </dl>

        {doc.note && (
          <section className="mt-8 text-sm">
            <p className="font-semibold">Notes</p>
            <p className="mt-1 whitespace-pre-line leading-relaxed">{doc.note}</p>
          </section>
        )}

        <section className="mt-10 border border-dashed border-black/40 p-4 text-sm">
          <p className="font-semibold">Payment details</p>
          <p className="mt-1 leading-relaxed">
            <Placeholder>Bank name, sort code and account number</Placeholder>
            <br />
            <Placeholder>Payment terms</Placeholder>
          </p>
        </section>

        <footer className="mt-10 border-t border-black pt-4 text-center text-sm">Thank you for shopping with British Quilting. Family-run in London since 1990.</footer>
      </div>
    </div>
  );
}
