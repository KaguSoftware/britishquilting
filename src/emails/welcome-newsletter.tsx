import { brand, CtaButton, EmailLayout, Section, Text, eyebrow, h1, siteUrl, text } from "./components";

export default function WelcomeNewsletterEmail() {
  const url = siteUrl();
  return (
    <EmailLayout preview="Welcome to British Quilting. Workroom notes, new cloths and the occasional offer." footerNote="You can unsubscribe at any time using the link in any of our emails.">
      <Text style={eyebrow}>Welcome</Text>
      <h1 style={h1}>Pleased to have you with us</h1>
      <Text style={text}>
        Thank you for joining the British Quilting list. A few times a month we&apos;ll send notes from the workroom: new linings and interlinings as
        they arrive, making tips from the trade, and first word on offers.
      </Text>
      <Section style={{ backgroundColor: brand.cream, padding: "20px 24px", margin: "8px 0 24px" }}>
        <Text style={{ ...text, margin: 0 }}>
          Not sure which lining suits your curtains? Order free swatches first and feel the weight and drape of the cloth before you commit.
        </Text>
      </Section>
      <CtaButton href={`${url}/shop/linings`}>Browse the collection</CtaButton>
    </EmailLayout>
  );
}
