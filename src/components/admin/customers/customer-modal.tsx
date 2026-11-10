"use client";

import { useState } from "react";
import { saveManualCustomer } from "@/lib/actions/admin/invoices";
import { GENDERS, customerNo, type ManualCustomer } from "@/lib/invoices";
import { Button, Field, Input, Select, Textarea } from "../ui";
import { Modal, useAction } from "../controls";
import { parseInternational, phoneProblem, phoneRule, trimNational } from "@/lib/phone";
import { DatePicker } from "@/components/ui/date-picker";
import { Disclosure } from "@/components/ui/disclosure";
import { IconPlus } from "@/components/icons";

type Form = Omit<ManualCustomer, "id" | "full_name" | "number"> & {
  id?: string;
  full_name: string;
};

const blank = (): Form => ({
  full_name: "",
  company: "",
  email: "",
  phone: "",
  alt_phone: "",
  gender: null,
  dob: null,
  line1: "",
  line2: "",
  city: "",
  county: "",
  postcode: "",
  note: "",
});

const DEFAULT_CODE = "44";

/** "+44 7785 367252" as ["44", "7785 367252"]. A UK number written 07785... is read as +44; anything else stays as written. */
function splitPhone(v: string | null): [string, string] {
  const t = (v ?? "").trim();
  if (!t) return [DEFAULT_CODE, ""];
  const plus = parseInternational(t);
  if (plus) return plus;
  if (/^\+44\d{9,10}$/.test(t)) return ["44", t.slice(3)];
  if (/^0\d{9,10}$/.test(t)) return [DEFAULT_CODE, t.slice(1)];
  return ["", t];
}

