"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconClose, IconDownload, IconPlus, IconPrint, IconTrash } from "@/components/icons";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { deleteDeliveryNote, getNoteInvoice, saveDeliveryNote } from "@/lib/actions/admin/delivery-notes";
import type { NoteInvoice } from "@/lib/data/delivery-notes";
import { allocation, allocationErrors, deliveryNoteNo, destinationTotal, type DeliveryNote, type Destination } from "@/lib/delivery-notes";
import { addressBlock, manualInvoiceNo } from "@/lib/invoices";
import { cn, formatPence } from "@/lib/utils";
import { Button, ButtonLink, Card, Field, Input, Textarea } from "../ui";
import { SaveBar, useAction, useConfirm, useUnsavedGuard } from "../controls";
import { formatDate } from "../format";
import { InvoicePicker } from "./invoice-picker";

type Row = { key: number; line: number | null; qty: string };
type Place = { key: number; label: string; address: string; rows: Row[] };
type Form = { issued_on: string | null; po_number: string; reference: string; note: string; places: Place[] };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const amount = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 3 });
const parseQty = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/** The form's places as saved destinations; unfinished rows count as nothing. */
const toDestinations = (places: Place[]): Destination[] =>
  places.map((p) => ({
    label: p.label.trim(),
    address: p.address.trim(),
    items: p.rows.filter((r) => r.line != null).map((r) => ({ line: r.line!, qty: parseQty(r.qty) ?? 0 })),
  }));

function startForm(note: DeliveryNote | null, invoice: NoteInvoice | null, nextKey: () => number): Form {
  const saved = (note?.destinations ?? []).filter((d) => d.items?.length);
  const places: Place[] = saved.length
    ? saved.map((d) => ({ key: nextKey(), label: d.label ?? "", address: d.address ?? "", rows: d.items.map((x) => ({ key: nextKey(), line: x.line, qty: String(x.qty) })) }))
    : [
        {
          // A new note starts with everything going to one place; split it from there.
          key: nextKey(),
          label: "",
          address: note?.deliver_to ?? invoice?.deliver_to ?? invoice?.addresses[0]?.text ?? "",
          rows: (invoice?.items ?? []).map((l, i) => ({ key: nextKey(), line: i, qty: String(l.quantity) })),
        },
      ];
  return {
    issued_on: note?.issued_on ?? today(),
    po_number: note?.po_number ?? invoice?.po_number ?? "",
    reference: note?.reference ?? "",
    note: note?.note ?? "",
    places,
  };
}

/**
 * A delivery note written from one invoice. The goods can be split across several places, each with its own
 * address and its own share of every invoice line; together they must add up to exactly what was invoiced.
 */
