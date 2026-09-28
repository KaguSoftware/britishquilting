"use client";

import Link from "next/link";
import { btnPrimary, btnSecondary } from "./bits";

export function PageError({ retry, title = "Something came loose" }: { retry: () => void; title?: string }) {
  return (
    <section className="mx-auto flex min-h-[70svh] max-w-2xl flex-col items-center justify-center px-4 pb-20 pt-32 text-center">
      <h1 className="font-display mt-4 text-5xl md:text-6xl">{title}</h1>
      <p className="mt-5 max-w-md text-lg text-ink-soft">
        We couldn&apos;t load this page just now. It&apos;s usually momentary, so please try again. If it persists, call us on{" "}
        <a href="tel:+447710131416" className="text-aubergine-700 underline underline-offset-4">07710 131416</a>.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button onClick={() => retry()} className={btnPrimary}>Try again
        </button>
        <Link href="/" className={btnSecondary}>Back to home</Link>
      </div>
    </section>
  );
}
