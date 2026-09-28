import { Skeleton } from "@/components/shop/bits";

export default function ShopLoading() {
  return (
    <div aria-busy="true" aria-label="Loading fabrics">
      <div className="border-b border-stone-300 bg-cream-50 pt-16 md:pt-20">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-8 md:pt-14">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-12 h-3 w-24" />
          <Skeleton className="mt-5 h-14 w-full max-w-xl" />
          <Skeleton className="mt-6 h-5 w-full max-w-lg" />
          <Skeleton className="mt-3 h-5 w-2/3 max-w-md" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex justify-between border-b border-stone-300 py-5">
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-44" />
        </div>
        <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[4/5] w-full" />
              <Skeleton className="mt-4 h-6 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
