import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@/components/icons";
import { Breadcrumbs, Prose } from "@/components/shop/bits";
import { PostCover, fmtDate } from "@/components/shop/post-cover";
import { getPost } from "@/lib/data/shop";
import { siteUrl, storageUrl } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Not found" };
  const img = storageUrl(post.cover_path, "content");
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/journal/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt ?? undefined, publishedTime: post.published_at ?? undefined, images: img ? [img] : undefined },
  };
}

export default async function PostPage({ params }: PageProps<"/journal/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.published_at ?? undefined,
    image: storageUrl(post.cover_path, "content") ?? undefined,
    url: `${siteUrl}/journal/${post.slug}`,
    publisher: { "@type": "Organization", name: "British Quilting" },
  };

  return (
    <article className="pt-24 md:pt-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />
      <header className="mx-auto max-w-3xl px-4 text-center md:px-8">
        <div className="flex justify-center">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/journal", label: "Journal" }, { label: post.title }]} />
        </div>
        <time className="mt-12 block text-sm text-stone-500" dateTime={post.published_at ?? undefined}>{fmtDate(post.published_at)}</time>
        <h1 className="font-display mt-4 text-5xl leading-[1.05] text-balance md:text-6xl">{post.title}</h1>
        {post.excerpt && <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-ink-soft">{post.excerpt}</p>}
      </header>
      {post.cover_path && (
        <div className="mx-auto mt-14 max-w-5xl px-4 md:px-8">
          <PostCover post={post} sizes="(min-width: 1024px) 1024px, 100vw" priority />
        </div>
      )}
      <div className="stitch mx-auto mt-14 w-24" />
      {/* body_html is authored by staff in the admin CMS (RLS-restricted writes). */}
      <Prose className="mx-auto px-4 py-14 md:px-0 md:py-20">
        <div dangerouslySetInnerHTML={{ __html: post.body_html }} />
      </Prose>
      <div className="mx-auto max-w-2xl border-t border-stone-300 px-4 pb-24 pt-8 md:px-0">
        <Link href="/journal" className="inline-flex items-center gap-2 text-aubergine-700 hover:underline">
          <IconArrowLeft className="size-4" /> All journal entries
        </Link>
      </div>
    </article>
  );
}
