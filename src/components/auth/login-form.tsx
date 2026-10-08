"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { IconLock, IconMail } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/field";
import { sendMagicLink, signInWithPassword, type AuthState } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { AuthHeading, OAuthButtons, OrDivider, PasswordField, SentState, SubmitButton } from "./parts";

type Mode = "password" | "link";

export function LoginForm({ next, initialError, notice }: { next: string; initialError?: string; notice?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [pwState, pwAction] = useActionState<AuthState, FormData>(signInWithPassword, null);
  const [linkState, linkAction, linkPending] = useActionState<AuthState, FormData>(sendMagicLink, null);
  const [dismissed, setDismissed] = useState(false);
  const emailId = useId();

  if (linkState?.ok && !dismissed) {
    return (
      <SentState title="Check your inbox" email={linkState.email} onBack={() => setDismissed(true)}>
        <p>Click the link in the email to sign in. It expires in one hour, and works once.</p>
        <p className="mt-4">Nothing there? Look in spam or promotions, or wait a minute and try again.</p>
      </SentState>
    );
  }

  const state = mode === "password" ? pwState : linkState;
  const fe = state?.fieldErrors;
  const signupHref = next !== "/account" ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <div>
      <AuthHeading eyebrow="Welcome back" title="Sign in">
        Track orders, reorder your usual linings and manage your account.
      </AuthHeading>

      {notice && <FormMessage tone="success" className="mb-6">{notice}</FormMessage>}
      {!state && initialError && <FormMessage className="mb-6">{initialError}</FormMessage>}

      <OAuthButtons next={next} />
      <OrDivider>or with email</OrDivider>

      <div role="tablist" aria-label="Sign-in method" className="mb-6 grid grid-cols-2 rounded-sm border border-stone-300 bg-cream-50 p-1">
        {([
          ["password", "Password", IconLock],
          ["link", "Email me a link", IconMail],
        ] as const).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "flex h-11 items-center md:h-9 justify-center gap-2 rounded-xs text-sm transition-[background-color,color,box-shadow] duration-300 ease-(--ease-silk)",
              mode === m ? "bg-aubergine-800 text-cream-50 shadow-soft" : "text-ink-soft hover:text-aubergine-800",
            )}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      <form action={mode === "password" ? pwAction : linkAction} className="space-y-5" noValidate>
        <input type="hidden" name="next" value={next} />
        {state?.message && !state.ok && <FormMessage>{state.message}</FormMessage>}

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

        {mode === "password" ? (
          <>
            <PasswordField
              error={fe?.password}
              labelAside={
                <Link href="/forgot-password" className="text-xs text-aubergine-700 underline-offset-4 hover:underline">
                  Forgotten it?
                </Link>
              }
            />
            <SubmitButton pendingLabel="Signing in">Sign in</SubmitButton>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-ink-soft">
              We&apos;ll email you a one-time link. No password needed, and new customers get an account automatically.
            </p>
            <SubmitButton pendingLabel="Sending link" disabled={linkPending}>Email me a sign-in link</SubmitButton>
          </>
        )}
      </form>

      <p className="mt-10 text-center text-sm text-ink-soft">
        New to British Quilting?{" "}
        <Link href={signupHref} className="font-medium text-aubergine-700 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
