import { brand, CtaButton, Divider, EmailLayout, OrderLines, Section, Text, eyebrow, label, h1, h2, text, type EmailLine } from "./components";

export type ReadyForCollectionProps = {
  number: number;
  firstName: string | null;
  address: string | null;
  hours: string | null;
  lines: EmailLine[];
  orderUrl: string;
};

export default function ReadyForCollectionEmail(p: ReadyForCollectionProps) {
  return (
    <EmailLayout preview={`Order #${p.number} is ready to collect from our London workroom.`}>
      <Text style={eyebrow}>Order #{p.number}</Text>
      <h1 style={h1}>Ready when you are</h1>
      <Text style={text}>
        {p.firstName ? `${p.firstName}, your` : "Your"} order has been cut and is waiting for you at our workroom. Please bring your order number
        (or this email) when you come in.
      </Text>
      <Section style={{ backgroundColor: brand.cream, padding: "20px 24px", margin: "8px 0 24px" }}>
        <Text style={label}>Collect from</Text>
        <Text style={{ ...text, color: brand.ink, whiteSpace: "pre-line" }}>{p.address ?? "British Quilting, London"}</Text>
        {p.hours && (
          <>
            <Text style={label}>Opening hours</Text>
            <Text style={{ ...text, color: brand.ink, margin: 0 }}>{p.hours}</Text>
          </>
        )}
      </Section>
      <CtaButton href={p.orderUrl}>View your order</CtaButton>
      <Divider />
      <h2 style={h2}>Your order</h2>
      <OrderLines lines={p.lines} />
    </EmailLayout>
  );
}

ReadyForCollectionEmail.PreviewProps = {
  number: 10042,
  firstName: "Eleanor",
  address: "Unit 4, Example Yard, London E2",
  hours: "Mon to Fri, 9am to 5pm",
  lines: [{ name: "Cotton Sateen Lining, Ivory", detail: "3.5m cut", total: 2275, image: null }],
  orderUrl: "http://localhost:3000/account/orders",
} satisfies ReadyForCollectionProps;
