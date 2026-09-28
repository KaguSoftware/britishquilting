import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter_Tight } from "next/font/google";
import { Toaster } from "sonner";
import { CartProvider } from "@/components/cart/cart-store";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});
const sans = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });

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
    <html lang="en-GB" className={`${display.variable} ${sans.variable}`}>
      <body className="grain min-h-svh">
        <CartProvider>
          {children}
          <Toaster position="bottom-center" toastOptions={{ className: "!rounded-sm !border-stone-300 !bg-cream-50 !font-sans !text-ink" }} />
        </CartProvider>
      </body>
    </html>
  );
}
