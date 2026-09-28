import { brand, CtaButton, Divider, EmailLayout, money, OrderLines, OrderTotals, Section, Text, eyebrow, label, h1, h2, text } from "./components";
import type { OrderEmailProps } from "./order-confirmation";

export type InvoiceOrderProps = OrderEmailProps & {
  company: string | null;
  dueDate: string;
  termsDays: number;
  bankDetails: string | null;
};

export default function InvoiceOrderEmail(p: InvoiceOrderProps) {
  return (
    <EmailLayout
      preview={`Order #${p.number} confirmed on account. Payment of ${money(p.totals.total)} due by ${p.dueDate}.`}
      footerNote="Please use your order number as the payment reference so we can match it quickly."
    >
      <Text style={eyebrow}>Trade order #{p.number}</Text>
      <h1 style={h1}>Order confirmed on account</h1>
      <Text style={text}>
        Thank you{p.company ? ` for ordering on behalf of ${p.company}` : ""}. Your order is already being prepared. Payment is due within{" "}
        {p.termsDays} days, by <strong style={{ color: brand.ink }}>{p.dueDate}</strong>.
      </Text>

      <Section style={{ backgroundColor: "#f6eedb", border: `1px solid ${brand.gold}`, padding: "20px 24px", margin: "8px 0 24px" }}>
        <Text style={label}>Pay by bank transfer</Text>
        <Text style={{ ...text, color: brand.ink, whiteSpace: "pre-line", margin: "0 0 12px" }}>
          {p.bankDetails ?? "Our bank details will follow on your formal invoice. If you need them sooner, simply reply to this email."}
        </Text>
        <Text style={{ ...text, margin: 0 }}>
          Amount: <strong style={{ color: brand.ink }}>{money(p.totals.total)}</strong>
          <br />
          Reference: <strong style={{ color: brand.ink }}>BQ-{p.number}</strong>
        </Text>
      </Section>

      <CtaButton href={p.orderUrl}>View your order</CtaButton>
      <Divider />
      <h2 style={h2}>Order summary</h2>
      <OrderLines lines={p.lines} />
      <OrderTotals t={p.totals} />
    </EmailLayout>
  );
}

InvoiceOrderEmail.PreviewProps = {
  number: 10043,
  firstName: "Tom",
  company: "Hart & Sons Interiors",
  dueDate: "28 October 2026",
  termsDays: 30,
  bankDetails: "British Quilting Ltd\nSort code 00-00-00\nAccount 12345678",
  lines: [{ name: "Blackout Lining, White", detail: "20m cut", total: 16800, image: null }],
  totals: { subtotal: 16800, discount: 0, discountCode: null, shipping: 0, shippingName: "DPD Next Day", fulfilment: "delivery", total: 16800, vat: 2800 },
  shippingAddress: null,
  collection: null,
  orderUrl: "http://localhost:3000/account/orders",
} satisfies InvoiceOrderProps;
