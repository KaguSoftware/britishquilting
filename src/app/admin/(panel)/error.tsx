"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex min-h-[60svh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-4xl text-aubergine-900">Something broke in the back office</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        It&apos;s usually momentary. Try again, and if it keeps happening call the shop on{" "}
        <a href="tel:+447710131416" className="text-aubergine-700 underline underline-offset-4">07710 131416</a>.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-sm bg-aubergine-900 px-5 text-sm font-medium text-cream-50 hover:bg-aubergine-800"
        >
          Try again
        </button>
        <a
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-sm border border-stone-300 px-5 text-sm font-medium text-ink hover:border-aubergine-300"
        >
          Back to today
        </a>
      </div>
    </div>
  );
}
