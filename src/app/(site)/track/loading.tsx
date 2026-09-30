import { Skeleton } from "@/components/shop/bits";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading order tracking">
      <div className="border-b border-stone-300 bg-cream-50 pt-16 md:pt-20">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-8 md:pt-14">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-12 h-14 w-full max-w-md" />
          <Skeleton className="mt-6 h-5 w-full max-w-sm" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="grid gap-14 lg:grid-cols-[380px_1fr] lg:gap-20">
          <div className="space-y-5">
            <div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-12 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-12 w-full" />
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="aspect-[3/2] w-full md:aspect-[16/7]" />
        </div>
      </div>
    </div>
  );
}