export function DeliveryNoteEditor({ note, invoice: initialInvoice }: { note: DeliveryNote | null; invoice: NoteInvoice | null }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const confirm = useConfirm();
  // Keys for places and rows; a counter kept for the life of the editor.
  const [nextKey] = useState(() => {
    let n = 0;
    return () => n++;
  });
  const [invoice, setInvoice] = useState(initialInvoice);
  const [saved, setSaved] = useState(() => startForm(note, initialInvoice, nextKey));
  const [form, setForm] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved) || invoice?.id !== initialInvoice?.id;
  useUnsavedGuard(dirty);

  const lines = invoice?.items ?? [];
  const destinations = toDestinations(form.places);
  const alloc = allocation(lines, destinations);
  const problems = invoice ? allocationErrors(lines, destinations) : [];
  // Saved against an invoice that has since changed, so the split no longer matches it.
  const invoiceChanged = !!note?.invoice_id && !!invoice && note.destinations.some((d) => d.items?.length) && JSON.stringify(saved) === JSON.stringify(form) && problems.length > 0;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setPlace = (key: number, patch: Partial<Place>) => setForm((f) => ({ ...f, places: f.places.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  const setRow = (place: Place, key: number, patch: Partial<Row>) => setPlace(place.key, { rows: place.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });
  const addPlace = () => setForm((f) => ({ ...f, places: [...f.places, { key: nextKey(), label: "", address: "", rows: [{ key: nextKey(), line: null, qty: "" }] }] }));
  const removePlace = (key: number) => setForm((f) => ({ ...f, places: f.places.filter((p) => p.key !== key) }));
  /** Everything not yet given a place goes here. */
  const fillRest = (place: Place) => {
    const rows = place.rows.filter((r) => r.line != null).map((r) => ({ ...r }));
    for (const a of alloc) {
      if (a.remaining <= 0) continue;
      const existing = rows.find((r) => r.line === a.line);
      if (existing) existing.qty = amount((parseQty(existing.qty) ?? 0) + a.remaining);
      else rows.push({ key: nextKey(), line: a.line, qty: amount(a.remaining) });
    }
    setPlace(place.key, { rows });
  };

  const chooseInvoice = async (id: string) => {
    const inv = await getNoteInvoice(id).catch(() => null);
    if (!inv) return setError("Couldn't open that invoice. Please try again.");
    setError(null);
    setInvoice(inv);
    setForm((f) => ({
      ...f,
      po_number: f.po_number || inv.po_number || "",
      places: [{ key: nextKey(), label: "", address: f.places[0]?.address || inv.deliver_to || inv.addresses[0]?.text || "", rows: inv.items.map((l, i) => ({ key: nextKey(), line: i, qty: String(l.quantity) })) }],
    }));
  };

  const save = async () => {
    if (!invoice) return setError("Please choose the invoice these goods are for.");
    if (!form.issued_on) return setError("Please choose the date.");
    for (const p of form.places) for (const r of p.rows) if (r.line != null && parseQty(r.qty) == null) return setError(`${p.label || "A place"}: enter how many, like 2 or 1.5.`);
    if (problems.length) return setError(problems[0]);
    setError(null);
    const res = await run(() =>
      saveDeliveryNote({
        id: note?.id,
        invoice_id: invoice.id,
        issued_on: form.issued_on!,
        po_number: form.po_number,
        reference: form.reference,
        note: form.note,
        destinations,
      }),
    );
    if (!res.ok) return setError(res.error);
    setSaved(form);
    if (!note && res.data) router.replace(`/admin/delivery-notes/${res.data.id}`);
  };

  const remove = async () => {
    if (!note) return;
    const yes = await confirm({ title: "Delete this delivery note?", description: "The invoice stays as it is. This can't be undone.", confirmLabel: "Delete", danger: true });
    if (!yes) return;
    const res = await run(() => deleteDeliveryNote(note.id));
    if (res.ok) {
      setSaved(form);
      router.push("/admin/delivery-notes");
    }
  };

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
          <Button variant="danger" size="sm" onClick={remove} disabled={pending} className="sm:ml-auto">
            <IconTrash className="size-4" /> Delete
          </Button>
          {dirty && <p className="w-full text-xs text-stone-500">Save first so the printout shows your latest changes.</p>}
        </div>
      )}

      {/* ─────────── i. the invoice */}
      <section className="border-y border-ink/80 py-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-display text-lg tabular-nums text-gold-600">i.</span>
          <h2 className="font-display text-2xl text-aubergine-900">From invoice</h2>
        </div>
        {invoice ? (
          <div className="mt-4 grid gap-4 pl-0 sm:grid-cols-[auto_1fr_auto] sm:items-baseline sm:pl-9">
            <Link href={`/admin/invoices/${invoice.id}`} className="font-display text-3xl tabular-nums text-aubergine-900 underline-offset-4 hover:underline">
              {manualInvoiceNo(invoice.number)}
            </Link>
            <p className="text-sm leading-relaxed text-ink-soft">
              <span className="font-medium text-ink">{addressBlock(invoice.bill_to)[0]}</span>
              {addressBlock(invoice.bill_to).slice(1, 3).map((l, i) => (
                <span key={i}> · {l}</span>
              ))}
              <span className="block text-xs text-stone-500">Dated {formatDate(invoice.issued_on)}</span>
            </p>
            <p className="text-right">
              <span className="block font-display text-3xl tabular-nums text-aubergine-900">{formatPence(invoice.total_pence)}</span>
              <span className="text-xs text-stone-500">The note&apos;s total is the invoice&apos;s</span>
            </p>
          </div>
        ) : (
          <div className="mt-4 max-w-xl sm:pl-9">
            {note && (
              <p className="mb-3 text-sm text-ink-soft">
                This note was written before delivery notes came from invoices. It still prints as it was. Choose its invoice to split it across places or edit it.
              </p>
            )}
            <InvoicePicker onPick={(o) => chooseInvoice(o.id)} customerId={note?.customer_id ?? null} />
          </div>
        )}
      </section>

      {invoice && (
        <>
          {invoiceChanged && (
            <p className="mt-6 border-l-[3px] border-alert bg-alert/5 px-4 py-3 text-sm text-ink">
              <strong className="font-medium">The invoice has changed since this note was saved.</strong> Check the quantities below so they match it again, then save.
            </p>
          )}

          {/* ─────────── ii. what's left to place */}
          <section className="mt-8">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-display text-lg tabular-nums text-gold-600">ii.</span>
              <h2 className="font-display text-2xl text-aubergine-900">Goods on the invoice</h2>
            </div>
            <div className="overflow-x-auto rounded-[3px] border border-ink/12 bg-cream-50">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-ink/15 text-left text-xs text-stone-500">
                    <th className="px-4 py-2.5 font-normal">Code</th>
                    <th className="px-3 py-2.5 font-normal">Product</th>
                    <th className="px-3 py-2.5 text-right font-normal">Invoiced</th>
                    <th className="px-3 py-2.5 text-right font-normal">Placed</th>
                    <th className="px-4 py-2.5 text-right font-normal">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {alloc.map((a) => {
                    const l = lines[a.line];
                    const state = Math.abs(a.remaining) < 1e-6 ? "done" : a.remaining > 0 ? "short" : "over";
                    return (
                      <tr key={a.line} className="border-b border-ink/10 last:border-0">
                        <td className="px-4 py-2.5 tabular-nums text-stone-500">{l.code ?? ""}</td>
                        <td className="px-3 py-2.5">{l.description}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{amount(a.ordered)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{amount(a.allocated)}</td>
                        <td className={cn("px-4 py-2.5 text-right font-medium tabular-nums", state === "done" ? "text-success" : "text-danger")}>
                          {state === "done" ? "All placed" : state === "short" ? amount(a.remaining) : `${amount(-a.remaining)} too many`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ─────────── iii. the places */}
          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-4">
                <span className="font-display text-lg tabular-nums text-gold-600">iii.</span>
                <h2 className="font-display text-2xl text-aubergine-900">Where it&apos;s going</h2>
              </div>
              <Button variant="secondary" size="sm" onClick={addPlace} disabled={form.places.length >= 30}>
                <IconPlus className="size-4" /> Add another place
              </Button>
            </div>
            <div className="space-y-5">
              {form.places.map((p, pi) => {
                const used = new Set(p.rows.map((r) => r.line));
                const value = destinationTotal(lines, destinations[pi]);
                return (
                  <Card
                    key={p.key}
                    title={
                      <span className="flex items-baseline gap-3">
                        <span className="tabular-nums text-gold-600">{pi + 1}.</span>
                        {p.label.trim() || `Place ${pi + 1}`}
                      </span>
                    }
                    description={`${p.rows.filter((r) => r.line != null).length} product${p.rows.length === 1 ? "" : "s"} · ${formatPence(value)} at invoice prices`}
                    action={
                      form.places.length > 1 ? (
                        <button type="button" onClick={() => removePlace(p.key)} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-danger">
                          <IconClose className="size-3.5" /> Remove place
                        </button>
                      ) : undefined
                    }
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                      <div className="space-y-4">
                        <Field label="Name for this place (optional)" htmlFor={`pl-${p.key}`}>
                          <Input id={`pl-${p.key}`} value={p.label} onChange={(e) => setPlace(p.key, { label: e.target.value })} placeholder="e.g. Site A, Warehouse" maxLength={80} />
                        </Field>
                        <Field label="Deliver to" htmlFor={`pa-${p.key}`} hint="One line each, or just: Collected">
                          <Textarea id={`pa-${p.key}`} value={p.address} onChange={(e) => setPlace(p.key, { address: e.target.value })} rows={5} />
                        </Field>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                          {invoice.addresses.map((a) => (
                            <button key={a.label} type="button" onClick={() => setPlace(p.key, { address: a.text })} className="text-aubergine-700 underline-offset-2 hover:underline">
                              {a.label}
                            </button>
                          ))}
                          <button type="button" onClick={() => setPlace(p.key, { address: "Collected" })} className="text-aubergine-700 underline-offset-2 hover:underline">
                            Collected
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1.5 text-sm font-medium text-ink">What goes here</p>
                        <ul className="divide-y divide-ink/10 border-y border-ink/10">
                          {p.rows.map((r) => (
                            <li key={r.key} className="flex items-center gap-2 py-2">
                              <Dropdown
                                size="sm"
                                className="min-w-0 flex-1"
                                value={r.line == null ? null : String(r.line)}
                                onChange={(v) => setRow(p, r.key, { line: Number(v), qty: r.qty || amount(Math.max(0, alloc[Number(v)]?.remaining ?? 0)) || "" })}
                                placeholder="Choose a product from the invoice"
                                sheetTitle="Choose a product"
                                aria-label="Product"
                                options={lines.map((l, i) => ({
                                  value: String(i),
                                  label: [l.code, l.description].filter(Boolean).join(" "),
                                  text: l.description,
                                  hint: `${amount(alloc[i].remaining)} left`,
                                  disabled: used.has(i) && r.line !== i,
                                }))}
                              />
                              <Input
                                value={r.qty}
                                onChange={(e) => setRow(p, r.key, { qty: e.target.value })}
                                inputMode="decimal"
                                aria-label="How many"
                                placeholder="Qty"
                                className="w-24 text-right tabular-nums"
                              />
                              <button
                                type="button"
                                onClick={() => setPlace(p.key, { rows: p.rows.filter((x) => x.key !== r.key) })}
                                aria-label="Remove this line"
                                className="grid size-9 shrink-0 place-items-center rounded-sm text-stone-500 hover:bg-danger/10 hover:text-danger"
                              >
                                <IconClose className="size-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <button
                            type="button"
                            onClick={() => setPlace(p.key, { rows: [...p.rows, { key: nextKey(), line: null, qty: "" }] })}
                            disabled={p.rows.length >= lines.length}
                            className="text-aubergine-700 underline-offset-2 hover:underline disabled:text-stone-500 disabled:no-underline"
                          >
                            + Add a product
                          </button>
                          {alloc.some((a) => a.remaining > 0) && (
                            <button type="button" onClick={() => fillRest(p)} className="text-aubergine-700 underline-offset-2 hover:underline">
                              Put everything left here
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* ─────────── iv. the boxes at the top of the pad */}
          <Card title="Details" description="Printed at the top and bottom of every sheet." className="mt-8">
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Date" htmlFor="dn-date">
                <DatePicker id="dn-date" value={form.issued_on} onChange={(v) => set("issued_on", v)} clearable={false} />
              </Field>
              <Field label="P/O number" htmlFor="dn-po">
                <Input id="dn-po" value={form.po_number} onChange={(e) => set("po_number", e.target.value)} maxLength={60} />
              </Field>
              <Field label="Reference" htmlFor="dn-ref">
                <Input id="dn-ref" value={form.reference} onChange={(e) => set("reference", e.target.value)} maxLength={120} />
              </Field>
              <Field label="Note" htmlFor="dn-note" className="md:col-span-3">
                <Textarea id="dn-note" value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
              </Field>
            </div>
          </Card>
        </>
      )}

      {(error || (invoice && problems.length > 0)) && (
        <div className="mt-4 text-sm text-danger" role="status">
          {error ?? (
            <>
              <p className="font-medium">Before saving:</p>
              <ul className="mt-1 list-inside list-disc">
                {problems.slice(0, 5).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <SaveBar
        dirty={(dirty || !note) && !!invoice && problems.length === 0}
        saving={pending}
        onSave={save}
        onDiscard={note ? () => setForm(saved) : undefined}
        saveLabel={note ? `Save ${deliveryNoteNo(note.number)}` : "Create delivery note"}
      />
    </div>
  );
}
