import { brand, CtaButton, EmailLayout, Img, Section, Text, eyebrow, h1, siteUrl, text } from "./components";

export type BackInStockProps = { name: string; subtitle: string | null; url: string; image: string | null; price: string };

export function BackInStockEmail(p: BackInStockProps) {
  return (
    <EmailLayout preview={`${p.name} is back in stock.`} footerNote="You received this because you asked us to let you know. We won't email you about this fabric again.">
      <Text style={eyebrow}>Back on the shelf</Text>
      <h1 style={h1}>{p.name} is back</h1>
      {p.image && <Img src={p.image} alt={p.name} width="536" style={{ width: "100%", height: "auto", margin: "0 0 20px" }} />}
      <Text style={text}>
        You asked us to tell you when {p.name}
        {p.subtitle ? ` (${p.subtitle})` : ""} returned. It&apos;s back in the workroom now, from {p.price}. Popular cloths go quickly, so do order
        soon.
      </Text>
      <CtaButton href={p.url}>Order now</CtaButton>
    </EmailLayout>
  );
}

export type LowStockProps = { products: { name: string; stock: string; threshold: string; adminUrl: string }[] };

export function LowStockEmail(p: LowStockProps) {
  return (
    <EmailLayout preview={`${p.products.length} product${p.products.length === 1 ? "" : "s"} running low.`}>
      <Text style={eyebrow}>Staff notice</Text>
      <h1 style={h1}>Stock running low</h1>
      <Text style={text}>The following products have fallen to or below their low stock threshold after a recent order.</Text>
      <Section>
        {p.products.map((x) => (
          <Section key={x.adminUrl} style={{ borderBottom: `1px solid ${brand.cream200}`, padding: "12px 0" }}>
            <Text style={{ ...text, margin: 0, color: brand.ink }}>
              <a href={x.adminUrl} style={{ color: brand.aubergine }}>{x.name}</a>
            </Text>
            <Text style={{ ...text, margin: 0, fontSize: 13 }}>
              {x.stock} left (alert at {x.threshold})
            </Text>
          </Section>
        ))}
      </Section>
      <Section style={{ marginTop: 24 }}>
        <CtaButton href={`${siteUrl()}/admin/products`}>Open products</CtaButton>
      </Section>
    </EmailLayout>
  );
}

BackInStockEmail.PreviewProps = { name: "Cotton Sateen Lining", subtitle: "Ivory", url: "http://localhost:3000/product/x", image: null, price: "£12.50/m" } satisfies BackInStockProps;
LowStockEmail.PreviewProps = { products: [{ name: "Blackout Lining, White", stock: "4.5m", threshold: "10m", adminUrl: "http://localhost:3000/admin/products/x" }] } satisfies LowStockProps;
