import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeForm } from "@/components/account/welcome-form";
import { getViewer } from "@/lib/data/catalog";
import { safeNext } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

/** Asked once, straight after an account is made: student or not, and a birthday for a birthday treat. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/welcome")}`);
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("onboarded_at, is_student, dob").eq("id", viewer.id).maybeSingle();
  if (profile?.onboarded_at) redirect(next);

  const first = viewer.fullName?.split(" ")[0];
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-28 md:px-8 md:pb-32 md:pt-40">
      <p className="font-display text-lg italic text-gold-600">{first ? `Welcome, ${first}` : "Welcome"}</p>
      <h1 className="font-display mt-1 text-4xl text-aubergine-900 md:text-5xl">Two quick questions</h1>
      <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
        They help us look after you. You can change either answer at any time in your account settings.
      </p>
      <div aria-hidden className="stitch mt-8" />
      <WelcomeForm next={next} initial={{ is_student: profile?.is_student ?? null, dob: profile?.dob ?? null }} />
    </div>
  );
}
