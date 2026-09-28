"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { audit, staffDb } from "./guard";
import { fail, ok, type ActionResult } from "./types";

const ALLOWED = new Set(["p", "h2", "h3", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "blockquote", "br", "img", "figure", "figcaption", "hr"]);

function attr(attrs: string, name: string) {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const safeUrl = (u: string | null) => (u && /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(u.trim()) ? u.trim() : null);

/** Small allow-list sanitiser for the journal editor's HTML. */
function sanitize(html: string) {
  return html
    .replace(/<(script|style|iframe|object|embed|template|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, rawTag: string, attrs: string) => {
      let tag = rawTag.toLowerCase();
      if (tag === "div") tag = "p";
      if (tag === "h1") tag = "h2";
      if (tag === "h4" || tag === "h5" || tag === "h6") tag = "h3";
      if (!ALLOWED.has(tag)) return "";
      if (full.startsWith("</")) return `</${tag}>`;
      if (tag === "a") {
        const href = safeUrl(attr(attrs, "href"));
        if (!href) return "<a>";
        const external = /^https?:/i.test(href);
        return `<a href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>`;
      }
      if (tag === "img") {
        const src = safeUrl(attr(attrs, "src"));
        if (!src) return "";
        return `<img src="${esc(src)}" alt="${esc(attr(attrs, "alt") ?? "")}" loading="lazy">`;
      }
      return tag === "br" || tag === "hr" ? `<${tag}>` : `<${tag}>`;
    })
    .replace(/<p>\s*(<br>)?\s*<\/p>/g, "")
    .trim();
}

const schema = z.object({
  id: z.uuid(),
  isNew: z.boolean(),
  title: z.string().trim().min(2, "Please give the post a title").max(200),
  slug: z.string().trim().max(200).optional(),
  excerpt: z.string().trim().max(400).nullable(),
  cover_path: z.string().trim().max(400).nullable(),
  body_html: z.string().max(200_000),
  status: z.enum(["draft", "published"]),
});

export type PostInput = z.input<typeof schema>;

export async function savePost(input: PostInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the post.");
  const { db, viewer } = await staffDb();
  const { id, isNew, ...p } = parsed.data;
  const slug = slugify(p.slug || p.title);
  const { data: clash } = await db.from("posts").select("id").eq("slug", slug).neq("id", id).maybeSingle();
  if (clash) return fail(`Another post already uses the web address "${slug}".`);

  const { data: prev } = isNew ? { data: null } : await db.from("posts").select("status, published_at").eq("id", id).maybeSingle();
  const row = {
    title: p.title,
    slug,
    excerpt: p.excerpt || null,
    cover_path: p.cover_path || null,
    body_html: sanitize(p.body_html),
    status: p.status,
    published_at: p.status === "published" ? prev?.published_at ?? new Date().toISOString() : prev?.published_at ?? null,
  };
  const res = isNew ? await db.from("posts").insert({ id, ...row, author_id: viewer.id }) : await db.from("posts").update(row).eq("id", id);
  if (res.error) return fail("Couldn't save the post. Please try again.");
  const justPublished = p.status === "published" && prev?.status !== "published";
  await audit(db, viewer.id, justPublished ? "post.publish" : isNew ? "post.create" : "post.update", "post", id, { name: p.title });
  revalidatePath("/admin/journal");
  revalidatePath("/", "layout");
  return ok({ id, slug }, justPublished ? "Published. It's live on the journal." : p.status === "published" ? "Saved and live." : "Draft saved.");
}

export async function deletePost(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return fail("Invalid post.");
  const { db, viewer } = await staffDb();
  const { data: post } = await db.from("posts").select("title, cover_path").eq("id", id).maybeSingle();
  const { error } = await db.from("posts").delete().eq("id", id);
  if (error) return fail("Couldn't delete the post.");
  if (post?.cover_path && !post.cover_path.startsWith("http")) await db.storage.from("content").remove([post.cover_path]);
  await audit(db, viewer.id, "post.delete", "post", id, { name: post?.title });
  revalidatePath("/admin/journal");
  revalidatePath("/", "layout");
  return ok(undefined, "Post deleted.");
}
