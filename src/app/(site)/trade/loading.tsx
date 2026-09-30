import { Skeleton } from "@/components/shop/bits";
import { cn } from "@/lib/utils";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading trade page">
      <div className="border-b border-aubergine-800 bg-aubergine-900 pt-16 md:pt-20">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-8 md:pt-14">
          <Skeleton className="h-3 w-28 bg-cream-50/15" />
          <Skeleton className="mt-12 h-14 w-full max-w-xl bg-cream-50/15" />
          <Skeleton className="mt-6 h-5 w-full max-w-lg bg-cream-50/15" />
          <Skeleton className="mt-3 h-5 w-2/3 max-w-md bg-cream-50/15" />
          <div className="mt-10 flex flex-wrap gap-3">
            <Skeleton className="h-13 w-56 bg-cream-50/15" />
            <Skeleton className="h-13 w-40 bg-cream-50/15" />
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <Skeleton className="h-10 w-72" />
        <div className="mt-10 border-t border-ink/80">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("grid gap-2 border-b border-stone-300 py-6 md:grid-cols-[80px_280px_1fr] md:gap-8")}>
              <Skeleton className="h-7 w-8" />
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-5 w-full max-w-md" />
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-stone-300 bg-cream-50">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 md:grid-cols-2 md:px-8 md:py-28">
          <div>
            <Skeleton className="h-10 w-56" />
            <Skeleton className="mt-4 h-5 w-full max-w-md" />
          </div>
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[48px_1fr] gap-4">
                <Skeleton className="h-10 w-8" />
                <div>
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="mt-2 h-5 w-full max-w-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
