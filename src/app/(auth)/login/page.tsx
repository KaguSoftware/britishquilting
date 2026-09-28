import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
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
  if (data.user) redirect(next);

  return <LoginForm next={next} initialError={errorFor(one(sp.error))} />;
}
