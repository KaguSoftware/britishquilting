import type { Metadata } from "next";
import Link from "next/link";
import { IconClock, IconMail, IconPhone, IconPin } from "@/components/icons";
import { PageHeader } from "@/components/shop/bits";
import { ContactForm } from "@/components/shop/contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Call, email or message the British Quilting workroom in London. We usually reply the same working day.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title={<>A real person, <em>at the cutting table.</em></>}
        lede="Questions about weights, widths or how much you'll need? We've been answering them since 1990. Call during workroom hours or leave a message and we'll reply the same day where we can."
        crumbs={[{ href: "/", label: "Home" }, { label: "Contact" }]}
      />
      <div className="mx-auto grid max-w-7xl gap-16 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
        <div>
          <dl className="divide-y divide-stone-300 border-y border-stone-300">
            {[
              [IconPhone, "Telephone", <a key="p" href="tel:+447710131416" className="font-display text-3xl hover:text-aubergine-700">07710 131416</a>],
              [IconMail, "Email", <a key="e" href="mailto:mustafa@britishquilting.com" className="break-all text-lg text-aubergine-700 hover:underline">mustafa@britishquilting.com</a>],
              [IconClock, "Workroom hours", <span key="h">Monday to Friday, 9am to 5pm<br /><span className="text-ink-soft">Closed weekends and bank holidays</span></span>],
              [IconPin, "Collection", <span key="c">London. Choose collection at checkout and we&apos;ll email the address and a time when it&apos;s cut.</span>],
            ].map(([Icon, k, v]) => {
              const I = Icon as typeof IconPhone;
              return (
                <div key={k as string} className="grid grid-cols-[28px_1fr] gap-4 py-6">
                  <I className="mt-1 size-5 text-gold-600" strokeWidth={1.5} />
                  <div>
                    <dt className="text-sm text-stone-500">{k as string}</dt>
                    <dd className="mt-1">{v as React.ReactNode}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
          <p className="mt-8 text-sm text-ink-soft">
            For order updates, the quickest route is <Link href="/track" className="text-aubergine-700 underline underline-offset-4">tracking your order</Link>.
          </p>
        </div>
        <div className="border border-stone-300 bg-cream-50 p-6 md:p-10">
          <h2 className="font-display text-3xl">Send a message</h2>
          <p className="mt-2 mb-8 text-sm text-ink-soft">We only use your details to reply to you.</p>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
