export default function AccountLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading your account</span>
      <div className="h-9 w-48 bg-cream-200" />
      <div className="mt-3 h-4 w-72 max-w-full bg-cream-200/80" />
      <div className="mt-8 border-t-2 border-stone-300">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-6 border-b border-stone-300 py-5">
            <div className="h-5 w-20 bg-cream-200" />
            <div className="h-4 w-24 bg-cream-200/80" />
            <div className="h-5 w-28 bg-cream-200/80" />
            <div className="ml-auto h-4 w-16 bg-cream-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
