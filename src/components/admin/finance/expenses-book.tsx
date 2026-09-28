"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { IconDocument, IconImage, IconPencil, IconPlus, IconSpinner, IconTrash, IconUpload } from "@/components/icons";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropdown } from "@/components/ui/dropdown";
import { deleteExpense, receiptUploadUrl, receiptViewUrl, restoreExpense, saveExpense } from "@/lib/actions/admin/finance";
import type { ExpenseRow } from "@/lib/data/finance";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/finance/categories";
import { parsePounds, vatFromGross } from "@/lib/finance/calc";
import { createClient } from "@/lib/supabase/client";
import { formatPence } from "@/lib/utils";
import { formatDate } from "../format";
import { Button, Field, Input, MoneyInput, Textarea } from "../ui";
import { Modal, useAction, useConfirm } from "../controls";

type Form = {
  id?: string;
  spent_on: string | null;
  supplier: string;
  category: string;
  amount: string;
  vat: string;
  note: string;
  receipt_path: string | null;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const blank = (): Form => ({ spent_on: today(), supplier: "", category: "stock", amount: "", vat: "", note: "", receipt_path: null });
const toForm = (e: ExpenseRow): Form => ({
  id: e.id,
  spent_on: e.spent_on,
  supplier: e.supplier,
  category: e.category,
  amount: (e.amount_pence / 100).toFixed(2),
  vat: (e.vat_pence / 100).toFixed(2),
  note: e.note ?? "",
  receipt_path: e.receipt_path,
});

export function ExpensesBook({ expenses, vatRate }: { expenses: ExpenseRow[]; vatRate: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("expense") === "new") setForm(blank());
  }, [params]);

  const close = () => {
    setForm(null);
    setError(null);
    if (params.get("expense")) {
      const q = new URLSearchParams(params.toString());
      q.delete("expense");
      router.replace(`/admin/finance${q.size ? `?${q}` : ""}`, { scroll: false });
    }
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) return toast.error("That file is over 15MB. Please use a smaller photo.");
    setUploading(true);
    try {
      const res = await receiptUploadUrl(f.type || "image/jpeg");
      if (!res.ok || !res.data) throw new Error(res.ok ? "" : res.error);
      const { error: err } = await createClient().storage.from("receipts").uploadToSignedUrl(res.data.path, res.data.token, f, { contentType: f.type || "image/jpeg" });
      if (err) throw err;
      set("receipt_path", res.data.path);
      toast.success("Receipt attached");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Couldn't upload the receipt. Please try again.");
    } finally {
      setUploading(false);
      if (camera.current) camera.current.value = "";
      if (file.current) file.current.value = "";
    }
  };

  const view = async (path: string) => {
    const w = window.open("", "_blank");
    const res = await receiptViewUrl(path);
    if (res.ok && res.data) {
      if (w) w.location.href = res.data.url;
      else window.location.href = res.data.url;
    } else {
      w?.close();
      toast.error(res.ok ? "Couldn't open the receipt." : res.error);
    }
  };

  const save = async () => {
    if (!form) return;
    const amount = parsePounds(form.amount);
    const vat = form.vat.trim() ? parsePounds(form.vat) : 0;
    if (!form.supplier.trim()) return setError("Who did you pay?");
    if (amount == null) return setError("Please enter what you paid, like 24.99");
    if (vat == null) return setError("The VAT amount doesn't look right");
    if (vat > amount) return setError("VAT can't be more than the total");
    if (!form.spent_on) return setError("Please choose the date");
    setError(null);
    const res = await run(() =>
      saveExpense({
        id: form.id,
        spent_on: form.spent_on!,
        supplier: form.supplier,
        category: form.category,
        amount_pence: amount,
        vat_pence: vat,
        note: form.note,
        receipt_path: form.receipt_path,
      }),
    );
    if (res.ok) close();
    else setError(res.error);
  };

  const remove = async (e: ExpenseRow) => {
    const yes = await confirm({ title: "Delete this expense?", description: `${e.supplier}, ${formatPence(e.amount_pence)}. You can undo straight after.`, confirmLabel: "Delete", danger: true });
    if (!yes) return;
    let row: Record<string, unknown> | undefined;
    await run(
      async () => {
        const r = await deleteExpense(e.id);
        if (r.ok) row = r.data;
        return r;
      },
      { undo: () => restoreExpense(row ?? {}) },
    );
  };

  const total = expenses.reduce((a, e) => a + e.amount_pence, 0);
  const vatTotal = expenses.reduce((a, e) => a + e.vat_pence, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <span className="font-display text-[1.6rem] tabular-nums text-aubergine-900">{formatPence(total)}</span> spent
          {vatTotal > 0 && <>, including {formatPence(vatTotal)} VAT you can claim back</>}
        </p>
        <Button onClick={() => setForm(blank())}>
          <IconPlus className="size-4" /> Add an expense
        </Button>
      </div>

      {expenses.length === 0 ? (
        <p className="border-y border-dashed border-ink/15 py-8 text-center text-sm text-ink-soft">No expenses in this period. Add fabric orders, postage and bills as they come in.</p>
      ) : (
        <ul className="divide-y divide-ink/10 border-y border-ink/10">
          {expenses.map((e) => (
            <li key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[7rem_1fr_auto_auto]">
              <span className="order-3 text-xs text-stone-500 sm:order-none sm:text-sm">{formatDate(e.spent_on)}</span>
              <div className="min-w-0">
                <p className="truncate text-[0.95rem] text-ink">{e.supplier}</p>
                <p className="truncate text-xs text-stone-500">
                  {expenseCategoryLabel(e.category)}
                  {e.note ? `, ${e.note}` : ""}
                </p>
              </div>
              <p className="text-right tabular-nums">
                {formatPence(e.amount_pence)}
                {e.vat_pence > 0 && <span className="block text-xs text-stone-500">VAT {formatPence(e.vat_pence)}</span>}
              </p>
              <div className="order-4 flex justify-end gap-1 sm:order-none">
                {e.receipt_path && (
                  <button type="button" onClick={() => view(e.receipt_path!)} className="grid size-10 place-items-center rounded-sm text-ink-soft hover:bg-cream-200 hover:text-ink" aria-label="View receipt" title="View receipt">
                    <IconDocument className="size-[18px]" />
                  </button>
                )}
                <button type="button" onClick={() => setForm(toForm(e))} className="grid size-10 place-items-center rounded-sm text-ink-soft hover:bg-cream-200 hover:text-ink" aria-label={`Edit ${e.supplier}`}>
                  <IconPencil className="size-[18px]" />
                </button>
                <button type="button" onClick={() => remove(e)} className="grid size-10 place-items-center rounded-sm text-ink-soft hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${e.supplier}`}>
                  <IconTrash className="size-[18px]" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!form} onClose={close} title={form?.id ? "Edit expense" : "Add an expense"} description="Only you can see this.">
        {form && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Who did you pay?" htmlFor="ex-supplier">
              <Input id="ex-supplier" value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="e.g. Makower UK" autoComplete="off" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="ex-date">
                <DatePicker id="ex-date" value={form.spent_on} onChange={(v) => set("spent_on", v)} clearable={false} />
              </Field>
              <Field label="What for" htmlFor="ex-cat">
                <Dropdown id="ex-cat" sheetTitle="What for" value={form.category} onChange={(v) => set("category", v)} options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total paid" htmlFor="ex-amount" hint="Including VAT">
                <MoneyInput id="ex-amount" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" className="text-lg" />
              </Field>
              <Field
                label="VAT in it"
                htmlFor="ex-vat"
                hint={
                  <button
                    type="button"
                    className="text-aubergine-700 underline underline-offset-2"
                    onClick={() => {
                      const a = parsePounds(form.amount);
                      if (a != null) set("vat", (vatFromGross(a, vatRate) / 100).toFixed(2));
                    }}
                  >
                    Work out {vatRate}%
                  </button>
                }
              >
                <MoneyInput id="ex-vat" value={form.vat} onChange={(e) => set("vat", e.target.value)} placeholder="0.00" />
              </Field>
            </div>
            <Field label="Note (optional)" htmlFor="ex-note">
              <Textarea id="ex-note" value={form.note} onChange={(e) => set("note", e.target.value)} className="min-h-16" />
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Receipt (optional)</p>
              <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => upload(e.target.files?.[0])} />
              <input ref={file} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} onChange={(e) => upload(e.target.files?.[0])} />
              {form.receipt_path ? (
                <div className="flex items-center gap-2 rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm">
                  <IconDocument className="size-4 text-gold-600" />
                  <button type="button" className="flex-1 truncate text-left text-aubergine-700 underline underline-offset-2" onClick={() => view(form.receipt_path!)}>
                    View receipt
                  </button>
                  <button type="button" className="text-xs text-stone-500 hover:text-danger" onClick={() => set("receipt_path", null)}>
                    Remove
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => camera.current?.click()} disabled={uploading}>
                    {uploading ? <IconSpinner className="size-4" /> : <IconImage className="size-4" />} Take a photo
                  </Button>
                  <Button variant="secondary" onClick={() => file.current?.click()} disabled={uploading}>
                    <IconUpload className="size-4" /> Choose a file
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || uploading}>
                {pending ? "Saving..." : form.id ? "Save changes" : "Add expense"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
