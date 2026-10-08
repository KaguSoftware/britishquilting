export default function PrintLoading() {
  return (
    <div aria-busy="true" aria-label="Loading invoice" className="mx-auto min-h-svh max-w-[760px] animate-pulse bg-white px-8 py-10 print:hidden">
      <div className="h-10 w-2/3 bg-black/10" />
      <div className="mt-8 h-24 w-full bg-black/5" />
      <div className="mt-6 h-48 w-full bg-black/5" />
    </div>
  );
}
