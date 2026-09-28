import { Skeleton } from "@/components/shop/bits";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading swatches" className="pt-16 md:pt-20">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-12 h-16 w-full max-w-2xl" />
        <Skeleton className="mt-6 h-5 w-full max-w-xl" />
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:grid-cols-3 md:px-8 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
      </div>
    </div>
  );
}
