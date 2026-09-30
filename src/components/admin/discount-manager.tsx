"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconPencil, IconPlus, IconTag, IconTrash } from "@/components/icons";
import { deleteDiscount, restoreDiscount, saveDiscount, setDiscountActive } from "@/lib/actions/admin/marketing";
import { cn } from "@/lib/utils";
import { discountState, discountSummary, penceToPounds, poundsToPence, type DiscountRow } from "./format";
import { Modal, Segmented, Switch, useAction, useConfirm } from "./controls";
import { CopyButton } from "@/components/ui/copy-button";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge, Button, EmptyState, Field, Input, MoneyInput, UnitInput } from "./ui";

export function DiscountManager({ discounts, startNew }: { discounts: DiscountRow[]; startNew: boolean }) {
  const { run } = useAction();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<DiscountRow | "new" | null>(startNew ? "new" : null);

  const remove = async (d: DiscountRow) => {
    if (!(await confirm({ title: `Delete ${d.code}?`, description: "Customers won't be able to use it any more. If you might want it again, switch it off instead.", confirmLabel: "Delete", danger: true }))) return;
    const r = await run(() => deleteDiscount(d.id), { success: "" });
    if (r.ok && r.data) {
      const row = r.data.row;
      toast.success(`${d.code} deleted`, { duration: 8000, action: { label: "Undo", onClick: () => run(() => restoreDiscount(row), { success: "Code restored" }) } });
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <IconPlus className="size-4" /> Create a code
        </Button>
      </div>
      {discounts.length === 0 ? (
        <EmptyState icon={<IconTag />} title="No discount codes yet" description="Create one for a sale, a newsletter thank-you or a loyal customer." action={<Button onClick={() => setEditing("new")}>Create a code</Button>} />
      ) : (
        <ul className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          {discounts.map((d) => {
            const st = discountState(d);
            return (
              <li key={d.id} className="flex flex-col gap-3 border-b border-ink/10 px-4 py-4 last:border-0 sm:flex-row sm:items-center md:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-medium tracking-wider text-aubergine-900">{d.code}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-[0.95rem]">{discountSummary(d)}</p>
                  <p className="text-xs text-stone-500">
                    Used {d.uses} time{d.uses === 1 ? "" : "s"}
                    {d.max_uses ? ` of ${d.max_uses}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <CopyButton text={d.code} label="Copy code" className="min-h-10" />
                  <span className="mx-2">
                    <Switch
                      checked={d.is_active}
                      label={d.is_active ? "Switch off" : "Switch on"}
                      onChange={(v) => run(() => setDiscountActive(d.id, v), { undo: () => setDiscountActive(d.id, !v) })}
                    />
                  </span>
                  <button onClick={() => setEditing(d)} className="grid size-11 place-items-center rounded-[3px] text-ink-soft hover:bg-cream-200" aria-label={`Edit ${d.code}`}>
                    <IconPencil className="size-4" />
                  </button>
                  <button onClick={() => remove(d)} className="grid size-11 place-items-center rounded-[3px] text-danger/70 hover:bg-danger/10" aria-label={`Delete ${d.code}`}>
                    <IconTrash className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New discount code" : "Edit discount code"} wide>
        {editing && <DiscountForm initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

const toDateInput = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function DiscountForm({ initial, onDone }: { initial: DiscountRow | null; onDone: () => void }) {
  const { run, pending } = useAction();
  const [code, setCode] = useState(initial?.code ?? "");
  const [kind, setKind] = useState<DiscountRow["kind"]>(initial?.kind ?? "percent");
  const [percent, setPercent] = useState(initial?.kind === "percent" ? String(initial.value) : "10");
  const [amount, setAmount] = useState(initial?.kind === "fixed" ? penceToPounds(initial.value) : "");
  const [min, setMin] = useState(initial?.min_subtotal_pence ? penceToPounds(initial.min_subtotal_pence) : "");
  const [maxUses, setMaxUses] = useState(initial?.max_uses ? String(initial.max_uses) : "");
  const [once, setOnce] = useState(initial?.once_per_customer ?? false);
  const [starts, setStarts] = useState(toDateInput(initial?.starts_at ?? null));
  const [ends, setEnds] = useState(toDateInput(initial?.ends_at ?? null));
  const [active, setActive] = useState(initial?.is_active ?? true);

  const value = kind === "percent" ? Number(percent) || 0 : kind === "fixed" ? poundsToPence(amount) ?? 0 : 0;
  const draft = {
    kind,
    value,
    min_subtotal_pence: poundsToPence(min) ?? 0,
    max_uses: maxUses ? Number(maxUses) : null,
    once_per_customer: once,
    starts_at: starts ? new Date(`${starts}T00:00:00`).toISOString() : null,
    ends_at: ends ? new Date(`${ends}T23:59:59`).toISOString() : null,
  };

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run(() => saveDiscount({ id: initial?.id, code, ...draft, is_active: active }));
        if (r.ok) onDone();
      }}
    >
      <Field label="The code customers type" htmlFor="dcode" hint="Letters and numbers, no spaces. e.g. SPRING20">
        <div className="flex gap-2">
          <Input id="dcode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} autoFocus={!initial} className="font-mono text-lg tracking-wider" />
          <Button variant="secondary" onClick={() => setCode(`BQ${Math.random().toString(36).slice(2, 7).toUpperCase()}`)}>
            Make one up
          </Button>
        </div>
      </Field>

      <Field label="What does it do?">
        <Segmented
          value={kind}
          onChange={setKind}
          className="w-full"
          options={[
            { value: "percent", label: "% off" },
            { value: "fixed", label: "£ off" },
            { value: "free_shipping", label: "Free delivery" },
          ]}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {kind === "percent" && (
          <Field label="Percentage off" htmlFor="dpct">
            <UnitInput unit="%" id="dpct" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
        )}
        {kind === "fixed" && (
          <Field label="Money off" htmlFor="damt">
            <MoneyInput id="damt" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5.00" />
          </Field>
        )}
        <Field label="Only on orders over (optional)" htmlFor="dmin">
          <MoneyInput id="dmin" value={min} onChange={(e) => setMin(e.target.value)} placeholder="No minimum" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts (optional)" htmlFor="dstart" hint="Leave empty to start now.">
          <DatePicker id="dstart" value={starts || null} onChange={(v) => { setStarts(v ?? ""); if (v && ends && ends < v) setEnds(""); }} placeholder="Starts now" />
        </Field>
        <Field label="Ends (optional)" htmlFor="dend" hint="Leave empty to run until you switch it off.">
          <DatePicker id="dend" value={ends || null} onChange={(v) => setEnds(v ?? "")} min={starts || undefined} placeholder="No end date" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stop after this many uses (optional)" htmlFor="dmax">
          <Input id="dmax" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/[^\d]/g, ""))} placeholder="No limit" />
        </Field>
        <div className="flex flex-col justify-end gap-3 pb-1">
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            Each customer can only use it once <Switch checked={once} onChange={setOnce} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            Switched on <Switch checked={active} onChange={setActive} />
          </label>
        </div>
      </div>

      <div className={cn("border-l-2 border-gold-500 bg-gold-100/60 px-4 py-3")}>
        <p className="text-xs text-gold-600">In plain words</p>
        <p className="font-display text-xl text-aubergine-900">
          {code || "YOURCODE"}: {discountSummary(draft)}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || code.length < 3}>
          {initial ? "Save" : "Create code"}
        </Button>
      </div>
    </form>
  );
}
