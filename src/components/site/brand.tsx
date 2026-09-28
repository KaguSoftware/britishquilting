import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The crown from the BQ mark, redrawn as a crisp vector. */
export function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" fill="none" aria-hidden className={className}>
      <path
        d="M4 10 L18 24 L32 4 L46 24 L60 10 L54 36 H10 Z"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link href="/" aria-label="British Quilting home" className={cn("group flex items-center gap-3", className)}>
      <Image src="/brand/logo.png" alt="" width={40} height={40} priority className="size-9 rounded-full md:size-10" />
      <span className={cn("font-display text-[1.35rem] leading-none tracking-tight", tone === "light" ? "text-cream-50" : "text-aubergine-800")}>
        British Quilting
      </span>
    </Link>
  );
}
