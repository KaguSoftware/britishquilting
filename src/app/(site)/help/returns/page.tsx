import type { Metadata } from "next";
import Link from "next/link";
import { ContentLayout, HelpAside, PageHeader, Prose } from "@/components/shop/bits";

export const metadata: Metadata = {
  title: "Returns",
  description: "Our returns policy. Cut-to-order fabric is non-returnable unless faulty; uncut items can be returned within 14 days.",
  alternates: { canonical: "/help/returns" },
};

export default function ReturnsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Returns"
        lede="Clear and fair. Because most of what we sell is cut to your length, please read this before you order."
        crumbs={[{ href: "/", label: "Home" }, { label: "Returns" }]}
      />
      <ContentLayout aside={<HelpAside />}>
        <div className="mb-14 grid gap-px border border-stone-300 bg-stone-300 sm:grid-cols-2">
          <div className="bg-cream-50 p-7">
            <p className="font-display text-2xl">Cut fabric</p>
            <p className="mt-2 text-ink-soft">Made to order for you, so it can&apos;t be returned unless it&apos;s faulty or we cut it incorrectly.</p>
          </div>
          <div className="bg-cream-50 p-7">
            <p className="font-display text-2xl">Uncut items</p>
            <p className="mt-2 text-ink-soft">Full rolls, paper and other uncut goods can be returned unused within 14 days of delivery.</p>
          </div>
        </div>
        <Prose>
          <h2>Cut-to-order fabric</h2>
          <p>
            Fabric sold by the metre is cut from the bolt specifically for your order. Under the Consumer Contracts Regulations, goods made to the customer&apos;s
            specification are exempt from the usual 14-day cancellation right, so cut lengths are <strong>non-returnable unless faulty</strong>.
          </p>
          <p>
            Not sure about a colour or weight? <Link href="/samples">Order free swatches</Link> first. It&apos;s the best way to be certain.
          </p>
          <h2>Faulty or incorrectly cut</h2>
          <p>
            We check every length before it leaves us, but if something isn&apos;t right, please tell us within 14 days of delivery and before cutting or sewing.
            Send your order number and a photo to <a href="mailto:mustafa@britishquilting.com">mustafa@britishquilting.com</a>. We&apos;ll replace the fabric or refund
            you in full, including delivery.
          </p>
          <h2>Uncut items</h2>
          <ul>
            <li>Tell us within 14 days of delivery that you&apos;d like to return an item.</li>
            <li>Send it back unused and in its original condition within a further 14 days.</li>
            <li>Return postage is at your cost unless the item is faulty.</li>
            <li>We refund to your original payment method within 14 days of receiving the return.</li>
          </ul>
          <h2>Your statutory rights</h2>
          <p>None of this affects your statutory rights under the Consumer Rights Act 2015.</p>
        </Prose>
      </ContentLayout>
    </>
  );
}
