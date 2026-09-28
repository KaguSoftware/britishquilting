import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { friendlyAuthError } from "@/lib/auth/helpers";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const sp = await searchParams;
  const code = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  return <ForgotPasswordForm initialError={code ? friendlyAuthError({ code }) : undefined} />;
}
