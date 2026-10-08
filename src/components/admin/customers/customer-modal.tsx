"use client";

import { useState } from "react";
import { saveManualCustomer } from "@/lib/actions/admin/invoices";
import type { ManualCustomer } from "@/lib/invoices";
import { Button, Field, Input, Textarea } from "../ui";
import { Modal, useAction } from "../controls";

type Form = Omit<ManualCustomer, "id" | "full_name"> & {
  id?: string;
  full_name: string;
};

const blank = (): Form => ({
  full_name: "",
  company: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  county: "",
  postcode: "",
  note: "",
});

/** Add or edit a customer by hand. `customer` null means a new one. */
export function CustomerModal({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer: ManualCustomer | null;
  onClose: () => void;
  onSaved?: (c: ManualCustomer) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Edit customer" : "Add a customer"}
      description="Only the name is needed. Add a phone number to call them from the list."
      wide
    >
      {/* Mounted fresh each time the modal opens, so it always starts from this customer. */}
      <CustomerForm customer={customer} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer: ManualCustomer | null; onClose: () => void; onSaved?: (c: ManualCustomer) => void }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState<Form>(() => (customer ? { ...customer } : blank()));
  const [error, setError] = useState<string | null>(null);

  const set =
    <K extends keyof Form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (form.full_name.trim().length < 2) return setError("Please enter the customer's name.");
    setError(null);
    const res = await run(() => saveManualCustomer(form));
    if (res.ok && res.data) {
      onSaved?.(res.data);
      onClose();
    } else if (!res.ok) setError(res.error);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Name" htmlFor="c-name">
        <Input id="c-name" value={form.full_name} onChange={set("full_name")} autoComplete="off" autoFocus />
      </Field>
      <Field label="Company" hint="Optional" htmlFor="c-company">
        <Input id="c-company" value={form.company ?? ""} onChange={set("company")} autoComplete="off" />
      </Field>
      <Field label="Telephone" htmlFor="c-phone">
        <Input id="c-phone" type="tel" inputMode="tel" value={form.phone ?? ""} onChange={set("phone")} placeholder="07700 900123" autoComplete="off" />
      </Field>
      <Field label="Email" htmlFor="c-email">
        <Input id="c-email" type="email" inputMode="email" value={form.email ?? ""} onChange={set("email")} autoComplete="off" />
      </Field>
      <Field label="Address" htmlFor="c-line1" className="sm:col-span-2">
        <Input id="c-line1" value={form.line1 ?? ""} onChange={set("line1")} placeholder="First line" autoComplete="off" />
        <Input value={form.line2 ?? ""} onChange={set("line2")} placeholder="Second line (optional)" aria-label="Address second line" autoComplete="off" />
      </Field>
      <Field label="Town or city" htmlFor="c-city">
        <Input id="c-city" value={form.city ?? ""} onChange={set("city")} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="County" htmlFor="c-county">
          <Input id="c-county" value={form.county ?? ""} onChange={set("county")} autoComplete="off" />
        </Field>
        <Field label="Postcode" htmlFor="c-postcode">
          <Input id="c-postcode" value={form.postcode ?? ""} onChange={set("postcode")} className="uppercase" autoComplete="off" />
        </Field>
      </div>
      <Field label="Note" hint="Only staff see this." htmlFor="c-note" className="sm:col-span-2">
        <Textarea id="c-note" value={form.note ?? ""} onChange={set("note")} rows={2} />
      </Field>

      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : customer ? "Save customer" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