/** A phone number as two boxes, the country code and the number. The form keeps one string, "+44 7785 367252". */
function PhoneField({
  label,
  hint,
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
}: {
  label: string;
  hint?: string;
  id: string;
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [init] = useState(() => splitPhone(value));
  const [code, setCode] = useState(init[0]);
  const [num, setNum] = useState(init[1]);
  const [touched, setTouched] = useState(false);
  const emit = (c: string, n: string) => onChange(n.trim() ? (c ? `+${c} ${n.trim()}` : n.trim()) : "");
  const joined = num.trim() ? (code ? `+${code} ${num.trim()}` : num.trim()) : "";
  const problem = touched ? phoneProblem(joined, "number") : null;
  const rule = code ? phoneRule(code) : null;
  const limit = rule && rule.name ? `${rule.name}: ${rule.min === rule.max ? rule.min : `${rule.min} to ${rule.max}`} digits after +${code}` : undefined;
  return (
    <Field label={label} hint={problem ? undefined : hint} error={problem} htmlFor={id} className={className}>
      <div className="flex gap-2">
        <div className="relative w-20 shrink-0">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-base text-stone-500 lg:text-[0.95rem]">
            +
          </span>
          <Input
            aria-label={`${label}, country code`}
            inputMode="numeric"
            maxLength={3}
            value={code}
            placeholder={DEFAULT_CODE}
            onChange={(e) => {
              const c = e.target.value.replace(/\D/g, "").slice(0, 3);
              const n = c ? trimNational(c, num) : num;
              setCode(c);
              setNum(n);
              emit(c, n);
            }}
            className="pl-6 tabular-nums"
            autoComplete="off"
          />
        </div>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          value={num}
          placeholder={placeholder}
          onChange={(e) => {
            const n = code ? trimNational(code, e.target.value) : e.target.value;
            setNum(n);
            emit(code, n);
          }}
          onBlur={() => setTouched(true)}
          title={limit}
          aria-invalid={!!problem}
          autoFocus={autoFocus}
          autoComplete="off"
          className="min-w-0 flex-1"
        />
      </div>
    </Field>
  );
}

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
      title={customer ? `Edit customer ${customerNo(customer.number)}` : "Add a customer"}
      description={
        customer
          ? "Only the name is needed. Add a phone number to call them from the list."
          : "Only the name is needed. They get the next customer ID, like CID-1001, when you add them."
      }
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
  // The second number shows as a small link until it is clicked, or the customer already has one.
  const [altOpen, setAltOpen] = useState(() => !!customer?.alt_phone);
  const [altClicked, setAltClicked] = useState(false);
  const [hasAddress] = useState(() => !!customer && [customer.line1, customer.line2, customer.city, customer.county, customer.postcode].some(Boolean));

  const set =
    <K extends keyof Form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (form.full_name.trim().length < 2) return setError("Please enter the customer's name.");
    const bad = phoneProblem(form.phone, "telephone number") ?? phoneProblem(form.alt_phone, "alternative telephone number");
    if (bad) return setError(bad);
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
      className="grid gap-4 sm:grid-cols-6"
    >
      <Field label="Name" htmlFor="c-name" className="sm:col-span-3">
        <Input id="c-name" value={form.full_name} onChange={set("full_name")} autoComplete="off" autoFocus />
      </Field>
      <Field label="Company" htmlFor="c-company" className="sm:col-span-3">
        <Input id="c-company" value={form.company ?? ""} onChange={set("company")} autoComplete="off" />
      </Field>
      <PhoneField label="Telephone" id="c-phone" value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} placeholder="7700 900123" className="sm:col-span-3" />
      {altOpen ? (
        <PhoneField
          label="Alternative telephone"
         
          id="c-alt-phone"
          value={form.alt_phone}
          onChange={(alt_phone) => setForm((f) => ({ ...f, alt_phone }))}
          autoFocus={altClicked}
          className="sm:col-span-3"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setAltClicked(true);
            setAltOpen(true);
          }}
          className="flex min-h-11 items-center gap-1.5 self-end text-sm text-aubergine-700 underline-offset-2 hover:underline sm:col-span-3 sm:min-h-[2.625rem]"
        >
          <IconPlus className="size-4" /> Add an alternative number
        </button>
      )}
      <Field label="Email" htmlFor="c-email" className="sm:col-span-6">
        <Input id="c-email" type="email" inputMode="email" value={form.email ?? ""} onChange={set("email")} autoComplete="off" />
      </Field>
      <Field label="Gender" htmlFor="c-gender" className="sm:col-span-2">
        <Select id="c-gender" size="sm" value={form.gender ?? ""} onChange={(e) => setForm((f) => ({ ...f, gender: (e.target.value || null) as Form["gender"] }))}>
          <option value="">Not set</option>
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date of birth" htmlFor="c-dob" className="sm:col-span-2">
        <DatePicker id="c-dob" value={form.dob} onChange={(dob) => setForm((f) => ({ ...f, dob }))} max={new Date().toISOString().slice(0, 10)} placeholder="Not set" yearNav />
      </Field>

      {/* The address stays folded away until it is wanted, or when the customer already has one. */}
      <Disclosure
        defaultOpen={hasAddress}
        className="border-t border-ink/10 sm:col-span-6"
        buttonClassName="text-sm font-medium text-ink"
        panelClassName="grid gap-4 p-1 pb-2 sm:grid-cols-6"
        summary={
          <span className="flex flex-wrap items-baseline gap-x-3">
            Address
            <span className="text-xs font-normal text-stone-500">{[form.line1, form.city, form.postcode].filter(Boolean).join(", ")}</span>
          </span>
        }
      >
        <Field label="First line" htmlFor="c-line1" className="sm:col-span-3">
          <Input id="c-line1" value={form.line1 ?? ""} onChange={set("line1")} autoComplete="off" />
        </Field>
        <Field label="Second line" htmlFor="c-line2" className="sm:col-span-3">
          <Input id="c-line2" value={form.line2 ?? ""} onChange={set("line2")} autoComplete="off" />
        </Field>
        <Field label="Town or city" htmlFor="c-city" className="sm:col-span-2">
          <Input id="c-city" value={form.city ?? ""} onChange={set("city")} autoComplete="off" />
        </Field>
        <Field label="County" htmlFor="c-county" className="sm:col-span-2">
          <Input id="c-county" value={form.county ?? ""} onChange={set("county")} autoComplete="off" />
        </Field>
        <Field label="Postcode" htmlFor="c-postcode" className="sm:col-span-2">
          <Input id="c-postcode" value={form.postcode ?? ""} onChange={set("postcode")} className="uppercase" autoComplete="off" />
        </Field>
      </Disclosure>
      <Field label="Note" hint="Only staff see this." htmlFor="c-note" className="sm:col-span-6">
        <Textarea id="c-note" value={form.note ?? ""} onChange={set("note")} rows={2} />
      </Field>

      {error && <p className="text-sm text-danger sm:col-span-6">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-6">
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
