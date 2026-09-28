"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IconChevronDown, IconPencil, IconPlus, IconSwatch, IconTrash } from "@/components/icons";
import { deleteCategory, reorderCategories, restoreCategory, saveCategory } from "@/lib/actions/admin/categories";
import { slugify } from "@/lib/utils";
import { Modal, Switch, useAction, useConfirm } from "./controls";
import { Button, EmptyState, Field, Input, Textarea } from "./ui";

type Cat = { id: string; name: string; slug: string; description: string | null; image_url: string | null; is_visible: boolean; products: number };

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const { run, pending } = useAction();
  const confirm = useConfirm();
  const [list, setList] = useState(categories);
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  useEffect(() => setList(categories), [categories]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    const before = list.map((c) => c.id);
    setList(next);
    run(() => reorderCategories(next.map((c) => c.id)), { undo: () => reorderCategories(before) });
  };

  const remove = async (c: Cat) => {
    const yes = await confirm({
      title: `Delete "${c.name}"?`,
      description: c.products
        ? `Its ${c.products} product${c.products === 1 ? "" : "s"} will stay in the shop but won't be in a category.`
        : "It has no products in it.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!yes) return;
    const r = await run(() => deleteCategory(c.id), { success: "" });
    if (r.ok && r.data) {
      const d = r.data;
      toast.success(`"${c.name}" deleted`, {
        duration: 8000,
        action: { label: "Undo", onClick: () => run(() => restoreCategory(d.restore, d.productIds), { success: "Category restored" }) },
      });
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ name: "", description: "", is_visible: true })}>
          <IconPlus className="size-4" /> Add a category
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<IconSwatch />} title="No categories yet" description="Categories help customers find what they need, e.g. Linings, Interlinings, Workroom paper." />
      ) : (
        <ol className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">
          {list.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-ink/10 px-4 py-3 last:border-0">
              <span className="w-6 text-right font-display text-lg tabular-nums text-stone-500">{i + 1}</span>
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0 || pending} className="rounded-[2px] p-0.5 text-stone-500 hover:bg-cream-200 disabled:opacity-25" aria-label="Move up">
                  <IconChevronDown className="size-4 rotate-180" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === list.length - 1 || pending} className="rounded-[2px] p-0.5 text-stone-500 hover:bg-cream-200 disabled:opacity-25" aria-label="Move down">
                  <IconChevronDown className="size-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-stone-500">
                  <Link href={`/admin/products?category=${c.id}`} className="hover:underline">
                    {c.products} product{c.products === 1 ? "" : "s"}
                  </Link>
                  {!c.is_visible && " · Hidden from the shop"}
                </p>
              </div>
              <Switch
                size="sm"
                checked={c.is_visible}
                label="Show on the shop"
                onChange={(v) => {
                  setList((l) => l.map((x) => (x.id === c.id ? { ...x, is_visible: v } : x)));
                  run(() => saveCategory({ ...c, is_visible: v }), {
                    success: v ? "Showing on the shop" : "Hidden from the shop",
                    undo: () => saveCategory({ ...c, is_visible: !v }),
                  });
                }}
              />
              <button onClick={() => setEditing(c)} className="rounded-[2px] p-2 text-ink-soft hover:bg-cream-200" aria-label={`Edit ${c.name}`}>
                <IconPencil className="size-4" />
              </button>
              <button onClick={() => remove(c)} className="rounded-[2px] p-2 text-danger/70 hover:bg-danger/10" aria-label={`Delete ${c.name}`}>
                <IconTrash className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit category" : "New category"}>
        {editing && <CategoryForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function CategoryForm({ initial, onDone }: { initial: Partial<Cat>; onDone: () => void }) {
  const { run, pending } = useAction();
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [visible, setVisible] = useState(initial.is_visible ?? true);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run(() =>
          saveCategory({ id: initial.id, name, description, slug: slug || slugify(name), is_visible: visible, image_url: initial.image_url }),
        );
        if (r.ok) onDone();
      }}
    >
      <Field label="Name" htmlFor="cname">
        <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Interlinings" />
      </Field>
      <Field label="Short description (optional)" htmlFor="cdesc" hint="Shown at the top of the category page.">
        <Textarea id="cdesc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" />
      </Field>
      <Field label="Web address" htmlFor="cslug" hint="Leave as it is unless you need to change it.">
        <Input id="cslug" value={slug || slugify(name)} onChange={(e) => setSlug(slugify(e.target.value))} className="font-mono text-sm" />
      </Field>
      <label className="flex items-center justify-between text-sm">
        Show on the shop <Switch checked={visible} onChange={setVisible} />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || name.trim().length < 2}>
          {initial.id ? "Save" : "Add category"}
        </Button>
      </div>
    </form>
  );
}
