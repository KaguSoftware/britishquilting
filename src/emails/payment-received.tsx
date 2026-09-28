import { brand, CtaButton, EmailLayout, money, Section, Text, eyebrow, label, h1, text } from "./components";

export type PaymentReceivedProps = {
  number: number;
  firstName: string | null;
  amount: number;
  reference: string | null;
  orderUrl: string;
};

export default function PaymentReceivedEmail(p: PaymentReceivedProps) {
  return (
    <EmailLayout preview={`Thank you, we've received ${money(p.amount)} for order #${p.number}.`}>
      <Text style={eyebrow}>Order #{p.number}</Text>
      <h1 style={h1}>Payment received, thank you</h1>
      <Text style={text}>
        {p.firstName ? `Hello ${p.firstName}, your` : "Your"} bank transfer has arrived and the invoice for this order is now settled. There is
        nothing more to do.
      </Text>
      <Section style={{ backgroundColor: brand.cream, padding: "20px 24px", margin: "8px 0 24px" }}>
        <Text style={label}>Paid</Text>
        <Text style={{ fontFamily: brand.serif, fontSize: 32, color: brand.ink, margin: "0 0 4px" }}>{money(p.amount)}</Text>
        {p.reference && <Text style={{ ...text, margin: 0 }}>Reference: {p.reference}</Text>}
      </Section>
      <CtaButton href={p.orderUrl}>View your order</CtaButton>
    </EmailLayout>
  );
}

PaymentReceivedEmail.PreviewProps = { number: 10042, firstName: "Eleanor", amount: 18450, reference: "BQ10042", orderUrl: "http://localhost:3000/account/orders" } satisfies PaymentReceivedProps;
