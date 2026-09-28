import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import { Announcement } from "@/components/site/announcement";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { getStoreSettings } from "@/lib/data/catalog";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStoreSettings().catch(() => null);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-cream-50 focus:px-4 focus:py-2">
        Skip to content
      </a>
      <SmoothScroll />
      <Announcement message={settings?.announcement} />
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <CartDrawer />
    </>
  );
}
