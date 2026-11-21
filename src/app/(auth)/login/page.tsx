import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconLock } from "@/components/icons";
import { LoginForm } from "@/components/auth/login-form";
import { SubmitButton } from "@/components/auth/parts";
import { ButtonLink } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { friendlyAuthError, safeNext } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

function errorFor(code: string | undefined) {
  if (!code) return undefined;
  if (code === "access_denied") return "Sign-in was cancelled. You can try again, or use your email instead.";
  if (code === "missing_code") return "That sign-in link wasn't complete. Please request a new one.";
  return friendlyAuthError({ code });
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(one(sp.next));

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // Bounced here by the back office: sending them back to `next` would loop forever. Say why instead.
  if (data.user && one(sp.denied)) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center border border-aubergine-300/60 bg-aubergine-100">
          <IconLock className="size-6 text-aubergine-700" strokeWidth={1.25} />
        </div>
        <h1 className="font-display mt-6 text-4xl text-aubergine-900">No back office access</h1>
        <p className="mt-3 text-ink-soft">
          <span className="font-medium text-ink">{data.user.email}</span> isn&apos;t a staff account. Ask the owner to
          grant access, or sign in with a different account.
        </p>
        <form action={signOut} className="mt-8 space-y-3">
          <SubmitButton pendingLabel="Signing out">Sign out</SubmitButton>
          <ButtonLink href="/account" variant="ghost" size="lg" className="w-full">Go to my account</ButtonLink>
        </form>
      </div>
    );
  }
  if (data.user) redirect(next);

  return <LoginForm next={next} initialError={errorFor(one(sp.error))} />;
}
