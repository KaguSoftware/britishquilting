"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { IconArrowLeft } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";
import { requestPasswordReset, updatePassword, type AuthState } from "@/lib/actions/auth";
import { AuthHeading, PasswordField, SentState, SubmitButton } from "./parts";

export function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, null);
  const [dismissed, setDismissed] = useState(false);
  const id = useId();

  if (state?.ok && !dismissed) {
    return (
      <SentState title="Check your inbox" email={state.email} onBack={() => setDismissed(true)}>
        <p>{state.message} The link expires in one hour.</p>
        <p className="mt-6">
          <Link href="/login" className="text-aubergine-700 underline-offset-4 hover:underline">Back to sign in</Link>
        </p>
      </SentState>
    );
  }

  return (
    <div>
      <AuthHeading eyebrow="Account help" title="Reset your password">
        Enter the email you use with us and we&apos;ll send a secure link to choose a new password.
      </AuthHeading>
      <form action={action} className="space-y-5" noValidate>
        {!state && initialError && <FormMessage>{initialError}</FormMessage>}
        {state?.message && !state.ok && <FormMessage>{state.message}</FormMessage>}
        <Field id={id} label="Email address" error={state?.fieldErrors?.email}>
          <Input
            id={id}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            defaultValue={state?.email ?? ""}
            aria-invalid={Boolean(state?.fieldErrors?.email) || undefined}
            aria-describedby={`${id}-msg`}
          />
        </Field>
        <SubmitButton pendingLabel="Sending">Send reset link</SubmitButton>
      </form>
      <p className="mt-10 text-center text-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-aubergine-700 underline-offset-4 hover:underline">
          <IconArrowLeft className="size-4" /> Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ email }: { email: string | null }) {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, null);
  return (
    <div>
      <AuthHeading eyebrow="Almost there" title="Choose a new password">
        {email ? <>For <span className="font-medium text-ink">{email}</span>. </> : null}
        Pick something memorable that you don&apos;t use elsewhere.
      </AuthHeading>
      <form action={action} className="space-y-5" noValidate>
        {/* Helps password managers save the right entry */}
        {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
        {state?.message && <FormMessage>{state.message}</FormMessage>}
        <PasswordField label="New password" autoComplete="new-password" showStrength error={state?.fieldErrors?.password} />
        <PasswordField name="confirm" label="Confirm new password" autoComplete="new-password" error={state?.fieldErrors?.confirm} />
        <SubmitButton pendingLabel="Saving">Save new password</SubmitButton>
      </form>
    </div>
  );
}
