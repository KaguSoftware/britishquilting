import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconLogout } from "@/components/icons";
import { SubmitButton } from "@/components/auth/parts";
import { ButtonLink } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign out", robots: { index: false } };

export default async function LogoutPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  return (
    <div className="text-center">
      <div className="mx-auto flex size-16 items-center justify-center border border-aubergine-300/60 bg-aubergine-100">
        <IconLogout className="size-6 text-aubergine-700" strokeWidth={1.25} />
      </div>
      <h1 className="font-display mt-6 text-4xl text-aubergine-900">Sign out?</h1>
      <p className="mt-3 text-ink-soft">
        You&apos;re signed in as <span className="font-medium text-ink">{data.user.email}</span>.
      </p>
      <form action={signOut} className="mt-8 space-y-3">
        <SubmitButton pendingLabel="Signing out">Sign out</SubmitButton>
        <ButtonLink href="/account" variant="ghost" size="lg" className="w-full">Stay signed in</ButtonLink>
      </form>
    </div>
  );
}
