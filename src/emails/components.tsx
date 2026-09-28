import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

export const brand = {
  cream: "#f6f1e7",
  cream50: "#fbf8f2",
  cream200: "#ece4d3",
  aubergine: "#4a1d5c",
  aubergineDeep: "#2a1036",
  gold: "#c9a45c",
  gold600: "#a8843f",
  ink: "#1d1720",
  inkSoft: "#4b4250",
  stone: "#d9d0bf",
  serif: "'Libre Caslon Text', 'Libre Caslon', Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
};

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export const money = (pence: number) => gbp.format(pence / 100);

export const text: CSSProperties = { fontFamily: brand.sans, fontSize: 15, lineHeight: "24px", color: brand.inkSoft, margin: "0 0 16px" };
export const eyebrow: CSSProperties = {
  fontFamily: brand.sans,
  fontSize: 11,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: brand.gold600,
  margin: "0 0 8px",
  fontWeight: 600,
};
export const label: CSSProperties = { fontFamily: brand.sans, fontSize: 13, fontWeight: 600, color: brand.ink, margin: "0 0 6px" };
export const h1: CSSProperties = { fontFamily: brand.serif, fontSize: 34, lineHeight: "40px", fontWeight: 500, color: brand.ink, margin: "0 0 16px" };
export const h2: CSSProperties = { fontFamily: brand.serif, fontSize: 22, lineHeight: "28px", fontWeight: 500, color: brand.ink, margin: "0 0 12px" };

export function EmailLayout({ preview, children, footerNote }: { preview: string; children: ReactNode; footerNote?: ReactNode }) {
  const url = siteUrl();
  return (
    <Html lang="en-GB">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: brand.cream, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 600, width: "100%", margin: "0 auto" }}>
          <Section style={{ backgroundColor: brand.aubergine, padding: "28px 32px", textAlign: "center" }}>
            <Link href={url}>
              <Img src={`${url}/brand/logo.png`} alt="British Quilting" height="48" style={{ margin: "0 auto", height: 48, width: "auto" }} />
            </Link>
          </Section>
          <Section style={{ height: 3, backgroundColor: brand.gold }} />
          <Section style={{ backgroundColor: brand.cream50, padding: "40px 32px 32px" }}>{children}</Section>
          <Section style={{ padding: "24px 32px", textAlign: "center" }}>
            {footerNote && <Text style={{ ...text, fontSize: 13, lineHeight: "20px", margin: "0 0 12px" }}>{footerNote}</Text>}
            <Text style={{ ...text, fontSize: 12, lineHeight: "18px", color: "#8f8574", margin: 0 }}>
              British Quilting, London. Linings, interlinings and workroom supplies.
              <br />
              <Link href={url} style={{ color: brand.aubergine }}>britishquilting.com</Link>
              {"  ·  "}
              <Link href={`${url}/contact`} style={{ color: brand.aubergine }}>Contact us</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: brand.aubergine,
        color: brand.cream50,
        fontFamily: brand.sans,
        fontSize: 14,
        letterSpacing: "0.04em",
        padding: "14px 28px",
        textDecoration: "none",
        display: "inline-block",
      }}
    >
      {children}
    </Button>
  );
}

export function Divider() {
  return <Hr style={{ borderColor: brand.stone, borderTopWidth: 1, margin: "28px 0" }} />;
}

export type EmailLine = { name: string; detail: string | null; total: number; image: string | null };

export type EmailTotals = {
  subtotal: number;
  discount: number;
  discountCode: string | null;
  shipping: number;
  shippingName: string | null;
  fulfilment: "delivery" | "collection";
  total: number;
  vat: number;
};

export function OrderLines({ lines }: { lines: EmailLine[] }) {
  return (
    <Section>
      {lines.map((l, i) => (
        <Row key={i} style={{ borderBottom: `1px solid ${brand.cream200}` }}>
          <Column style={{ width: 64, padding: "12px 0" }}>
            {l.image ? (
              <Img src={l.image} alt="" width="52" height="52" style={{ objectFit: "cover", backgroundColor: brand.cream200 }} />
            ) : (
              <div style={{ width: 52, height: 52, backgroundColor: brand.cream200 }} />
            )}
          </Column>
          <Column style={{ padding: "12px 12px 12px 0" }}>
            <Text style={{ ...text, margin: 0, color: brand.ink, fontSize: 14, lineHeight: "20px" }}>{l.name}</Text>
            {l.detail && <Text style={{ ...text, margin: 0, fontSize: 13, lineHeight: "18px" }}>{l.detail}</Text>}
          </Column>
          <Column style={{ width: 90, textAlign: "right", padding: "12px 0" }}>
            <Text style={{ ...text, margin: 0, color: brand.ink, fontSize: 14 }}>{money(l.total)}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const s: CSSProperties = { ...text, margin: 0, fontSize: strong ? 18 : 14, color: strong ? brand.ink : brand.inkSoft, fontFamily: strong ? brand.serif : brand.sans };
  return (
    <Row>
      <Column style={{ padding: "4px 0" }}>
        <Text style={s}>{label}</Text>
      </Column>
      <Column style={{ padding: "4px 0", textAlign: "right" }}>
        <Text style={s}>{value}</Text>
      </Column>
    </Row>
  );
}

export function OrderTotals({ t }: { t: EmailTotals }) {
  return (
    <Section style={{ marginTop: 12 }}>
      <TotalRow label="Subtotal" value={money(t.subtotal)} />
      {t.discount > 0 && <TotalRow label={`Discount${t.discountCode ? ` (${t.discountCode})` : ""}`} value={`-${money(t.discount)}`} />}
      <TotalRow
        label={t.fulfilment === "collection" ? "Click & collect" : (t.shippingName ?? "Delivery")}
        value={t.fulfilment === "collection" || t.shipping === 0 ? "Free" : money(t.shipping)}
      />
      <Hr style={{ borderColor: brand.stone, margin: "8px 0" }} />
      <TotalRow label="Total" value={money(t.total)} strong />
      <Text style={{ ...text, fontSize: 12, margin: "4px 0 0", textAlign: "right" }}>Includes {money(t.vat)} VAT</Text>
    </Section>
  );
}

export type EmailAddress = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  county?: string | null;
  postcode: string;
};

export function AddressBlock({ title, address }: { title: string; address: EmailAddress }) {
  return (
    <>
      <Text style={label}>{title}</Text>
      <Text style={{ ...text, color: brand.ink }}>
        {address.fullName}
        <br />
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        <br />
        {address.city}
        {address.county ? `, ${address.county}` : ""}
        <br />
        {address.postcode}
      </Text>
    </>
  );
}

export { Heading, Text, Section, Link, Row, Column, Img };
