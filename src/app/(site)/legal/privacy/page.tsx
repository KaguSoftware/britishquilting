import type { Metadata } from "next";
import { ContentLayout, HelpAside, PageHeader, Prose } from "@/components/shop/bits";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How British Quilting collects, uses and protects your personal data.",
  alternates: { canonical: "/legal/privacy" },
};

/*
 * PLACEHOLDER POLICY. Edit the bracketed details and confirm the list of
 * processors (hosting, payments, email) before launch.
 */
export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Privacy policy"
        lede="Last updated 28 September 2026. We collect only what we need to cut, send and support your order."
        crumbs={[{ href: "/", label: "Home" }, { label: "Privacy" }]}
      />
      <ContentLayout aside={<HelpAside />}>
        <Prose>
          <h2>Who we are</h2>
          <p>
            British Quilting [Ltd], [registered address, London], is the controller of your personal data. Questions about this policy can be sent to
            <a href="mailto:mustafa@britishquilting.com"> mustafa@britishquilting.com</a>.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>Your name, email, phone number and delivery address when you order or create an account.</li>
            <li>Order history, reviews you submit, and messages you send us.</li>
            <li>Basic technical data such as your browser type, used to keep the site secure and working.</li>
          </ul>
          <p>We never see or store your full card details. Payments are handled by our payment providers.</p>
          <h2>Why we use it</h2>
          <ul>
            <li>To process, deliver and support your orders (contract).</li>
            <li>To send our newsletter, only if you&apos;ve opted in (consent). You can unsubscribe at any time.</li>
            <li>To keep accounting records as required by law (legal obligation).</li>
          </ul>
          <h2>Who we share it with</h2>
          <p>
            Only the services we need to run the shop: our hosting and database providers, payment processors (Stripe, PayPal), our email provider, and the
            carrier delivering your parcel. [Confirm this list before launch.] We never sell your data.
          </p>
          <h2>How long we keep it</h2>
          <p>Order and invoice records are kept for six years for tax purposes. Account data is kept until you ask us to delete it.</p>
          <h2>Cookies</h2>
          <p>We use essential cookies to keep you signed in and remember your basket. We don&apos;t use advertising cookies.</p>
          <h2>Your rights</h2>
          <p>
            You can ask to see, correct, export or delete your data, or object to how we use it. Email us and we&apos;ll respond within one month. You also have the
            right to complain to the Information Commissioner&apos;s Office (ico.org.uk).
          </p>
        </Prose>
      </ContentLayout>
    </>
  );
}
