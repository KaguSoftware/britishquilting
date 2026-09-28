"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { IconApple, IconEye, IconEyeOff, IconGoogle, IconMail } from "@/components/icons";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { signInWithProvider } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} {...props}>
      {pending ? pendingLabel ?? children : children}
    </Button>
  );
}

export function scorePassword(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  if (p.length < 8) return Math.min(s, 1);
  return Math.min(4, Math.max(1, s - 1));
}

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColour = ["bg-stone-300", "bg-danger", "bg-gold-500", "bg-aubergine-500", "bg-success"];

export function PasswordField({
  name = "password",
  label = "Password",
  autoComplete = "current-password",
  error,
  showStrength,
  labelAside,
}: {
  name?: string;
  label?: string;
  autoComplete?: string;
  error?: string[] | string;
  showStrength?: boolean;
  labelAside?: React.ReactNode;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const [value, setValue] = useState("");
  const score = scorePassword(value);
  const hasError = Boolean(error && (Array.isArray(error) ? error.length : error));

  return (
    <Field
      id={id}
      label={label}
      error={error}
      labelAside={labelAside}
      hint={showStrength ? "At least 8 characters, with letters and a number." : undefined}
    >
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={hasError || undefined}
          aria-describedby={`${id}-msg${showStrength ? ` ${id}-strength` : ""}`}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-500 transition-colors hover:text-aubergine-700"
        >
          {shown ? <IconEyeOff className="size-4.5" /> : <IconEye className="size-4.5" />}
        </button>
      </div>
      {showStrength && (
        <div id={`${id}-strength`} className="mt-2 flex items-center gap-3" aria-live="polite">
          <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-colors duration-300",
                  value && score >= i ? strengthColour[score] : "bg-stone-300/70",
                )}
              />
            ))}
          </div>
          <span className="w-14 text-right text-xs text-ink-soft">{value ? strengthLabel[score] : ""}</span>
        </div>
      )}
    </Field>
  );
}

function ProviderButton({ provider, children }: { provider: "google" | "apple"; children: React.ReactNode }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("provider") === provider;
  return (
    <Button type="submit" name="provider" value={provider} variant="secondary" size="lg" className="w-full" loading={mine} disabled={pending}>
      {!mine && children}
      {mine && "Connecting"}
    </Button>
  );
}

export function OAuthButtons({ next }: { next: string }) {
  return (
    <form action={signInWithProvider} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="next" value={next} />
      <ProviderButton provider="google">
        <IconGoogle className="size-4.5" /> Google
      </ProviderButton>
      <ProviderButton provider="apple">
        <IconApple className="size-4.5" /> Apple
      </ProviderButton>
    </form>
  );
}

export function OrDivider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div className="my-7 flex items-center gap-4" role="separator">
      <span className="stitch flex-1 opacity-60" />
      <span className="font-display text-sm italic text-stone-500">{children}</span>
      <span className="stitch flex-1 opacity-60" />
    </div>
  );
}

export function AuthHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="font-display text-lg italic text-gold-600">{eyebrow}</p>
      <h1 className="font-display mt-1 text-[2.6rem] leading-[1.05] text-aubergine-900 sm:text-5xl">{title}</h1>
      {children && <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{children}</p>}
    </div>
  );
}

export function SentState({ title, email, children, onBack }: { title: string; email?: string; children?: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="text-center" role="status" aria-live="polite">
      <div className="mx-auto flex size-16 items-center justify-center border border-gold-300 bg-cream-50">
        <IconMail className="size-7 text-gold-600" strokeWidth={1.25} />
      </div>
      <h1 className="font-display mt-6 text-4xl text-aubergine-900">{title}</h1>
      {email && (
        <p className="mt-3 text-ink-soft">
          We&apos;ve sent it to <span className="font-medium text-ink">{email}</span>.
        </p>
      )}
      <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>
      {onBack && (
        <button type="button" onClick={onBack} className="mt-8 text-sm text-aubergine-700 underline-offset-4 hover:underline">
          Use a different email
        </button>
      )}
    </div>
  );
}

