"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { IconExternal, IconImage, IconTrash, IconUpload } from "@/components/icons";
import { deletePost, savePost } from "@/lib/actions/admin/journal";
import { cn, slugify, storageUrl } from "@/lib/utils";
import { SaveBar, Segmented, useAction, useConfirm, useUnsavedGuard } from "./controls";
import { Button, Field, Textarea } from "./ui";
import { uploadToBucket } from "./products/image-manager";

export type PostForm = {
  id: string;
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  cover_path: string;
  body_html: string;
  status: "draft" | "published";
};

export function PostEditor({ initial, isNew }: { initial: PostForm; isNew: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { run, pending } = useAction();
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [coverUploading, setCoverUploading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const changed = JSON.stringify(form) !== baseline;
  useUnsavedGuard(changed);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = initial.body_html || "<p></p>";
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) =>
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "title" && !f.slugTouched) next.slug = slugify(String(v));
      return next;
    });

  const syncBody = () => setForm((f) => ({ ...f, body_html: bodyRef.current?.innerHTML ?? "" }));

  const exec = (cmd: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
    syncBody();
  };

  const save = async (status = form.status) => {
    const next = { ...form, status, body_html: bodyRef.current?.innerHTML ?? form.body_html };
    setForm(next);
    const r = await run(() =>
      savePost({ id: next.id, isNew, title: next.title, slug: next.slug, excerpt: next.excerpt || null, cover_path: next.cover_path || null, body_html: next.body_html, status }),
    );
    if (r.ok) {
      setBaseline(JSON.stringify(next));
      if (isNew) router.replace(`/admin/journal/${next.id}`);
    }
  };

  const cover = storageUrl(form.cover_path, "content");

  return (
    <div className="space-y-6">
      <div className="rounded-[3px] border border-ink/12 bg-cream-50 p-5">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Title of your post"
          aria-label="Title"
          className="w-full bg-transparent font-display text-[2rem] leading-tight text-aubergine-900 placeholder:text-stone-300 focus:outline-none md:text-[2.6rem]"
        />
        <Field label="Short summary" htmlFor="excerpt" hint="One or two sentences shown on the journal page and in Google." className="mt-4">
          <Textarea id="excerpt" value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} className="min-h-20" />
        </Field>
      </div>

      <div className="rounded-[3px] border border-ink/12 bg-cream-50 p-5">
        <p className="mb-2 text-sm font-medium">Cover photo</p>
        {cover ? (
          <div className="relative overflow-hidden rounded-[3px] border border-ink/10">
            <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => coverInput.current?.click()}>
                Change
              </Button>
              <Button size="sm" variant="secondary" onClick={() => set("cover_path", "")} aria-label="Remove cover">
                <IconTrash className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => coverInput.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-[3px] border border-dashed border-ink/25 text-sm text-ink-soft hover:bg-cream-100">
            <IconUpload className="size-6 text-aubergine-600" />
            {coverUploading ? "Uploading..." : "Choose a cover photo"}
          </button>
        )}
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setCoverUploading(true);
            try {
              const up = await uploadToBucket("content", `posts/${form.id}`, f);
              set("cover_path", up.path);
            } catch {
              toast.error("Couldn't upload the photo. Please try again.");
            } finally {
              setCoverUploading(false);
            }
          }}
        />
      </div>

      <div className="rounded-[3px] border border-ink/12 bg-cream-50">
        <div className="sticky top-[4.5rem] z-10 flex flex-wrap gap-1 border-b border-ink/10 bg-cream-50 p-2 lg:top-0">
          <Tool onClick={() => exec("formatBlock", "<h2>")} label="Heading">H</Tool>
          <Tool onClick={() => exec("formatBlock", "<h3>")} label="Small heading">
            <span className="text-xs">H</span>
          </Tool>
          <Tool onClick={() => exec("formatBlock", "<p>")} label="Normal text">
            ¶
          </Tool>
          <span className="mx-1 w-px bg-ink/10" />
          <Tool onClick={() => exec("bold")} label="Bold">
            <b>B</b>
          </Tool>
          <Tool onClick={() => exec("italic")} label="Italic">
            <i className="font-display">I</i>
          </Tool>
          <span className="mx-1 w-px bg-ink/10" />
          <Tool onClick={() => exec("insertUnorderedList")} label="Bulleted list">
            &bull;
          </Tool>
          <Tool onClick={() => exec("insertOrderedList")} label="Numbered list">
            1.
          </Tool>
          <Tool onClick={() => exec("formatBlock", "<blockquote>")} label="Quote">
            &ldquo;
          </Tool>
          <Tool
            onClick={() => {
              const url = window.prompt("Paste the web address for the link");
              if (url) exec("createLink", url.startsWith("http") || url.startsWith("/") ? url : `https://${url}`);
            }}
            label="Link"
          >
            <span className="underline">a</span>
          </Tool>
          <Tool onClick={() => imgInput.current?.click()} label="Add a photo">
            <IconImage className="size-4" />
          </Tool>
          <Tool onClick={() => exec("removeFormat")} label="Clear formatting">
            <span className="text-xs line-through">T</span>
          </Tool>
        </div>
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncBody}
          onBlur={syncBody}
          className="prose-admin min-h-[50svh] px-5 py-5 text-[1.05rem] leading-relaxed focus:outline-none"
          aria-label="Post body"
          role="textbox"
          aria-multiline="true"
        />
        <input
          ref={imgInput}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const t = toast.loading("Uploading photo...");
            try {
              const up = await uploadToBucket("content", `posts/${form.id}`, f);
              exec("insertImage", storageUrl(up.path, "content") ?? "");
              toast.success("Photo added", { id: t });
            } catch {
              toast.error("Couldn't upload the photo.", { id: t });
            }
          }}
        />
      </div>

      <div className="grid gap-4 rounded-[3px] border border-ink/12 bg-cream-50 p-5 sm:grid-cols-2">
        <Field label="Who can see it?">
          <Segmented
            value={form.status}
            onChange={(v) => set("status", v)}
            className="w-full"
            options={[
              { value: "draft", label: "Draft (only staff)" },
              { value: "published", label: "Published" },
            ]}
          />
        </Field>
        <Field label="Web address" htmlFor="pslug">
          <div className="flex items-center rounded-[3px] border border-stone-300 bg-white">
            <span className="pl-3 text-sm text-stone-500">/journal/</span>
            <input
              id="pslug"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) || e.target.value, slugTouched: true }))}
              className="h-12 flex-1 bg-transparent pr-3 focus:outline-none lg:h-11"
            />
          </div>
        </Field>
      </div>

      {!isNew && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-6">
          {form.status === "published" ? (
            <a href={`/journal/${form.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-aubergine-700 underline">
              Open the live post <IconExternal className="size-3.5" />
            </a>
          ) : (
            <span />
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (await confirm({ title: "Delete this post?", description: "It will be removed from the journal for good.", confirmLabel: "Delete post", danger: true })) {
                const r = await run(() => deletePost(form.id));
                if (r.ok) {
                  setBaseline(JSON.stringify(form));
                  router.push("/admin/journal");
                }
              }
            }}
          >
            <IconTrash className="size-4" /> Delete post
          </Button>
        </div>
      )}

      <SaveBar
        dirty={changed || isNew}
        saving={pending}
        onSave={() => save()}
        saveLabel={form.status === "published" ? (initial.status === "published" ? "Save changes" : "Publish") : "Save draft"}
      />

      <style>{`
        .prose-admin h2 { font-family: var(--font-display); font-size: 1.7rem; line-height: 1.2; margin: 1.2em 0 0.4em; color: var(--color-aubergine-900); }
        .prose-admin h3 { font-family: var(--font-display); font-size: 1.3rem; margin: 1em 0 0.3em; color: var(--color-aubergine-800); }
        .prose-admin p { margin: 0 0 0.9em; }
        .prose-admin ul { list-style: disc; padding-left: 1.4em; margin: 0 0 0.9em; }
        .prose-admin ol { list-style: decimal; padding-left: 1.4em; margin: 0 0 0.9em; }
        .prose-admin blockquote { border-left: 2px solid var(--color-gold-500); padding-left: 1em; font-style: italic; color: var(--color-ink-soft); margin: 1em 0; }
        .prose-admin a { color: var(--color-aubergine-700); text-decoration: underline; }
        .prose-admin img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 3px; }
        .prose-admin:empty::before { content: "Start writing..."; color: var(--color-stone-300); }
      `}</style>
    </div>
  );
}

function Tool({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn("grid min-h-11 min-w-11 place-items-center rounded-[3px] px-2 font-display text-lg text-ink-soft hover:bg-cream-200 hover:text-ink lg:min-h-9 lg:min-w-9")}
    >
      {children}
    </button>
  );
}
