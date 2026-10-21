"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconDownload, IconPlus, IconPrint, IconTrash } from "@/components/icons";
import { deleteDeliveryNote, saveDeliveryNote } from "@/lib/actions/admin/delivery-notes";
import { lineAmountPence, padLineText, type DeliveryLine, type DeliveryNote } from "@/lib/delivery-notes";
import { addressBlock, type ManualCustomer, type ProductPick } from "@/lib/invoices";
import { formatPence } from "@/lib/utils";
import { Button, ButtonLink, Card, Field, Textarea } from "../ui";
import { SaveBar, useAction, useConfirm, useUnsavedGuard } from "../controls";
import { CustomerModal } from "@/components/admin/customers/customer-modal";
import { PadAction } from "@/components/admin/documents/sheet";
import { CustomerBox, DeliverToActions, DeliverToBox, PadDate, PadInput, PadSearch, RemoveLine } from "@/components/admin/documents/pad-fields";
import { productSuggest } from "@/components/admin/documents/product-suggest";
import { DeliveryNoteSheet, DnRow } from "./delivery-note-document";

/** A product picked from the search, with how much of it. */
type ProductLine = { key: number; code: string; description: string; unit_price_pence: number; per: string | null; qty: string };
/** A line written by hand before products had to be picked: kept as it was, or removed. */
type OldLine = { key: number; old: Pick<DeliveryLine, "quantity" | "description" | "amount_pence"> };
type Line = ProductLine | OldLine;
type Form = {
  customer_id: string | null;
  deliver_to: string;
  po_number: string;
  reference: string;
  lines: Line[];
  issued_on: string | null;
  note: string;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

const isProduct = (l: Line): l is ProductLine => "code" in l;

/** "20", "2.5" or "1,000" as a number above zero; null otherwise. */
const parseQty = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

const UNIT_SHORT: Record<string, string> = { "per metre": "mtrs", "per roll": "rolls" };

const fromPick = (key: number, p: ProductPick, qty = "1"): ProductLine => ({
  key,
  code: p.code,
  description: p.description,
  unit_price_pence: p.unit_price_pence,
  per: p.per,
  qty,
});

function toForm(note: DeliveryNote | null, customerId: string | null): Form {
  if (!note) return { customer_id: customerId, deliver_to: "", po_number: "", reference: "", lines: [], issued_on: today(), note: "" };
  return {
    customer_id: note.customer_id,
    deliver_to: note.deliver_to ?? "",
    po_number: note.po_number ?? "",
    reference: note.reference ?? "",
    lines: note.items.map((l, i) =>
      l.code && l.unit_price_pence != null
        ? { key: i, code: l.code, description: l.description, unit_price_pence: l.unit_price_pence, per: l.per ?? null, qty: String(l.qty ?? "") }
        : { key: i, old: { quantity: l.quantity, description: l.description, amount_pence: l.amount_pence } },
    ),
    issued_on: note.issued_on,
    note: note.note ?? "",
  };
}

/** Fill in a delivery note on the pad itself, exactly as it prints. Goods are always picked from the products. */
export function DeliveryNoteEditor({
  note,
  customer: initialCustomer = null,
}: {
  note: DeliveryNote | null;
  /** Who it is for: the note's customer, or the one it was started from. */
  customer: ManualCustomer | null;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [customer, setCustomer] = useState(initialCustomer);
  const [saved, setSaved] = useState(() => toForm(note, initialCustomer?.id ?? null));
  const [form, setForm] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const nextKey = useRef(form.lines.length);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  // A note whose customer was removed still shows who it was written for.
  const orphan = note && !note.customer_id && !form.customer_id ? note.invoice_to : null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const chooseCustomer = (c: ManualCustomer) => {
    setCustomer(c);
    set("customer_id", c.id);
  };
  const setLine = (key: number, next: Line) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? next : l)) }));
  const removeLine = (key: number) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.key !== key) }));
  const addProduct = (p: ProductPick) => setForm((f) => ({ ...f, lines: [...f.lines, fromPick(nextKey.current++, p)] }));

  // Quantity times the product's price, as you type.
  const amounts = form.lines.map((l) => {
    if (!isProduct(l)) return l.old.amount_pence;
    const q = parseQty(l.qty);
    return q == null ? null : lineAmountPence(q, l.unit_price_pence);
  });
  const total = amounts.reduce<number>((s, a) => s + (a ?? 0), 0);

  const save = async () => {
    if (!form.customer_id) return setError("Please choose who the delivery note is for, or add a new customer.");
    if (!form.lines.length) return setError("Add at least one product, using the search under the goods.");
    for (const [i, l] of form.lines.entries()) {
      if (isProduct(l) && parseQty(l.qty) == null) return setError(`Line ${i + 1}: how much ${l.description}? Enter a number, like 20 or 2.5.`);
    }
    if (!form.issued_on) return setError("Please choose the date.");
    setError(null);
    const res = await run(() =>
      saveDeliveryNote({
        id: note?.id,
        customer_id: form.customer_id!,
        deliver_to: form.deliver_to,
        po_number: form.po_number,
        reference: form.reference,
        items: form.lines.map((l) =>
          isProduct(l)
            ? { code: l.code, description: l.description, qty: parseQty(l.qty)!, unit_price_pence: l.unit_price_pence, per: l.per }
            : { code: null, ...l.old },
        ),
        issued_on: form.issued_on!,
        note: form.note,
      }),
    );
    if (!res.ok) return setError(res.error);
    setSaved(form);
    if (!note && res.data) router.replace(`/admin/delivery-notes/${res.data.id}`);
  };

  const remove = async () => {
    if (!note) return;
    const yes = await confirm({ title: "Delete this delivery note?", description: "This can't be undone.", confirmLabel: "Delete", danger: true });
    if (!yes) return;
    const res = await run(() => deleteDeliveryNote(note.id));
    if (res.ok) {
      setSaved(form); // nothing left to lose, so let the guard go
      router.push("/admin/delivery-notes");
    }
  };

  const rows = [
    ...form.lines.map((l, i) =>
      isProduct(l) ? (
        <DnRow
          key={l.key}
          quantity={
            <span className="flex items-end justify-center gap-1">
              <PadInput
                value={l.qty}
                onChange={(e) => setLine(l.key, { ...l, qty: e.target.value })}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Line ${i + 1} quantity${UNIT_SHORT[l.per ?? ""] ? ` in ${UNIT_SHORT[l.per ?? ""]}` : ""}`}
                aria-invalid={parseQty(l.qty) == null}
                className="w-16 text-right tabular-nums"
              />
              {UNIT_SHORT[l.per ?? ""] && <span>{UNIT_SHORT[l.per ?? ""]}</span>}
            </span>
          }
          description={
            // Only ever a product from the search; picking another one swaps it, keeping the quantity.
            <PadSearch
              {...productSuggest}
              onPick={(p) => setLine(l.key, fromPick(l.key, p, l.qty))}
              display={padLineText(l, formatPence)}
              placeholder="Type a code or name to change the product"
              label={`Line ${i + 1} product`}
              className="-ml-1"
              empty={(q) => (q ? `No product matches \u201c${q}\u201d.` : "No products yet.")}
            />
          }
          amount={amounts[i] != null ? formatPence(amounts[i]!) : ""}
          action={<RemoveLine onClick={() => removeLine(l.key)} label={`Remove line ${i + 1}`} />}
        />
      ) : (
        <DnRow
          key={l.key}
          quantity={l.old.quantity}
          description={<span title="Written by hand before products had to be picked">{l.old.description}</span>}
          amount={l.old.amount_pence != null ? formatPence(l.old.amount_pence) : ""}
          muted
          action={<RemoveLine onClick={() => removeLine(l.key)} label={`Remove line ${i + 1}`} />}
        />
      ),
    ),
    form.lines.length < 100 && (
      <DnRow
        key="add"
        description={
          <PadSearch
            {...productSuggest}
            onPick={addProduct}
            placeholder="Add a product: type its code or name"
            label="Add a product by code or name"
            className="-ml-1 text-[14px]"
            empty={(q) => (q ? `No product matches \u201c${q}\u201d.` : "No products yet.")}
          />
        }
      />
    ),
    ...(form.lines.length ? [<DnRow key="total" description="Total" amount={formatPence(total)} strong />] : []),
  ];

  return (
    <div>
      {note && (
        <div className="mb-4 flex flex-wrap gap-2">
          <ButtonLink href={`/admin/delivery-notes/${note.id}/print?do=print`} target="_blank" variant="secondary" size="sm">
            <IconPrint className="size-4" /> Print
          </ButtonLink>
          <ButtonLink href={`/admin/delivery-notes/${note.id}/print?do=pdf`} target="_blank" variant="secondary" size="sm">
            <IconDownload className="size-4" /> PDF
          </ButtonLink>
          <ButtonLink href={`/admin/invoices/new?delivery_note=${note.id}`} variant="secondary" size="sm">
            <IconPlus className="size-4" /> Invoice these goods
          </ButtonLink>
          <Button variant="danger" size="sm" onClick={remove} disabled={pending} className="sm:ml-auto">
            <IconTrash className="size-4" /> Delete
          </Button>
          {dirty && <p className="w-full text-xs text-stone-500">Save first so the printout shows your latest changes.</p>}
        </div>
      )}

      <div className="-mx-4 overflow-x-auto bg-cream-200 py-8 sm:mx-0 sm:rounded-[3px]">
        <div className="mx-auto w-fit px-12">
          <DeliveryNoteSheet
            grow
            number={note ? String(note.number) : <span className="font-sans text-[13px] italic text-stone-500">Given when saved</span>}
            date={<PadDate value={form.issued_on} onChange={(v) => set("issued_on", v)} label="Date" center />}
            poNumber={<PadInput value={form.po_number} onChange={(e) => set("po_number", e.target.value)} aria-label="P/O number" className="text-center" />}
            reference={<PadInput value={form.reference} onChange={(e) => set("reference", e.target.value)} aria-label="Reference" className="text-center" />}
            invoiceTo={<CustomerBox customer={customer} onChange={chooseCustomer} onAdd={() => setAdding(true)} orphan={orphan} />}
            invoiceToAction={<PadAction onClick={() => setAdding(true)}>+ New customer</PadAction>}
            deliverTo={<DeliverToBox value={form.deliver_to} onChange={(v) => set("deliver_to", v)} />}
            deliverToAction={<DeliverToActions onPick={(v) => set("deliver_to", v)} invoiceAddress={addressBlock(customer)} />}
            rows={rows}
          />
        </div>
      </div>

      <Card title="Note" description="Printed under the goods, e.g. paid on account." className="mt-6">
        <Field label="Note on the delivery note" htmlFor="dn-note">
          <Textarea id="dn-note" value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
        </Field>
      </Card>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <SaveBar
        dirty={dirty || !note}
        saving={pending}
        onSave={save}
        onDiscard={note ? () => setForm(saved) : undefined}
        saveLabel={note ? "Save delivery note" : "Create delivery note"}
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
