"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { IconDocument, IconPhone, IconPlus, IconTrash } from "@/components/icons";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { deleteInvoice, saveInvoice } from "@/lib/actions/admin/invoices";
import { parsePounds, vatFromGross } from "@/lib/finance/calc";
import { billToLines, invoiceTotal, lineAmount, telHref, type ManualCustomer, type ManualInvoice } from "@/lib/invoices";
import { formatPence } from "@/lib/utils";
import { Button, ButtonLink, Card, Field, Input, MoneyInput, Textarea, btn } from "../ui";
import { SaveBar, SwitchRow, useAction, useConfirm, useUnsavedGuard } from "../controls";
import { CustomerModal } from "@/components/admin/customers/customer-modal";

type Line = {
  key: number;
  description: string;
  quantity: string;
  unit: string;
};
type Form = {
  customer_id: string | null;
  lines: Line[];
  issued_on: string | null;
  due_on: string | null;
  note: string;
  paid: boolean;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

function toForm(inv: ManualInvoice | null, customerId: string | null): Form {
  if (!inv)
    return {
      customer_id: customerId,
      lines: [{ key: 0, description: "", quantity: "1", unit: "" }],
      issued_on: today(),
      due_on: null,
      note: "",
      paid: false,
    };
  return {
    customer_id: inv.customer_id,
    lines: inv.items.map((l, i) => ({
      key: i,
      description: l.description,
      quantity: String(l.quantity),
      unit: (l.unit_price_pence / 100).toFixed(2),
    })),
    issued_on: inv.issued_on,
    due_on: inv.due_on,
    note: inv.note ?? "",
    paid: !!inv.paid_at,
  };
}

const parseQty = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

export function InvoiceEditor({
  invoice,
  customers: initialCustomers,
  defaultCustomerId,
  vatRate,
}: {
  invoice: ManualInvoice | null;
  customers: ManualCustomer[];
  defaultCustomerId: string | null;
  vatRate: number;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [customers, setCustomers] = useState(initialCustomers);
  const [saved, setSaved] = useState(() => toForm(invoice, defaultCustomerId));
  const [form, setForm] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const nextKey = useRef(form.lines.length);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  const customer = customers.find((c) => c.id === form.customer_id) ?? null;
  // An invoice whose customer was removed still shows who it was written for.
  const orphan = invoice && !customer && !form.customer_id ? invoice.bill_to : null;

  const parsed = useMemo(
    () =>
      form.lines.map((l) => ({
        quantity: parseQty(l.quantity),
        unit_price_pence: parsePounds(l.unit),
      })),
    [form.lines],
  );
  const total = invoiceTotal(
    parsed.map((p) => ({
      quantity: p.quantity ?? 0,
      unit_price_pence: p.unit_price_pence ?? 0,
    })),
  );

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (key: number, patch: Partial<Line>) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  const addLine = () =>
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { key: nextKey.current++, description: "", quantity: "1", unit: "" }],
    }));
  const removeLine = (key: number) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.key !== key) }));

  const save = async () => {
    if (!form.customer_id) return setError("Please choose who the invoice is for, or add a new customer.");
    if (!form.lines.length) return setError("Add at least one line.");
    for (const [i, l] of form.lines.entries()) {
      if (!l.description.trim()) return setError(`Line ${i + 1} needs a description.`);
      if (parsed[i].quantity == null) return setError(`Line ${i + 1}: the quantity should be a number, like 2 or 1.5`);
      if (parsed[i].unit_price_pence == null) return setError(`Line ${i + 1}: please enter a price, like 12.50`);
    }
    if (!form.issued_on) return setError("Please choose the invoice date.");
    setError(null);
    const res = await run(() =>
      saveInvoice({
        id: invoice?.id,
        customer_id: form.customer_id!,
        items: form.lines.map((l, i) => ({
          description: l.description,
          quantity: parsed[i].quantity!,
          unit_price_pence: parsed[i].unit_price_pence!,
        })),
        issued_on: form.issued_on!,
        due_on: form.due_on,
        note: form.note,
        paid: form.paid,
      }),
    );
    if (!res.ok) return setError(res.error);
    setSaved(form);
    if (!invoice && res.data) router.replace(`/admin/invoices/${res.data.id}`);
  };

  const remove = async () => {
    if (!invoice) return;
    const yes = await confirm({
      title: "Delete this invoice?",
      description: "This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!yes) return;
    const res = await run(() => deleteInvoice(invoice.id));
    if (res.ok) {
      setSaved(form); // nothing left to lose, so let the guard go
      router.push("/admin/invoices");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-6">
        <Card
          title="Customer"
          action={
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <IconPlus className="size-4" /> New customer
            </Button>
          }
        >
          <Field label="Who is this invoice for?" htmlFor="inv-customer">
            <Dropdown
              id="inv-customer"
              value={form.customer_id}
              onChange={(v) => set("customer_id", v)}
              placeholder={customers.length ? "Choose a customer" : "Add a customer first"}
              sheetTitle="Choose a customer"
              options={customers.map((c) => ({
                value: c.id,
                label: c.full_name,
                text: c.full_name,
                hint: [c.company, c.phone].filter(Boolean).join(" · ") || undefined,
              }))}
            />
          </Field>
          {(customer || orphan) && (
            <div className="mt-4 flex items-start justify-between gap-4 border-t border-ink/10 pt-4 text-sm">
              <address className="not-italic leading-relaxed text-ink-soft">
                {billToLines(customer ?? orphan).map((l, i) => (
                  <span key={i} className={i === 0 ? "block font-medium text-ink" : "block"}>
                    {l}
                  </span>
                ))}
                {(customer ?? orphan)?.email && <span className="block">{(customer ?? orphan)!.email}</span>}
                {orphan && <span className="mt-1 block text-xs italic text-stone-500">This customer was removed from the list. Choose another to change the invoice.</span>}
              </address>
              {(customer ?? orphan)?.phone && (
                <a href={telHref((customer ?? orphan)!.phone!)} className={btn("secondary", "sm")}>
                  <IconPhone className="size-4" /> Call {(customer ?? orphan)!.phone}
                </a>
              )}
            </div>
          )}
        </Card>

        <Card title="What it's for" bodyClassName="p-0">
          <div className="hidden grid-cols-[1fr_90px_130px_100px_40px] gap-3 border-b border-ink/10 px-5 py-2.5 text-xs text-stone-500 md:grid">
            <span>Description</span>
            <span>Quantity</span>
            <span>Unit price</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <ol className="divide-y divide-ink/10">
            {form.lines.map((l, i) => (
              <li key={l.key} className="grid grid-cols-[1fr_1fr_auto] gap-3 px-5 py-3 md:grid-cols-[1fr_90px_130px_100px_40px] md:items-center">
                <Input
                  value={l.description}
                  onChange={(e) => setLine(l.key, { description: e.target.value })}
                  placeholder="e.g. Liberty Tana Lawn, cut to 2m"
                  aria-label={`Line ${i + 1} description`}
                  className="col-span-3 md:col-span-1"
                />
                <Input
                  value={l.quantity}
                  onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                  inputMode="decimal"
                  className="tabular-nums"
                  aria-label={`Line ${i + 1} quantity`}
                />
                <MoneyInput value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} placeholder="0.00" aria-label={`Line ${i + 1} unit price`} />
                <span className="hidden text-right tabular-nums md:block">
                  {parsed[i].quantity != null && parsed[i].unit_price_pence != null
                    ? formatPence(
                        lineAmount({
                          quantity: parsed[i].quantity!,
                          unit_price_pence: parsed[i].unit_price_pence!,
                        }),
                      )
                    : "–"}
                </span>
                <Button variant="ghost" size="sm" onClick={() => removeLine(l.key)} disabled={form.lines.length === 1} aria-label={`Remove line ${i + 1}`} className="self-center">
                  <IconTrash className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-4 border-t border-ink/10 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <Button variant="secondary" size="sm" onClick={addLine} disabled={form.lines.length >= 100}>
              <IconPlus className="size-4" /> Add a line
            </Button>
            <dl className="grid grid-cols-[auto_auto] gap-x-6 text-right tabular-nums">
              <dt className="text-sm text-ink-soft">Total</dt>
              <dd className="font-display text-2xl text-aubergine-900">{formatPence(total)}</dd>
              {vatRate > 0 && total > 0 && (
                <>
                  <dt className="text-xs text-stone-500">Includes VAT at {vatRate}%</dt>
                  <dd className="text-xs text-stone-500">{formatPence(vatFromGross(total, vatRate))}</dd>
                </>
              )}
            </dl>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Details">
          <div className="space-y-4">
            <Field label="Invoice date" htmlFor="inv-issued">
              <DatePicker id="inv-issued" value={form.issued_on} onChange={(v) => set("issued_on", v)} clearable={false} />
            </Field>
            <Field label="Payment due" hint="Optional" htmlFor="inv-due">
              <DatePicker id="inv-due" value={form.due_on} onChange={(v) => set("due_on", v)} min={form.issued_on ?? undefined} placeholder="No due date" />
            </Field>
            <SwitchRow checked={form.paid} onChange={(v) => set("paid", v)} title="Paid" description="Turn on once the money has arrived." />
            <Field label="Note on the invoice" hint="Printed under the lines." htmlFor="inv-note">
              <Textarea id="inv-note" value={form.note} onChange={(e) => set("note", e.target.value)} rows={3} />
            </Field>
          </div>
        </Card>

        {invoice && (
          <div className="flex flex-col gap-2">
            <ButtonLink href={`/admin/invoices/${invoice.id}/print`} target="_blank" variant="secondary">
              <IconDocument className="size-4" /> Open invoice to save as PDF
            </ButtonLink>
            {dirty && <p className="text-xs text-stone-500">Save first so the PDF shows your latest changes.</p>}
            <Button variant="danger" onClick={remove} disabled={pending}>
              <IconTrash className="size-4" /> Delete invoice
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger lg:col-span-2">{error}</p>}
      <div className="lg:col-span-2">
        <SaveBar
          dirty={dirty || !invoice}
          saving={pending}
          onSave={save}
          onDiscard={invoice ? () => setForm(saved) : undefined}
          saveLabel={invoice ? "Save invoice" : "Create invoice"}
        />
      </div>

      <CustomerModal
        open={adding}
        customer={null}
        onClose={() => setAdding(false)}
        onSaved={(c) => {
          setCustomers((cs) => [...cs, c].sort((a, b) => a.full_name.localeCompare(b.full_name)));
          set("customer_id", c.id);
        }}
      />
    </div>
  );
}
