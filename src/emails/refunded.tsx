import { brand, CtaButton, EmailLayout, money, Section, Text, eyebrow, label, h1, text } from "./components";

export type RefundedProps = {
  number: number;
  firstName: string | null;
  amount: number;
  method: string;
  orderUrl: string;
};

export default function RefundedEmail(p: RefundedProps) {
  return (
    <EmailLayout preview={`We've refunded ${money(p.amount)} for order #${p.number}.`}>
      <Text style={eyebrow}>Order #{p.number}</Text>
      <h1 style={h1}>Your refund is on its way</h1>
      <Text style={text}>
        {p.firstName ? `Hello ${p.firstName}, we` : "We"} have issued a refund for your order. Depending on your bank, it can take 5 to 10 working days to
        appear on your statement.
      </Text>
      <Section style={{ backgroundColor: brand.cream, padding: "20px 24px", margin: "8px 0 24px" }}>
        <Text style={label}>Refunded</Text>
        <Text style={{ fontFamily: brand.serif, fontSize: 32, color: brand.ink, margin: "0 0 4px" }}>{money(p.amount)}</Text>
        <Text style={{ ...text, margin: 0 }}>To your original payment method ({p.method}).</Text>
      </Section>
      <CtaButton href={p.orderUrl}>View your order</CtaButton>
    </EmailLayout>
  );
}

RefundedEmail.PreviewProps = { number: 10042, firstName: "Eleanor", amount: 5045, method: "card", orderUrl: "http://localhost:3000/account/orders" } satisfies RefundedProps;
