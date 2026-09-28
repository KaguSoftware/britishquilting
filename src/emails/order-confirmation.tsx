import {
  AddressBlock,
  CtaButton,
  Divider,
  EmailLayout,
  OrderLines,
  OrderTotals,
  Section,
  Text,
  eyebrow,
  label,
  h1,
  h2,
  text,
  type EmailAddress,
  type EmailLine,
  type EmailTotals,
} from "./components";

export type OrderEmailProps = {
  number: number;
  firstName: string | null;
  lines: EmailLine[];
  totals: EmailTotals;
  shippingAddress: EmailAddress | null;
  collection: { address: string | null; hours: string | null } | null;
  orderUrl: string;
};

export default function OrderConfirmationEmail(p: OrderEmailProps) {
  const collecting = p.totals.fulfilment === "collection";
  return (
    <EmailLayout
      preview={`Thank you. Order #${p.number} is confirmed and with our cutting room.`}
      footerNote="Questions about your order? Simply reply to this email and a member of our team will help."
    >
      <Text style={eyebrow}>Order #{p.number}</Text>
      <h1 style={h1}>Thank you{p.firstName ? `, ${p.firstName}` : ""}.</h1>
      <Text style={text}>
        Your payment has been received and your order is now with our cutting room. Every length is measured twice and cut by hand, then{" "}
        {collecting ? "set aside for you to collect from our London workroom." : "packed carefully and sent on its way."}
      </Text>
      <Text style={text}>
        {collecting
          ? "We'll email you as soon as it's ready for collection, usually within one working day."
          : "We'll email you with tracking the moment it's dispatched, usually within one to two working days."}
      </Text>
      <Section style={{ margin: "8px 0 4px" }}>
        <CtaButton href={p.orderUrl}>View your order</CtaButton>
      </Section>
      <Divider />
      <h2 style={h2}>Your order</h2>
      <OrderLines lines={p.lines} />
      <OrderTotals t={p.totals} />
      <Divider />
      {collecting ? (
        <>
          <Text style={label}>Click & collect</Text>
          <Text style={{ ...text, color: "#1d1720" }}>
            {p.collection?.address ?? "Our London workroom"}
            {p.collection?.hours && (
              <>
                <br />
                {p.collection.hours}
              </>
            )}
          </Text>
          <Text style={text}>Please wait for your ready-for-collection email and bring your order number with you.</Text>
        </>
      ) : (
        p.shippingAddress && <AddressBlock title="Delivering to" address={p.shippingAddress} />
      )}
    </EmailLayout>
  );
}

OrderConfirmationEmail.PreviewProps = {
  number: 10042,
  firstName: "Eleanor",
  lines: [
    { name: "Cotton Sateen Lining, Ivory", detail: "3.5m cut x 2", total: 4550, image: null },
    { name: "Bump Interlining, Natural", detail: "Swatch", total: 0, image: null },
  ],
  totals: { subtotal: 4550, discount: 0, discountCode: null, shipping: 495, shippingName: "Royal Mail Tracked 48", fulfilment: "delivery", total: 5045, vat: 841 },
  shippingAddress: { fullName: "Eleanor Hart", line1: "12 Elm Row", city: "London", postcode: "N16 7UL" },
  collection: null,
  orderUrl: "http://localhost:3000/account/orders",
} satisfies OrderEmailProps;
