import { brand, CtaButton, Divider, EmailLayout, OrderLines, Section, Text, eyebrow, label, h1, h2, text, type EmailLine } from "./components";

export type DeliveredProps = {
  number: number;
  firstName: string | null;
  /** "delivered" for courier orders, "collected" for workroom pick-ups. */
  kind: "delivered" | "collected";
  lines: EmailLine[];
  reviewUrl: string | null;
  orderUrl: string;
};

export default function DeliveredEmail(p: DeliveredProps) {
  const collected = p.kind === "collected";
  return (
    <EmailLayout preview={collected ? `Thank you for collecting order #${p.number}.` : `Order #${p.number} has been delivered.`}>
      <Text style={eyebrow}>Order #{p.number}</Text>
      <h1 style={h1}>{collected ? "Thank you for coming in" : "Your order has arrived"}</h1>
      <Text style={text}>
        {p.firstName ? `${p.firstName}, we` : "We"} hope everything is just as you pictured it. If anything is not right with your
        {collected ? " order" : " delivery"}, reply to this email and we will put it right.
      </Text>
      {p.reviewUrl && (
        <Section style={{ backgroundColor: brand.cream, padding: "20px 24px", margin: "8px 0 24px" }}>
          <Text style={label}>A small favour</Text>
          <Text style={{ ...text, color: brand.ink }}>
            Once you have worked with the fabric, a few words about it helps other makers choose with confidence.
          </Text>
          <CtaButton href={p.reviewUrl}>Write a review</CtaButton>
        </Section>
      )}
      {!p.reviewUrl && <CtaButton href={p.orderUrl}>View your order</CtaButton>}
      <Divider />
      <h2 style={h2}>Your order</h2>
      <OrderLines lines={p.lines} />
    </EmailLayout>
  );
}

DeliveredEmail.PreviewProps = {
  number: 10042,
  firstName: "Eleanor",
  kind: "delivered",
  lines: [{ name: "Cotton Sateen Lining, Ivory", detail: "3.5m cut", total: 2275, image: null }],
  reviewUrl: "http://localhost:3000/product/cotton-sateen-lining#reviews",
  orderUrl: "http://localhost:3000/account/orders",
} satisfies DeliveredProps;
