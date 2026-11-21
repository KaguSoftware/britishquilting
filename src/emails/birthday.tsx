import { brand, CtaButton, EmailLayout, Section, Text, eyebrow, h1, siteUrl, text } from "./components";

export type BirthdayEmailProps = {
  firstName: string | null;
  /** "15% off" or "£10 off" */
  offer: string;
  /** How many days the treat lasts, counting today. */
  days: number;
  /** The last day it applies, e.g. "Sunday 6 December". */
  until: string;
  /** "on orders over £40", or empty. */
  minimum: string;
};

export default function BirthdayEmail({ firstName, offer, days, until, minimum }: BirthdayEmailProps) {
  const url = siteUrl();
  return (
    <EmailLayout
      preview={`Happy birthday${firstName ? `, ${firstName}` : ""}. A little something from the workroom: ${offer} until ${until}.`}
      footerNote="You're receiving this because you told us your birthday. You can remove it at any time in your account settings."
    >
      <Text style={eyebrow}>Many happy returns</Text>
      <h1 style={h1}>Happy birthday{firstName ? `, ${firstName}` : ""}</h1>
      <Text style={text}>
        Everyone at British Quilting wishes you a wonderful day. To celebrate, we&apos;ve put a little something aside for you.
      </Text>
      <Section style={{ backgroundColor: brand.cream, padding: "22px 24px", margin: "8px 0 24px", borderLeft: `3px solid ${brand.gold}` }}>
        <Text style={{ ...text, fontFamily: brand.serif, fontSize: 24, lineHeight: "30px", color: brand.ink, margin: "0 0 8px" }}>{offer} your next order</Text>
        <Text style={{ ...text, margin: 0 }}>
          It&apos;s taken off automatically at checkout when you&apos;re signed in, no code needed. It lasts {days === 1 ? "today only" : `for ${days} days, until ${until}`}
          {minimum ? `, ${minimum}` : ""}.
        </Text>
      </Section>
      <CtaButton href={`${url}/shop`}>Treat yourself</CtaButton>
    </EmailLayout>
  );
}
