"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { PasswordField } from "@/components/auth/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox, Field, FormMessage } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { changePassword, updateProfile, type FormState } from "@/lib/actions/account";

function useToastOnSuccess(state: FormState) {
  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
  }, [state]);
}

type Profile = { full_name: string | null; phone: string | null; marketing_opt_in: boolean; is_student: boolean; dob: string | null };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

export function ProfileForm({ profile, email }: { profile: Profile; email: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, null);
  const uid = useId();
  const fe = state?.fieldErrors;
  useToastOnSuccess(state);

  return (
    <form action={action} noValidate className="space-y-5">
      {state?.message && !state.ok && <FormMessage>{state.message}</FormMessage>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${uid}-name`} label="Full name" error={fe?.full_name}>
          <Input id={`${uid}-name`} name="full_name" autoComplete="name" defaultValue={profile.full_name ?? ""} aria-invalid={Boolean(fe?.full_name) || undefined} aria-describedby={`${uid}-name-msg`} />
        </Field>
        <Field id={`${uid}-phone`} label="Phone" optional error={fe?.phone}>
          <Input id={`${uid}-phone`} name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} aria-invalid={Boolean(fe?.phone) || undefined} aria-describedby={`${uid}-phone-msg`} />
        </Field>
        <Field id={`${uid}-email`} label="Email" hint="To change your sign-in email, please contact us." className="sm:col-span-2">
          <Input id={`${uid}-email`} value={email ?? ""} readOnly disabled aria-describedby={`${uid}-email-msg`} />
        </Field>
        <Field id={`${uid}-dob`} label="Birthday" optional hint="We'll send you a birthday treat." error={fe?.dob}>
          <DatePicker id={`${uid}-dob`} name="dob" defaultValue={profile.dob} max={today()} placeholder="Add your birthday" yearNav />
        </Field>
      </div>
      <Checkbox name="is_student" defaultChecked={profile.is_student} label="I'm a student" description="Studying textiles, fashion or interiors? Let us know." />
      <Checkbox
        name="marketing_opt_in"
        defaultChecked={profile.marketing_opt_in}
        label="Email me about new cloths and workroom tips"
        description="A few times a season, never more. Order emails are always sent."
      />
      <Button type="submit" loading={pending}>{pending ? "Saving" : "Save details"}</Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, null);
  const ref = useRef<HTMLFormElement>(null);
  useToastOnSuccess(state);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} noValidate className="space-y-5">
      {state?.message && !state.ok && <FormMessage>{state.message}</FormMessage>}
      <div className="grid gap-5 sm:grid-cols-2">
        <PasswordField key={state?.ok ? "a" : "b"} label="New password" autoComplete="new-password" showStrength error={state?.fieldErrors?.password} />
        <PasswordField key={state?.ok ? "c" : "d"} name="confirm" label="Confirm new password" autoComplete="new-password" error={state?.fieldErrors?.confirm} />
      </div>
      <Button type="submit" variant="outline" loading={pending}>{pending ? "Updating" : "Update password"}</Button>
    </form>
  );
}
