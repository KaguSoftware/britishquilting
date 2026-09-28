import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/shop/bits";

export default function ProductNotFound() {
  return (
    <section className="mx-auto flex min-h-[75svh] max-w-2xl flex-col items-center justify-center px-4 pb-20 pt-32 text-center">
      <h1 className="font-display text-5xl md:text-6xl">We can&apos;t find that fabric.</h1>
      <p className="mt-5 max-w-md text-lg text-ink-soft">It may have been discontinued or renamed. Tell us what you were looking for and we&apos;ll suggest the closest match on the bolt.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/shop" className={btnPrimary}>Browse all fabrics</Link>
        <Link href="/contact" className={btnSecondary}>Ask us</Link>
      </div>
    </section>
  );
}
