import type { Metadata } from "next";
import Link from "next/link";
import { ContentLayout, HelpAside, PageHeader, Prose } from "@/components/shop/bits";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: "The terms that apply when you buy from British Quilting.",
  alternates: { canonical: "/legal/terms" },
};

/*
 * PLACEHOLDER TERMS. Edit the bracketed details below (company number,
 * registered address, VAT number) and have them reviewed before launch.
 */
export default function TermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Terms & conditions"
        lede="Last updated 28 September 2026. Plain English wherever we can manage it."
        crumbs={[{ href: "/", label: "Home" }, { label: "Terms" }]}
      />
      <ContentLayout aside={<HelpAside />}>
        <Prose>
          <h2>1. About us</h2>
          <p>
            This website is operated by British Quilting [Ltd], a company registered in England and Wales under company number [00000000], with its registered
            office at [registered address, London]. VAT number [GB 000 0000 00]. You can contact us on 07710 131416 or at
            <a href="mailto:mustafa@britishquilting.com"> mustafa@britishquilting.com</a>.
          </p>
          <h2>2. Your order</h2>
          <p>
            When you place an order you&apos;ll receive an email acknowledging it. A contract is formed when we confirm payment and accept your order. We may
            decline an order, for example if an item is out of stock or has been mispriced, and will refund you in full if so.
          </p>
          <h2>3. Prices and payment</h2>
          <p>
            Prices are shown in pounds sterling and include VAT at the current rate. Delivery is charged separately and shown before you pay. Payment is taken
            by card or PayPal when you order.
          </p>
          <h2>4. Cut-to-order goods</h2>
          <p>
            Fabric sold by length is cut to your specification. It is exempt from the 14-day cancellation right under the Consumer Contracts Regulations 2013 and
            cannot be returned unless faulty. Please check lengths carefully before ordering. See our <Link href="/help/returns">returns policy</Link>.
          </p>
          <h2>5. Colour and description</h2>
          <p>
            We describe and photograph our fabrics as accurately as we can, but screens vary and natural fibres differ slightly between batches. We recommend
            ordering a <Link href="/samples">swatch</Link> before buying larger quantities.
          </p>
          <h2>6. Delivery</h2>
          <p>
            Delivery times are estimates. Risk passes to you on delivery or collection. See <Link href="/help/delivery">delivery &amp; collection</Link> for details.
          </p>
          <h2>7. Liability</h2>
          <p>
            Nothing in these terms limits our liability for death or personal injury caused by negligence, fraud, or anything else that can&apos;t legally be
            limited. Otherwise our liability is limited to the price of the goods concerned. We are not liable for losses that were not foreseeable.
          </p>
          <h2>9. Law</h2>
          <p>These terms are governed by the law of England and Wales. Your statutory rights as a consumer are not affected.</p>
        </Prose>
      </ContentLayout>
    </>
  );
}
