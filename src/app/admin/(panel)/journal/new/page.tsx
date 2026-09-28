import { requireStaff } from "@/lib/actions/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { PostEditor } from "@/components/admin/post-editor";

export const metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireStaff();
  return (
    <div>
      <PageHeader back={{ href: "/admin/journal", label: "All posts" }} title="Write a post" description="It stays a draft until you choose Published." />
      <PostEditor
        isNew
        initial={{ id: crypto.randomUUID(), title: "", slug: "", slugTouched: false, excerpt: "", cover_path: "", body_html: "", status: "draft" }}
      />
    </div>
  );
}
