import Image from "next/image";
import type { Post } from "@/lib/data/shop";
import { storageUrl } from "@/lib/utils";

export const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

export function PostCover({ post, sizes, priority }: { post: Post; sizes: string; priority?: boolean }) {
  const src = storageUrl(post.cover_path, "content");
  return (
    <div className="relative aspect-[3/2] overflow-hidden bg-cream-200">
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-cover transition-transform duration-[1.2s] ease-(--ease-silk) group-hover:scale-[1.03]" />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-aubergine-800 transition-transform duration-[1.2s] ease-(--ease-silk) group-hover:scale-[1.03]" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgb(255 255 255 / .03) 0 2px, transparent 2px 6px), radial-gradient(80% 70% at 80% 10%, rgb(201 164 92 / .25), transparent 60%)" }}>
          <span className="font-display absolute bottom-5 left-6 text-2xl italic text-gold-300/80">Journal</span>
        </div>
      )}
    </div>
  );
}

