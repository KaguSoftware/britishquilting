import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/account/account-nav";
import { getViewer } from "@/lib/data/catalog";

export const metadata: Metadata = { title: { default: "Your account", template: "%s · Your account" }, robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) {
    // The proxy already redirects with the exact path; this is the authoritative fallback.
    redirect("/login?next=%2Faccount");
  }

  const first = viewer.fullName?.split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-8 md:pb-32 md:pt-16">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-300 pb-8">
        <div>
          <p className="font-display text-lg italic text-gold-600">{first ? `Hello, ${first}` : "Welcome back"}</p>
          <h1 className="font-display mt-1 text-4xl text-aubergine-900 md:text-5xl">Your account</h1>
        </div>
        <p className="text-sm text-ink-soft">
          {viewer.email}
          {viewer.isTrade && <span className="ml-3 border-l border-stone-300 pl-3 text-gold-600">Trade account</span>}
        </p>
      </header>
      <div className="mt-6 grid gap-8 md:mt-12 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20">
        <aside className="md:sticky md:top-28 md:self-start">
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
