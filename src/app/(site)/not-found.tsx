import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/shop/bits";

export default function NotFound() {
  return (
    <section className="mx-auto grid min-h-[80svh] max-w-7xl items-center gap-12 px-4 pb-20 pt-32 md:grid-cols-[1fr_1fr] md:px-8">
      <div>
        <p className="font-display text-[7rem] leading-none text-gold-500 md:text-[10rem]">404</p>
        <h1 className="font-display mt-4 text-5xl md:text-6xl">This length has gone astray.</h1>
        <p className="mt-5 max-w-md text-lg text-ink-soft">
          The page you&apos;re after may have moved, or the fabric may no longer be stocked. Our cloth room is a good place to start again.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/shop" className={btnPrimary}>Browse fabrics</Link>
          <Link href="/contact" className={btnSecondary}>Ask the workroom</Link>
        </div>
      </div>
      <div aria-hidden className="relative hidden aspect-square md:block">
        <div className="absolute inset-[12%] rotate-[-4deg] bg-cream-50 shadow-soft" />
        <div
          className="absolute inset-[16%] rotate-[3deg] shadow-lift"
          style={{ backgroundColor: "#4a1d5c", backgroundImage: "repeating-linear-gradient(45deg, rgb(255 255 255 / .05) 0 2px, transparent 2px 5px), linear-gradient(100deg, transparent 20%, rgb(255 255 255 / .12) 35%, transparent 50%)" }}
        />
        <div className="absolute bottom-[10%] left-[8%] h-px w-[84%] rotate-[3deg] stitch" />
      </div>
    </section>
  );
}
