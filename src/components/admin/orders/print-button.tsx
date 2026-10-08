"use client";

import { useEffect } from "react";
import { IconPrint } from "@/components/icons";

export function PrintButton({ auto = true, label = "Print" }: { auto?: boolean; label?: string }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-[3px] bg-aubergine-800 px-4 py-2 text-sm text-cream-50">
      <IconPrint className="size-4" /> {label}
    </button>
  );
}
