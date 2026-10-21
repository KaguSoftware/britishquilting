"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconDownload, IconPrint, IconTrash } from "@/components/icons";
import { DatePicker } from "@/components/ui/date-picker";
import { customerDeliveryNotes, deleteInvoice, saveInvoice } from "@/lib/actions/admin/invoices";
import { vatFromGross } from "@/lib/finance/calc";
import { addressBlock, customerNo, invoiceTotal, lineAmount, manualInvoiceNo, type InvoiceLine, type ManualCustomer, type ManualInvoice, type ProductPick } from "@/lib/invoices";
import { deliveryNoteNo, type DeliveryLine, type DeliveryNoteOption } from "@/lib/delivery-notes";
import { formatPence } from "@/lib/utils";
import { Button, ButtonLink, Card, Field, Textarea } from "../ui";
import { SaveBar, SwitchRow, useAction, useConfirm, useUnsavedGuard } from "../controls";
import { formatDate } from "../format";
import { CustomerModal } from "@/components/admin/customers/customer-modal";
import { CustomerBox, DeliverToActions, DeliverToBox, PadDate, PadDropdown, PadInput, PadSearch, RemoveLine } from "@/components/admin/documents/pad-fields";
import { PadAction } from "@/components/admin/documents/sheet";
import { productSuggest } from "@/components/admin/documents/product-suggest";
import { INVOICE_ROWS, InvoiceRow, InvoiceSheet } from "./invoice-document";

