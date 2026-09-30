"use client";

export default function PrintError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex min-h-svh flex-col items-center justify-center bg-white px-8 text-center text-black print:hidden">
      <p className="font-display text-3xl">Couldn&apos;t load this packing slip</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed">It&apos;s usually momentary. Try again, or go back and open the order from Orders.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center border-2 border-black px-5 text-sm font-medium hover:bg-black hover:text-white"
      >
        Try again
      </button>
    </div>
  );
}
