import { notFound } from "next/navigation";
import { staffDb } from "@/lib/actions/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await staffDb();
  const { data: p } = await db.from("posts").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  return (
    <div>
      <PageHeader back={{ href: "/admin/journal", label: "All posts" }} title="Edit post" />
      <PostEditor
        key={p.updated_at}
        isNew={false}
        initial={{
          id: p.id,
          title: p.title ?? "",
          slug: p.slug ?? "",
          slugTouched: true,
          excerpt: p.excerpt ?? "",
          cover_path: p.cover_path ?? "",
          body_html: p.body_html ?? "",
          status: p.status,
        }}
      />
    </div>
  );
}
