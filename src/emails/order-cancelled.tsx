import { brand, CtaButton, Divider, EmailLayout, OrderLines, Section, Text, eyebrow, label, h1, h2, text, type EmailLine } from "./components";

export type OrderCancelledProps = {
  number: number;
  firstName: string | null;
  lines: EmailLine[];
  /** True when money was taken: a refund follows separately. */
  wasPaid: boolean;
  reason: string | null;
  orderUrl: string;
};

export default function OrderCancelledEmail(p: OrderCancelledProps) {
  return (
    <EmailLayout preview={`Order #${p.number} has been cancelled.`}>
      <Text style={eyebrow}>Order #{p.number}</Text>
      <h1 style={h1}>Your order has been cancelled</h1>
      <Text style={text}>
        {p.firstName ? `Hello ${p.firstName}, we` : "We"} have cancelled this order and nothing further will be sent.
        {p.wasPaid
          ? " Any money you paid will be returned to your original payment method, and we will email you as soon as the refund is issued."
          : " No payment was taken."}
      </Text>
      {p.reason && (
        <Section style={{ backgroundColor: brand.cream, padding: "20px 24px", margin: "8px 0 24px" }}>
          <Text style={label}>A note from us</Text>
          <Text style={{ ...text, color: brand.ink, margin: 0 }}>{p.reason}</Text>
        </Section>
      )}
      <Text style={text}>If this is a surprise, simply reply to this email and we will help.</Text>
      <CtaButton href={p.orderUrl}>View your order</CtaButton>
      <Divider />
      <h2 style={h2}>What was on the order</h2>
      <OrderLines lines={p.lines} />
    </EmailLayout>
  );
}

OrderCancelledEmail.PreviewProps = {
  number: 10042,
  firstName: "Eleanor",
  lines: [{ name: "Cotton Sateen Lining, Ivory", detail: "3.5m cut", total: 2275, image: null }],
  wasPaid: true,
  reason: null,
  orderUrl: "http://localhost:3000/account/orders",
} satisfies OrderCancelledProps;
