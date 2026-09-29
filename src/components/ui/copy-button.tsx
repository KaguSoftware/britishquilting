"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { IconCheck, IconCopy } from "@/components/icons";
import { cn } from "@/lib/utils";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success("Copied");
          clearTimeout(t.current);
          t.current = setTimeout(() => setDone(false), 1800);
        } catch {
          toast.error("Couldn't copy, please select the text instead.");
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:border-aubergine-300 hover:text-aubergine-700",
        className,
      )}
    >
      {done ? <IconCheck className="size-3.5 text-success" /> : <IconCopy className="size-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}
