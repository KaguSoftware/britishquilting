import { SectionHead } from "@/components/account/section";
import { PasswordForm, ProfileForm } from "@/components/account/settings-forms";
import { requireViewer } from "@/lib/data/account";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer("/account/settings");
  const supabase = await createClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, marketing_opt_in").eq("id", viewer.id).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const providers = (auth.user?.identities ?? []).map((i) => i.provider);
  const hasPassword = providers.includes("email");
  const social = providers.filter((p) => p !== "email");

  const deleteHref = `mailto:mustafa@britishquilting.com?subject=${encodeURIComponent("Please delete my account")}&body=${encodeURIComponent(
    `Please delete the British Quilting account for ${viewer.email ?? ""}.`,
  )}`;

  return (
    <div className="space-y-16">
      <section>
        <SectionHead n="i." title="Your details" />
        <ProfileForm profile={{ full_name: profile?.full_name ?? viewer.fullName, phone: profile?.phone ?? null, marketing_opt_in: profile?.marketing_opt_in ?? false }} email={viewer.email} />
      </section>

      <section className="border-t border-stone-300 pt-12">
        <SectionHead n="ii." title="Password">
          {hasPassword
            ? "Choose a new password of at least 8 characters, with letters and a number."
            : `You sign in with ${social.length ? social.map((s) => s[0].toUpperCase() + s.slice(1)).join(" or ") : "a secure email link"}. Set a password here if you'd also like to sign in with one.`}
        </SectionHead>
        <PasswordForm />
      </section>

      <section className="border-t border-stone-300 pt-12">
        <SectionHead n="iii." title="Close your account" />
        <p className="max-w-xl text-sm leading-relaxed text-ink-soft">
          We&apos;ll delete your account and personal details, keeping only the order records we&apos;re legally required to hold for six years.{" "}
          <a href={deleteHref} className="text-danger underline underline-offset-4">Email us to request deletion</a>, and we&apos;ll confirm within two working days.
        </p>
      </section>
    </div>
  );
}
