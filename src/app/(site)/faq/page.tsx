import type { Metadata } from "next";
import { Accordion, ContentLayout, HelpAside, PageHeader } from "@/components/shop/bits";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers on cutting, lengths, swatches, delivery, returns and trade accounts at British Quilting.",
  alternates: { canonical: "/faq" },
};

const FAQ: { section: string; items: [string, string][] }[] = [
  {
    section: "Ordering & cutting",
    items: [
      ["What's the minimum length I can order?", "Most fabrics start at 50cm and go up in 50cm steps. The exact minimum and step are shown on each product page, and the price updates as you change the length."],
      ["What does 'pieces' mean?", "If you need several drops of the same length, set the length once and increase the pieces. We cut each piece separately, which saves you cutting them at home."],
      ["How much lining do I need?", "As a rule, lining matches your curtain fabric length less the hems, and interlining is similar. If you send us your window sizes we're happy to help you work it out."],
      ["Can I order a full roll?", "Yes. Several fabrics are sold by the full roll at a lower price per metre. Trade customers can order any fabric by the roll."],
    ],
  },
  {
    section: "Swatches",
    items: [
      ["Are swatches free?", "Yes, up to six per order, posted first class. You can order them on their own or alongside fabric."],
      ["How big are they?", "Roughly 15 by 15cm, cut from the same bolts we cut orders from."],
    ],
  },
  {
    section: "Delivery & returns",
    items: [
      ["How quickly will my order arrive?", "Orders are usually cut and dispatched within one to two working days, tracked. Delivery time depends on the service chosen at checkout."],
      ["Can I collect?", "Yes. Choose collection at checkout and we'll email you when it's ready at our London premises."],
      ["Can I return cut fabric?", "Cut-to-order fabric can't be returned unless it's faulty or cut incorrectly. Uncut items can be returned within 14 days."],
    ],
  },
  {
    section: "Trade",
    items: [
      ["Who can open a trade account?", "Curtain makers, upholsterers, interior designers, theatre and film workrooms, and other soft furnishing businesses."],
      ["Do trade accounts get invoice terms?", "Approved accounts can pay by invoice on 30-day terms. We'll confirm this when we approve your account."],
    ],
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.flatMap((s) => s.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader
        eyebrow="Help"
        title="Questions, answered"
        lede="The things our customers ask most often. Can't see yours? Call the workroom on 07710 131416."
        crumbs={[{ href: "/", label: "Home" }, { label: "FAQ" }]}
      />
      <ContentLayout aside={<HelpAside />}>
        <div className="space-y-16">
          {FAQ.map((s, i) => (
            <section key={s.section} aria-labelledby={`faq-${i}`}>
              <h2 id={`faq-${i}`} className="font-display flex items-baseline gap-4 border-b border-ink/80 pb-4 text-3xl md:text-4xl">
                <span className="text-xl italic text-gold-600 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {s.section}
              </h2>
              {s.items.map(([q, a]) => (
                <Accordion key={q} title={q}>
                  <p className="max-w-2xl">{a}</p>
                </Accordion>
              ))}
            </section>
          ))}
        </div>
      </ContentLayout>
    </>
  );
}
