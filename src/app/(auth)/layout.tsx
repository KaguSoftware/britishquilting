import Link from "next/link";
import { IconArrowLeft } from "@/components/icons";
import { Crown, Logo } from "@/components/site/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Heritage panel */}
      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-aubergine-900 text-cream-50 lg:flex lg:flex-col lg:justify-between"
      >
        {/* Woven cloth texture */}
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgb(255 255 255 / .025) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgb(0 0 0 / .12) 0 1px, transparent 1px 3px), radial-gradient(120% 80% at 20% 0%, rgb(116 65 139 / .55), transparent 60%), radial-gradient(90% 70% at 100% 100%, rgb(28 10 36 / .9), transparent 70%)",
          }}
        />
        {/* Soft drape folds */}
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            backgroundImage:
              "repeating-linear-gradient(100deg, rgb(255 255 255 / 0) 0 60px, rgb(255 255 255 / .09) 90px, rgb(255 255 255 / 0) 130px, rgb(0 0 0 / .14) 170px, rgb(255 255 255 / 0) 210px)",
          }}
        />
        <div className="relative flex items-center gap-3 p-10 xl:p-14">
          <Crown className="h-6 w-9 text-gold-500" />
          <span className="font-display text-2xl tracking-tight">British Quilting</span>
        </div>

        <figure className="relative mx-10 max-w-lg pb-6 xl:mx-14">
          <Crown className="mb-10 h-14 w-24 text-gold-500/90" />
          <blockquote className="font-display text-4xl leading-[1.12] text-cream-50 xl:text-5xl">
            <span className="text-gold-300">&ldquo;</span>A curtain is only ever as good as what lies behind it.<span className="text-gold-300">&rdquo;</span>
          </blockquote>
          <div className="stitch mt-10 w-28 opacity-80" />
          <figcaption className="eyebrow mt-5 text-gold-300">Cutting linings in London since 1990</figcaption>
        </figure>

        <div className="relative grid grid-cols-3 gap-6 border-t border-cream-50/10 p-10 text-sm text-cream-50/70 xl:px-14">
          <p><span className="font-display block text-2xl text-cream-50">35</span>years family-run</p>
          <p><span className="font-display block text-2xl text-cream-50">1 to 2</span>day dispatch</p>
          <p><span className="font-display block text-2xl text-cream-50">UK</span>tracked delivery</p>
        </div>
      </aside>

      {/* Form side */}
      <div className="relative flex min-h-svh flex-col bg-cream-100">
        <header className="flex items-center justify-between px-5 py-5 sm:px-10">
          <Logo className="lg:invisible" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm text-ink-soft transition-colors hover:text-aubergine-800"
          >
            <IconArrowLeft className="size-4" /> Back to shop
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-5 pb-16 pt-4 sm:px-10">
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>
        <footer className="px-5 pb-6 text-center text-xs text-stone-500 sm:px-10">
          Secure sign-in. We never share your details. <Link href="/legal/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        </footer>
      </div>
    </div>
  );
}
