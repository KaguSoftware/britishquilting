import { Skeleton } from "@/components/shop/bits";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading fabric" className="mx-auto max-w-7xl px-4 pb-24 pt-24 md:px-8 md:pt-32">
      <Skeleton className="h-3 w-56" />
      <div className="mt-8 grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-14 lg:gap-20">
        <Skeleton className="aspect-[4/5] w-full" />
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-14 w-4/5" />
          <Skeleton className="mt-3 h-5 w-1/2" />
          <div className="stitch my-8 opacity-40" />
          <Skeleton className="h-12 w-40" />
          <Skeleton className="mt-8 h-16 w-full" />
          <div className="mt-3 flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-14" />)}</div>
          <Skeleton className="mt-8 h-20 w-full" />
          <Skeleton className="mt-6 h-14 w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
