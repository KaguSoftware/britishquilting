import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { EmptyState, PageHeader, btnSecondary } from "@/components/shop/bits";
import { Reveal } from "@/components/site/reveal";
import { getPublishedPosts } from "@/lib/data/shop";
import { PostCover, fmtDate } from "@/components/shop/post-cover";

export const metadata: Metadata = {
  title: "Journal",
  description: "Notes from the cutting table: lining guides, interlining advice and stories from London's workrooms.",
  alternates: { canonical: "/journal" },
};

export default async function JournalPage() {
  const posts = await getPublishedPosts();
  const [lead, ...rest] = posts;

  return (
    <>
      <PageHeader
        eyebrow="Journal"
        title={<>Notes from the <em>cutting table.</em></>}
        lede="Guides to linings and interlinings, workroom techniques, and stories from the people who make London's curtains."
        crumbs={[{ href: "/", label: "Home" }, { label: "Journal" }]}
      />
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        {!lead ? (
          <EmptyState title="The first entry is being written" action={<Link href="/shop" className={btnSecondary}>Browse fabrics meanwhile <IconArrowRight className="size-4" /></Link>}>
            We&apos;re putting together guides on choosing linings, estimating lengths and caring for interlined curtains. Check back soon.
          </EmptyState>
        ) : (
          <>
            <Reveal>
              <Link href={`/journal/${lead.slug}`} className="group grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end md:gap-14">
                <PostCover post={lead} sizes="(min-width: 768px) 60vw, 100vw" priority />
                <div className="pb-2">
                  <time className="text-sm text-stone-500" dateTime={lead.published_at ?? undefined}>{fmtDate(lead.published_at)}</time>
                  <h2 className="font-display mt-3 text-4xl leading-tight text-balance group-hover:text-aubergine-700 md:text-5xl">{lead.title}</h2>
                  {lead.excerpt && <p className="mt-4 text-lg text-ink-soft">{lead.excerpt}</p>}
                  <span className="mt-6 inline-flex items-center gap-2 text-aubergine-700">Read <IconArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
                </div>
              </Link>
            </Reveal>
            {rest.length > 0 && (
              <ul className="mt-20 grid gap-x-8 gap-y-14 border-t border-stone-300 pt-14 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p, i) => (
                  <Reveal as="li" key={p.id} delay={(i % 3) * 0.06}>
                    <Link href={`/journal/${p.slug}`} className="group block">
                      <PostCover post={p} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                      <time className="mt-5 block text-sm text-stone-500" dateTime={p.published_at ?? undefined}>{fmtDate(p.published_at)}</time>
                      <h3 className="font-display mt-2 text-2xl leading-snug group-hover:text-aubergine-700 md:text-3xl">{p.title}</h3>
                      {p.excerpt && <p className="mt-2 line-clamp-3 text-ink-soft">{p.excerpt}</p>}
                    </Link>
                  </Reveal>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
