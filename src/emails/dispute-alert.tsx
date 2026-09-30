import { brand, CtaButton, EmailLayout, Section, Text, eyebrow, h1, text } from "./components";

export type DisputeAlertProps = {
  orderNumber: number;
  amount: string;
  reason: string;
  status: string;
  evidenceDueBy: string | null;
  dashboardUrl: string;
  adminUrl: string;
};

const STATUS_LABEL: Record<string, string> = {
  warning_needs_response: "Early warning, no response needed yet",
  needs_response: "Needs a response",
  under_review: "Under review",
  won: "Resolved in your favour",
  lost: "Lost, funds taken back",
  warning_closed: "Early warning closed",
  charge_refunded: "Charge already refunded",
};

export function DisputeAlertEmail(p: DisputeAlertProps) {
  return (
    <EmailLayout preview={`Order #${p.orderNumber}: payment disputed by the customer's bank.`}>
      <Text style={eyebrow}>Staff notice</Text>
      <h1 style={h1}>Payment disputed: order #{p.orderNumber}</h1>
      <Text style={text}>
        The customer&apos;s bank has disputed the payment on order #{p.orderNumber} for {p.amount}. Reason given: {p.reason}.
      </Text>
      <Section style={{ borderLeft: `2px solid ${brand.aubergine}`, padding: "2px 16px", margin: "16px 0" }}>
        <Text style={{ ...text, margin: 0, fontWeight: 600 }}>{STATUS_LABEL[p.status] ?? p.status}</Text>
        {p.evidenceDueBy && <Text style={{ ...text, margin: 0, fontSize: 13 }}>Respond by {new Date(p.evidenceDueBy).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</Text>}
      </Section>
      <Text style={text}>If the order hasn&apos;t shipped yet, consider holding it until this is resolved.</Text>
      <Section style={{ marginTop: 24 }}>
        <CtaButton href={p.dashboardUrl}>Respond in Stripe</CtaButton>
      </Section>
      <Text style={{ ...text, fontSize: 13 }}>
        <a href={p.adminUrl} style={{ color: brand.aubergine }}>View the order</a>
      </Text>
    </EmailLayout>
  );
}

DisputeAlertEmail.PreviewProps = {
  orderNumber: 1042,
  amount: "£64.50",
  reason: "fraudulent",
  status: "needs_response",
  evidenceDueBy: new Date(Date.now() + 7 * 86400000).toISOString(),
  dashboardUrl: "https://dashboard.stripe.com/disputes/dp_x",
  adminUrl: "http://localhost:3000/admin/orders/x",
} satisfies DisputeAlertProps;
