"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Checkbox, Field, FormMessage } from "@/components/ui/field";
import { signUp, type AuthState } from "@/lib/actions/auth";
import { AuthHeading, OAuthButtons, OrDivider, PasswordField, SentState, SubmitButton } from "./parts";

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signUp, null);
  const nameId = useId();
  const emailId = useId();
  const fe = state?.fieldErrors;

  if (state?.ok) {
    return (
      <SentState title="Confirm your email" email={state.email}>
        <p>Tap the link in the email to finish creating your account. Any past orders placed with this address will appear in your account once confirmed.</p>
        <p className="mt-6">
          <Link href="/login" className="text-aubergine-700 underline-offset-4 hover:underline">Back to sign in</Link>
        </p>
      </SentState>
    );
  }

  const loginHref = next !== "/account" ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div>
      <AuthHeading eyebrow="Join the workroom" title="Create an account">
        Faster checkout, order history and tracking, and a saved wishlist of cloths.
      </AuthHeading>

      <OAuthButtons next={next} />
      <OrDivider>or with email</OrDivider>

      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="next" value={next} />
        {state?.message && <FormMessage>{state.message}</FormMessage>}

        <Field id={nameId} label="Full name" error={fe?.fullName}>
          <Input id={nameId} name="fullName" autoComplete="name" required aria-invalid={Boolean(fe?.fullName) || undefined} aria-describedby={`${nameId}-msg`} />
        </Field>
        <Field id={emailId} label="Email address" error={fe?.email}>
          <Input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            defaultValue={state?.email ?? ""}
            key={state?.email ?? "e"}
            aria-invalid={Boolean(fe?.email) || undefined}
            aria-describedby={`${emailId}-msg`}
          />
        </Field>
        <PasswordField autoComplete="new-password" showStrength error={fe?.password} />

        <Checkbox name="marketing" label="Send me new cloths and workroom tips" description="Occasional emails. Unsubscribe any time." />

        <SubmitButton pendingLabel="Creating your account">Create account</SubmitButton>
        <p className="text-center text-xs leading-relaxed text-stone-500">
          By creating an account you agree to our <Link href="/legal/terms" className="underline underline-offset-2">terms</Link> and{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">privacy policy</Link>.
        </p>
      </form>

      <p className="mt-10 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href={loginHref} className="font-medium text-aubergine-700 underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
