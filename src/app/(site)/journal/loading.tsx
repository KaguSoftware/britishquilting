import { Skeleton } from "@/components/shop/bits";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading journal" className="mx-auto max-w-7xl px-4 pb-24 pt-28 md:px-8 md:pt-36">
      <Skeleton className="h-14 w-full max-w-xl" />
      <Skeleton className="mt-6 h-5 w-full max-w-lg" />
      <div className="mt-16 grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <Skeleton className="aspect-[3/2]" />
        <div className="self-end space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /><Skeleton className="h-5 w-3/4" /></div>
      </div>
    </div>
  );
}
