"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/choice";
import { DatePicker } from "@/components/ui/date-picker";
import { FormMessage } from "@/components/ui/field";
import { completeOnboarding, type FormState } from "@/lib/actions/account";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

export function WelcomeForm({ next, initial }: { next: string; initial: { is_student: boolean | null; dob: string | null } }) {
  const router = useRouter();
  const uid = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(completeOnboarding, null);
  const fe = state?.fieldErrors;

  useEffect(() => {
    if (state?.ok) router.replace(next);
  }, [state, next, router]);

  return (
    <form action={action} noValidate className="mt-10 space-y-12">
      {state?.message && !state.ok && <FormMessage>{state.message}</FormMessage>}

      <fieldset>
        <legend className="flex items-baseline gap-4">
          <span className="font-display text-lg tabular-nums text-gold-600">i.</span>
          <span className="font-display text-2xl text-aubergine-900 md:text-3xl">Are you a student?</span>
        </legend>
        <p className="mt-2 pl-9 text-sm text-ink-soft">Textiles, fashion, interiors or anything else: we&apos;d love to know.</p>
        <div className="mt-5 grid gap-3 pl-9 sm:grid-cols-2">
          <RadioCard name="is_student" value="yes" defaultChecked={initial.is_student === true} title="Yes, I'm a student" />
          <RadioCard name="is_student" value="no" defaultChecked={initial.is_student === false} title="No, I'm not" />
        </div>
        {fe?.is_student && <p className="mt-2 pl-9 text-sm text-danger">{fe.is_student[0]}</p>}
      </fieldset>

      <fieldset>
        <legend className="flex items-baseline gap-4">
          <span className="font-display text-lg tabular-nums text-gold-600">ii.</span>
          <span className="font-display text-2xl text-aubergine-900 md:text-3xl">When is your birthday?</span>
        </legend>
        <p className="mt-2 pl-9 text-sm text-ink-soft">Optional. On the day we&apos;ll send you a note, and a birthday discount is taken off at checkout automatically.</p>
        <div className="mt-5 max-w-xs pl-9">
          <DatePicker id={`${uid}-dob`} name="dob" defaultValue={initial.dob} max={today()} placeholder="Choose your birthday" yearNav aria-label="Your birthday" />
          {fe?.dob && <p className="mt-2 text-sm text-danger">{fe.dob[0]}</p>}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-stone-300 pt-8">
        <Button type="submit" loading={pending}>
          {pending ? "Saving" : "Save and continue"}
        </Button>
        <button type="submit" name="skip" value="1" formNoValidate disabled={pending} className="text-sm text-ink-soft underline underline-offset-4 hover:text-aubergine-700">
          Skip for now
        </button>
      </div>
    </form>
  );
}
