import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display, Libre_Caslon_Text, Schibsted_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { CartProvider } from "@/components/cart/cart-store";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

// Caslon: the typeface of English printing since the 1720s. Display cut for headings, Text cut for italics and small serif copy.
const display = Libre_Caslon_Display({ variable: "--font-caslon-display", subsets: ["latin"], weight: "400" });
const serif = Libre_Caslon_Text({ variable: "--font-caslon-text", subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"] });
// A newsprint grotesk for UI, sturdier and less anonymous than the usual geometric sans.
const sans = Schibsted_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "British Quilting | Curtain linings & interlinings, cut to order", template: "%s · British Quilting" },
  description:
    "Family-run in London since 1990. Cotton sateen linings, bump and domette interlinings and workroom paper, cut to your length and delivered across the UK.",
  openGraph: { siteName: "British Quilting", locale: "en_GB", type: "website" },
  icons: { icon: "/brand/logo.png", apple: "/brand/logo.png" },
};

export const viewport: Viewport = { themeColor: "#1c0a24" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${display.variable} ${serif.variable} ${sans.variable}`}>
      <body className="grain min-h-svh">
        <CartProvider>
          {children}
          <Toaster position="bottom-center" toastOptions={{ className: "!rounded-sm !border-stone-300 !bg-cream-50 !font-sans !text-ink" }} />
        </CartProvider>
      </body>
    </html>
  );
}
