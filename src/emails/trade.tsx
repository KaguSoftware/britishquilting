import { brand, CtaButton, EmailLayout, Section, Text, eyebrow, h1, siteUrl, text } from "./components";

export type TradeDecisionProps = { firstName: string | null; company: string | null };

export function TradeApprovedEmail(p: TradeDecisionProps) {
  const url = siteUrl();
  return (
    <EmailLayout preview="Your British Quilting trade account is approved.">
      <Text style={eyebrow}>Trade account</Text>
      <h1 style={h1}>Welcome to the trade, {p.firstName ?? "and thank you"}</h1>
      <Text style={text}>
        We&apos;re delighted to confirm that {p.company ?? "your business"} now has a British Quilting trade account. Sign in and you&apos;ll see trade
        prices across the shop, applied automatically at checkout.
      </Text>
      <Section style={{ backgroundColor: brand.cream, padding: "20px 24px", margin: "8px 0 24px" }}>
        <Text style={{ ...text, margin: 0 }}>
          Trade pricing on every length and roll
          <br />
          Pay by invoice on approved accounts
          <br />
          A direct line to our cutting room
        </Text>
      </Section>
      <CtaButton href={`${url}/shop/linings`}>Shop at trade prices</CtaButton>
    </EmailLayout>
  );
}

export function TradeRejectedEmail(p: TradeDecisionProps) {
  const url = siteUrl();
  return (
    <EmailLayout preview="An update on your trade account application." footerNote="If you think we've got this wrong, simply reply and we'll take another look.">
      <Text style={eyebrow}>Trade account</Text>
      <h1 style={h1}>Thank you for applying</h1>
      <Text style={text}>
        {p.firstName ? `Hello ${p.firstName}, we` : "We"} have reviewed your application{p.company ? ` for ${p.company}` : ""} and aren&apos;t able to
        approve a trade account at this time. Trade accounts are for registered upholsterers, curtain makers and interior businesses, and we
        sometimes need a little more information to confirm this.
      </Text>
      <Text style={text}>You&apos;re still very welcome to shop with us at our standard prices, with swatches available on every fabric.</Text>
      <CtaButton href={`${url}/contact`}>Get in touch</CtaButton>
    </EmailLayout>
  );
}

TradeApprovedEmail.PreviewProps = { firstName: "Tom", company: "Hart & Sons Interiors" } satisfies TradeDecisionProps;
TradeRejectedEmail.PreviewProps = { firstName: "Tom", company: "Hart & Sons Interiors" } satisfies TradeDecisionProps;
