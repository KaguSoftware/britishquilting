import Link from "next/link";
import { IconPencil, IconPlus } from "@/components/icons";
import { staffDb } from "@/lib/actions/admin/guard";
import { storageUrl } from "@/lib/utils";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/components/admin/format";

export const metadata = { title: "Journal" };

export default async function JournalPage() {
  const { db } = await staffDb();
  const { data } = await db.from("posts").select("id, title, excerpt, cover_path, status, published_at, updated_at").order("updated_at", { ascending: false });
  const posts = data ?? [];
  return (
    <div>
      <PageHeader
        title="Journal"
        description="Stories, guides and news from the workroom."
        actions={
          <ButtonLink href="/admin/journal/new">
            <IconPlus className="size-4" /> Write a post
          </ButtonLink>
        }
      />
      {posts.length === 0 ? (
        <EmptyState icon={<IconPencil />} title="No posts yet" description="Share a making guide, a new arrival or a behind the scenes story." action={<ButtonLink href="/admin/journal/new">Write your first post</ButtonLink>} />
      ) : (
        <ul className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          {posts.map((p) => {
            const img = storageUrl(p.cover_path, "content");
            return (
              <li key={p.id} className="border-b border-ink/10 last:border-0">
                <Link href={`/admin/journal/${p.id}`} className="flex min-h-20 items-center gap-4 px-4 py-3 hover:bg-cream-100 md:px-5">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-[2px] bg-cream-200">{img && <img src={img} alt="" className="absolute inset-0 size-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl text-aubergine-900">{p.title}</p>
                    <p className="line-clamp-1 text-sm text-ink-soft">{p.excerpt}</p>
                    <p className="text-xs text-stone-500">{p.status === "published" ? `Published ${formatDate(p.published_at)}` : `Last edited ${formatDate(p.updated_at)}`}</p>
                  </div>
                  <Badge tone={p.status === "published" ? "green" : "neutral"}>{p.status === "published" ? "Live" : "Draft"}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
