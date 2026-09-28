import { brand, CtaButton, Divider, EmailLayout, OrderLines, Section, Text, eyebrow, label, h1, h2, text, AddressBlock, type EmailAddress, type EmailLine } from "./components";

export type DispatchedProps = {
  number: number;
  firstName: string | null;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  lines: EmailLine[];
  shippingAddress: EmailAddress | null;
  orderUrl: string;
};

export default function DispatchedEmail(p: DispatchedProps) {
  return (
    <EmailLayout preview={`Order #${p.number} is on its way with ${p.carrier}.`}>
      <Text style={eyebrow}>Order #{p.number}</Text>
      <h1 style={h1}>Your fabric is on its way</h1>
      <Text style={text}>
        Good news{p.firstName ? `, ${p.firstName}` : ""}. Your order has been cut, rolled with care and handed to {p.carrier}.
      </Text>
      <Section style={{ backgroundColor: brand.cream, padding: "20px 24px", margin: "8px 0 24px" }}>
        <Text style={label}>{p.carrier} tracking</Text>
        <Text style={{ ...text, color: brand.ink, fontSize: 18, margin: "0 0 16px", letterSpacing: "0.04em" }}>{p.trackingNumber}</Text>
        {p.trackingUrl ? <CtaButton href={p.trackingUrl}>Track your parcel</CtaButton> : <CtaButton href={p.orderUrl}>View your order</CtaButton>}
      </Section>
      {p.shippingAddress && <AddressBlock title="Delivering to" address={p.shippingAddress} />}
      <Divider />
      <h2 style={h2}>In this parcel</h2>
      <OrderLines lines={p.lines} />
    </EmailLayout>
  );
}

DispatchedEmail.PreviewProps = {
  number: 10042,
  firstName: "Eleanor",
  carrier: "Royal Mail",
  trackingNumber: "AB123456789GB",
  trackingUrl: "https://www.royalmail.com/track-your-item",
  lines: [{ name: "Cotton Sateen Lining, Ivory", detail: "3.5m cut x 2", total: 4550, image: null }],
  shippingAddress: { fullName: "Eleanor Hart", line1: "12 Elm Row", city: "London", postcode: "N16 7UL" },
  orderUrl: "http://localhost:3000/account/orders",
} satisfies DispatchedProps;