/** A product picked from the search, with how many. Its price is the product's; only the quantity is typed. */
type ProductLine = { key: number; code: string; description: string; unit_price_pence: number; quantity: string };
/** A line written by hand before products had to be picked: kept as it was, or removed. */
type OldLine = { key: number; old: InvoiceLine };
type Line = ProductLine | OldLine;
type Form = {
  customer_id: string | null;
  lines: Line[];
  issued_on: string | null;
  due_on: string | null;
  note: string;
  paid: boolean;
  deliver_to: string;
  po_number: string;
  customer_code: string;
  delivery_note_id: string | null;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

const isProduct = (l: Line): l is ProductLine => "code" in l;

const fromPick = (key: number, p: ProductPick, quantity = "1"): ProductLine => ({ key, code: p.code, description: p.description, unit_price_pence: p.unit_price_pence, quantity });

function toForm(inv: ManualInvoice | null, customer: ManualCustomer | null, fromNote: DeliveryNoteOption | null, fromItems: DeliveryLine[]): Form {
  const customerId = customer?.id ?? null;
  // Invoicing a delivery note: its products come across with their quantities and prices.
  const copied = fromItems
    .filter((l) => l.code && l.qty != null && l.unit_price_pence != null)
    .map((l, i): ProductLine => ({ key: i, code: l.code!, description: l.description, unit_price_pence: l.unit_price_pence!, quantity: String(l.qty) }));
  if (!inv)
    return {
      customer_id: fromNote?.customer_id ?? customerId,
      lines: copied,
      issued_on: today(),
      due_on: null,
      note: "",
      paid: false,
      deliver_to: fromNote?.deliver_to ?? "",
      po_number: fromNote?.po_number ?? "",
      customer_code: customer?.number ? customerNo(customer.number) : "",
      delivery_note_id: fromNote?.id ?? null,
    };
  return {
    customer_id: inv.customer_id,
    lines: inv.items.map((l, i): Line =>
      l.code ? { key: i, code: l.code, description: l.description, unit_price_pence: l.unit_price_pence, quantity: String(l.quantity) } : { key: i, old: l },
    ),
    issued_on: inv.issued_on,
    due_on: inv.due_on,
    note: inv.note ?? "",
    paid: !!inv.paid_at,
    deliver_to: inv.deliver_to ?? "",
    po_number: inv.po_number ?? "",
    customer_code: inv.customer_code ?? "",
    delivery_note_id: inv.delivery_note_id,
  };
}

const parseQty = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/** Fill in an invoice on the pad itself, exactly as it prints. */
export function InvoiceEditor({
  invoice,
  customer: initialCustomer = null,
  deliveryNotes: initialNotes = [],
  fromNote = null,
  fromNoteItems = [],
  vatRate,
}: {
  invoice: ManualInvoice | null;
  /** Who it is for: the invoice's customer, or the one it was started from. */
  customer: ManualCustomer | null;
  /** That customer's delivery notes. */
  deliveryNotes: DeliveryNoteOption[];
  /** Start a new invoice from this delivery note. */
  fromNote?: DeliveryNoteOption | null;
  /** That delivery note's goods. */
  fromNoteItems?: DeliveryLine[];
  vatRate: number;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [customer, setCustomer] = useState(initialCustomer);
  const [deliveryNotes, setDeliveryNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(() => toForm(invoice, initialCustomer, fromNote, fromNoteItems));
  const [form, setForm] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const nextKey = useRef(form.lines.length);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  // An invoice whose customer was removed still shows who it was written for.
  const orphan = invoice && !invoice.customer_id && !form.customer_id ? invoice.bill_to : null;

  // Quantity times the product's price, as you type.
  const lineValues = form.lines.map((l) => (isProduct(l) ? { quantity: parseQty(l.quantity), unit_price_pence: l.unit_price_pence } : l.old));
  const total = invoiceTotal(lineValues.map((v) => ({ quantity: v.quantity ?? 0, unit_price_pence: v.unit_price_pence })));
  const vat = vatFromGross(total, vatRate);
  const pages = Math.max(1, Math.ceil(form.lines.length / (INVOICE_ROWS - 1)));

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (key: number, next: Line) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? next : l)) }));
  const removeLine = (key: number) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.key !== key) }));
  const addProduct = (p: ProductPick) => setForm((f) => ({ ...f, lines: [...f.lines, fromPick(nextKey.current++, p)] }));

  const customerNotes = deliveryNotes.filter((n) => n.customer_id === form.customer_id);
  const chooseCustomer = async (c: ManualCustomer) => {
    const previousNo = customer?.number ? customerNo(customer.number) : "";
    setCustomer(c);
    setForm((f) => ({
      ...f,
      customer_id: c.id,
      // A delivery note only makes sense for its own customer.
      delivery_note_id: f.customer_id === c.id ? f.delivery_note_id : null,
      // The Customer Code box follows the customer number, unless someone typed their own code.
      customer_code: !f.customer_code.trim() || f.customer_code === previousNo ? customerNo(c.number) : f.customer_code,
    }));
    if (c.id !== form.customer_id) setDeliveryNotes(await customerDeliveryNotes(c.id).catch(() => []));
  };
  const chooseNote = (id: string | null) => {
    const n = deliveryNotes.find((x) => x.id === id);
    // Fill the boxes the delivery note already answers, without overwriting anything typed.
    setForm((f) => ({ ...f, delivery_note_id: id, deliver_to: f.deliver_to || n?.deliver_to || "", po_number: f.po_number || n?.po_number || "" }));
  };

  const save = async () => {
    if (!form.customer_id) return setError("Please choose who the invoice is for, or add a new customer.");
    if (!form.lines.length) return setError("Add at least one product, using the search under the goods.");
    for (const [i, l] of form.lines.entries()) {
      if (isProduct(l) && parseQty(l.quantity) == null) return setError(`Line ${i + 1}: how many ${l.description}? Enter a number, like 2 or 1.5.`);
    }
    if (!form.issued_on) return setError("Please choose the invoice date.");
    setError(null);
    const res = await run(() =>
      saveInvoice({
        id: invoice?.id,
        customer_id: form.customer_id!,
        items: form.lines.map((l) =>
          isProduct(l) ? { code: l.code, description: l.description, quantity: parseQty(l.quantity)!, unit_price_pence: l.unit_price_pence } : { ...l.old, code: null },
        ),
        issued_on: form.issued_on!,
        due_on: form.due_on,
        note: form.note,
        paid: form.paid,
        deliver_to: form.deliver_to,
        po_number: form.po_number,
        customer_code: form.customer_code,
        delivery_note_id: form.delivery_note_id,
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

  const qty = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  const rows = [
    ...form.lines.map((l, i) => {
      if (!isProduct(l))
        return (
          <InvoiceRow
            key={l.key}
            quantity={qty(l.old.quantity)}
            description={<span title="Written by hand before products had to be picked">{l.old.description}</span>}
            price={formatPence(l.old.unit_price_pence)}
            amount={formatPence(lineAmount(l.old))}
            muted
            action={<RemoveLine onClick={() => removeLine(l.key)} label={`Remove line ${i + 1}`} />}
          />
        );
      const q = parseQty(l.quantity);
      return (
        <InvoiceRow
          key={l.key}
          code={<span className="px-1">{l.code}</span>}
          quantity={
            <PadInput
              value={l.quantity}
              onChange={(e) => setLine(l.key, { ...l, quantity: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              aria-label={`Line ${i + 1} quantity`}
              aria-invalid={q == null}
              className="tabular-nums"
            />
          }
          description={
            // Only ever a product from the search; picking another one swaps it, keeping the quantity.
            <PadSearch
              {...productSuggest}
              onPick={(p) => setLine(l.key, fromPick(l.key, p, l.quantity))}
              display={l.description}
              placeholder="Type a code or name to change the product"
              label={`Line ${i + 1} product`}
              className="-ml-1"
              empty={(term) => (term ? `No product matches \u201c${term}\u201d.` : "No products yet.")}
            />
          }
          price={formatPence(l.unit_price_pence)}
          amount={q != null ? formatPence(lineAmount({ quantity: q, unit_price_pence: l.unit_price_pence })) : ""}
          action={<RemoveLine onClick={() => removeLine(l.key)} label={`Remove line ${i + 1}`} />}
        />
      );
    }),
    form.lines.length < 100 && (
      <InvoiceRow
        key="add"
        description={
          <PadSearch
            {...productSuggest}
            onPick={addProduct}
            placeholder="Add a product: type its code or name"
            label="Add a product by code or name"
            className="-ml-1"
            empty={(term) => (term ? `No product matches \u201c${term}\u201d.` : "No products yet.")}
          />
        }
      />
    ),
  ];

  return (
    <div>
      {invoice && (
        <div className="mb-4 flex flex-wrap gap-2">
          <ButtonLink href={`/admin/invoices/${invoice.id}/print?do=print`} target="_blank" variant="secondary" size="sm">
            <IconPrint className="size-4" /> Print
          </ButtonLink>
          <ButtonLink href={`/admin/invoices/${invoice.id}/print?do=pdf`} target="_blank" variant="secondary" size="sm">
            <IconDownload className="size-4" /> PDF
          </ButtonLink>
          <Button variant="danger" size="sm" onClick={remove} disabled={pending} className="sm:ml-auto">
            <IconTrash className="size-4" /> Delete
          </Button>
          {dirty && <p className="w-full text-xs text-stone-500">Save first so the printout shows your latest changes.</p>}
        </div>
      )}

      <div className="-mx-4 overflow-x-auto bg-cream-200 py-8 sm:mx-0 sm:rounded-[3px]">
        <div className="mx-auto w-fit px-20">
          <InvoiceSheet
            grow
            number={invoice ? manualInvoiceNo(invoice.number) : <span className="text-[13px] italic text-stone-500">Given when saved</span>}
            date={<PadDate value={form.issued_on} onChange={(v) => set("issued_on", v)} label="Invoice date" />}
            page={`1 of ${pages}`}
            delNoteNo={
              <PadDropdown
                value={form.delivery_note_id ?? ""}
                onChange={(v) => chooseNote(v || null)}
                placeholder={customerNotes.length ? "None" : " "}
                sheetTitle="Choose a delivery note"
                aria-label="Delivery note number"
                disabled={!customerNotes.length}
                options={[
                  { value: "", label: "None" },
                  ...customerNotes.map((n) => ({ value: n.id, label: deliveryNoteNo(n.number), text: String(n.number), hint: formatDate(n.issued_on) })),
                ]}
              />
            }
            customerCode={<PadInput value={form.customer_code} onChange={(e) => set("customer_code", e.target.value)} aria-label="Customer code" />}
            poNumber={<PadInput value={form.po_number} onChange={(e) => set("po_number", e.target.value)} aria-label="PO number" />}
            invoiceTo={<CustomerBox customer={customer} onChange={chooseCustomer} onAdd={() => setAdding(true)} orphan={orphan} />}
            invoiceToAction={<PadAction onClick={() => setAdding(true)}>+ New customer</PadAction>}
            deliverTo={<DeliverToBox value={form.deliver_to} onChange={(v) => set("deliver_to", v)} />}
            deliverToAction={<DeliverToActions onPick={(v) => set("deliver_to", v)} invoiceAddress={addressBlock(customer)} />}
            rows={rows}
            net={formatPence(total - vat)}
            vat={formatPence(vat)}
            total={formatPence(total)}
          />
        </div>
      </div>

      <Card title="Payment and notes" description="Printed under the goods on the invoice." className="mt-6">
        <div className="grid gap-5 md:grid-cols-[220px_1fr_1.4fr] md:items-start">
          <Field label="Payment due" hint="Optional" htmlFor="inv-due">
            <DatePicker id="inv-due" value={form.due_on} onChange={(v) => set("due_on", v)} min={form.issued_on ?? undefined} placeholder="No due date" />
          </Field>
          <SwitchRow checked={form.paid} onChange={(v) => set("paid", v)} title="Paid" description="Turn on once the money has arrived." />
          <Field label="Note" htmlFor="inv-note">
            <Textarea id="inv-note" value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
          </Field>
        </div>
      </Card>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <SaveBar
        dirty={dirty || !invoice}
        saving={pending}
        onSave={save}
        onDiscard={invoice ? () => setForm(saved) : undefined}
        saveLabel={invoice ? "Save invoice" : "Create invoice"}
      />

      <CustomerModal
        open={adding}
        customer={null}
        onClose={() => setAdding(false)}
        onSaved={chooseCustomer}
      />
    </div>
  );
}
