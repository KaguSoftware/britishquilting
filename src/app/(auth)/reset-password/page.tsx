import type { Metadata } from "next";
import Link from "next/link";
import { IconClock } from "@/components/icons";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center border border-stone-300 bg-cream-50">
          <IconClock className="size-7 text-stone-500" strokeWidth={1.25} />
        </div>
        <h1 className="font-display mt-6 text-4xl text-aubergine-900">This link has expired</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          For your security, reset links work once and only for an hour. Request a fresh one and we&apos;ll send it straight over.
        </p>
        <ButtonLink href="/forgot-password" size="lg" className="mt-8 w-full">Send a new link</ButtonLink>
        <p className="mt-6 text-sm">
          <Link href="/login" className="text-aubergine-700 underline-offset-4 hover:underline">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return <ResetPasswordForm email={data.user.email ?? null} />;
}
