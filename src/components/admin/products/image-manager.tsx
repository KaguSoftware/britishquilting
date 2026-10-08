"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { IconArrowLeft, IconArrowRight, IconGrip, IconImage, IconTrash, IconUpload } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { cn, storageUrl } from "@/lib/utils";

export type EditorImage = { id?: string; storage_path: string; alt: string; width: number | null; height: number | null; variant_id?: string | null };

/** Shrink big photos to at most 2400px and convert to WebP before uploading. */
export async function prepareImage(file: File, max = 2400): Promise<{ blob: Blob; ext: string; width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
    if (blob) return { blob, ext: "webp", width: w, height: h };
  } catch {
    // fall through and upload the original
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  return { blob: file, ext, width: 0, height: 0 };
}

export async function uploadToBucket(bucket: string, folder: string, file: File) {
  const { blob, ext, width, height } = await prepareImage(file);
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from(bucket).upload(path, blob, {
    contentType: ext === "webp" ? "image/webp" : file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return { path, width: width || null, height: height || null };
}

export function ImageManager({
  productId,
  images,
  onChange,
  productName,
  folder,
  hint = "Large photos are resized for you. The first photo is the one shoppers see first.",
}: {
  productId: string;
  images: EditorImage[];
  onChange: (imgs: EditorImage[]) => void;
  productName: string;
  /** storage folder, defaults to products/<productId> */
  folder?: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(images);
  latest.current = images;

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast.error("Please choose photos (JPG, PNG or WebP).");
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const up = await uploadToBucket("products", folder ?? `products/${productId}`, file);
        const next = [...latest.current, { storage_path: up.path, alt: productName, width: up.width, height: up.height }];
        latest.current = next;
        onChange(next);
      } catch (e) {
        console.error(e);
        toast.error(`Couldn't upload ${file.name}. Please try again.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  const remove = (i: number) => {
    const before = images;
    onChange(images.filter((_, n) => n !== i));
    toast("Photo removed", { description: "It will be deleted when you save.", action: { label: "Undo", onClick: () => onChange(before) } });
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn("rounded-[3px] border border-dashed p-3 transition-colors", over ? "border-aubergine-500 bg-aubergine-100/50" : "border-ink/20")}
      >
        {images.length > 0 && (
          <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img, i) => (
              <li
                key={img.storage_path}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== i) {
                    move(dragIndex, i);
                    setDragIndex(i);
                  }
                }}
                className={cn("group rounded-[3px] border bg-white", dragIndex === i ? "border-aubergine-500 opacity-60" : "border-ink/12")}
              >
                <div className="relative aspect-square overflow-hidden rounded-t-[3px] bg-cream-200">
                  <img src={storageUrl(img.storage_path) ?? ""} alt={img.alt} className="absolute inset-0 size-full object-cover" draggable={false} />
                  {i === 0 && <span className="absolute left-2 top-2 rounded-[2px] bg-aubergine-900 px-2 py-0.5 text-[0.7rem] text-cream-50">Main photo</span>}
                  <span className="absolute right-2 top-2 cursor-grab rounded-[2px] bg-white/90 p-1 text-ink-soft" title="Drag to reorder">
                    <IconGrip className="size-4" />
                  </span>
                </div>
                <div className="space-y-2 p-2">
                  <input
                    value={img.alt}
                    onChange={(e) => onChange(images.map((x, n) => (n === i ? { ...x, alt: e.target.value } : x)))}
                    placeholder="Describe the photo"
                    aria-label="Photo description for screen readers"
                    className="h-8 w-full rounded-[2px] border border-ink/12 px-2 text-xs focus:border-aubergine-500 focus:outline-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded-[2px] p-1.5 text-ink-soft hover:bg-cream-200 disabled:opacity-30" aria-label="Move earlier">
                        <IconArrowLeft className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} className="rounded-[2px] p-1.5 text-ink-soft hover:bg-cream-200 disabled:opacity-30" aria-label="Move later">
                        <IconArrowRight className="size-3.5" />
                      </button>
                    </div>
                    {i !== 0 && (
                      <button type="button" onClick={() => move(i, 0)} className="text-[0.7rem] text-aubergine-700 hover:underline">
                        Make main
                      </button>
                    )}
                    <button type="button" onClick={() => remove(i)} className="rounded-[2px] p-1.5 text-danger/80 hover:bg-danger/10" aria-label="Remove photo">
                      <IconTrash className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <li key={`up-${i}`} className="grid aspect-square animate-pulse place-items-center rounded-[3px] border border-ink/12 bg-cream-200 text-xs text-stone-500">
                Uploading...
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-[3px] px-4 py-8 text-center text-sm text-ink-soft hover:bg-cream-100"
        >
          {images.length ? <IconUpload className="size-6 text-aubergine-600" /> : <IconImage className="size-8 text-aubergine-600" />}
          <span>
            <span className="font-medium text-aubergine-800">Choose photos</span> or drag them here
          </span>
          <span className="text-xs text-stone-500">{uploading ? `Uploading ${uploading}...` : hint}</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
