"use client";

import { useState } from "react";
import { saveCompany } from "@/lib/actions/admin/companies";
import type { Company } from "@/lib/companies";
import { phoneProblem } from "@/lib/phone";
import { Button, Field, Input, Textarea } from "../ui";
import { Modal, useAction } from "../controls";
import { PhoneField } from "../customers/customer-modal";
import { AddressFields } from "../customers/address-fields";

type Form = Omit<Company, "id"> & { id?: string };

const blank = (name = ""): Form => ({
  name,
  email: "",
  phone: "",
  vat_number: "",
  company_number: "",
  line1: "",
  line2: "",
  city: "",
  county: "",
  postcode: "",
  alt_line1: "",
  alt_line2: "",
  alt_city: "",
  alt_county: "",
  alt_postcode: "",
  note: "",
});

/** Add or edit a company. `company` null means a new one. */
export function CompanyModal({
  open,
  company,
  initialName,
  onClose,
  onSaved,
}: {
  open: boolean;
  company: Company | null;
  initialName?: string;
  onClose: () => void;
  onSaved?: (c: Company) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={company ? `Edit ${company.name}` : "Add a company"} description="Only the name is needed. The second address is optional." wide>
      <CompanyForm company={company} initialName={initialName} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function CompanyForm({ company, initialName, onClose, onSaved }: { company: Company | null; initialName?: string; onClose: () => void; onSaved?: (c: Company) => void }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState<Form>(() => (company ? { ...company } : blank(initialName)));
  const [error, setError] = useState<string | null>(null);
  const set =
    <K extends keyof Form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (form.name.trim().length < 2) return setError("Please enter the company's name.");
    const bad = phoneProblem(form.phone, "telephone number");
    if (bad) return setError(bad);
    setError(null);
    const res = await run(() => saveCompany(form));
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
      className="grid gap-4 sm:grid-cols-6"
    >
      <Field label="Company name" htmlFor="co-name" className="sm:col-span-6">
        <Input id="co-name" value={form.name} onChange={set("name")} autoComplete="off" autoFocus />
      </Field>
      <PhoneField label="Telephone" id="co-phone" value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} placeholder="20 7946 0000" className="sm:col-span-3" />
      <Field label="Email" htmlFor="co-email" className="sm:col-span-3">
        <Input id="co-email" type="email" inputMode="email" value={form.email ?? ""} onChange={set("email")} autoComplete="off" />
      </Field>
      <Field label="VAT number" htmlFor="co-vat" className="sm:col-span-3">
        <Input id="co-vat" value={form.vat_number ?? ""} onChange={set("vat_number")} className="uppercase" autoComplete="off" />
      </Field>
      <Field label="Company number" htmlFor="co-num" className="sm:col-span-3">
        <Input id="co-num" value={form.company_number ?? ""} onChange={set("company_number")} className="uppercase" autoComplete="off" />
      </Field>
      <AddressFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} idPrefix="co" />
      <Field label="Note" hint="Only staff see this." htmlFor="co-note" className="sm:col-span-6">
        <Textarea id="co-note" value={form.note ?? ""} onChange={set("note")} rows={2} />
      </Field>
      {error && <p className="text-sm text-danger sm:col-span-6">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-6">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : company ? "Save company" : "Add company"}
        </Button>
      </div>
    </form>
  );
}
