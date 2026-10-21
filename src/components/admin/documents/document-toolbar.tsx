"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IconDownload, IconPrint, IconSpinner } from "@/components/icons";
import type { DocAction } from "@/lib/doc-action";
import { downloadPdf } from "@/lib/pdf";
import { btn } from "../ui";

/**
 * Print and Download PDF for a printable document. `target` is the id of the element that becomes the PDF.
 * `auto` runs one of them as soon as the page opens, for the Print and PDF buttons on the lists.
 */
export function DocumentToolbar({ target, filename, auto }: { target: string; filename: string; auto?: DocAction | null }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    const el = document.getElementById(target);
    if (!el || busy) return;
    setBusy(true);
    try {
      await downloadPdf(el, filename);
    } catch {
      toast.error("Couldn't make the PDF. Try Print and choose “Save as PDF” instead.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!auto) return;
    // A moment for the fonts to settle first.
    const t = setTimeout(() => (auto === "print" ? window.print() : download()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div className="mx-auto flex max-w-[794px] flex-wrap items-center justify-between gap-3 px-4 py-5 print:hidden">
      <p className="text-sm text-stone-500">Print it, or download it as a PDF to email.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => window.print()} className={btn("secondary", "sm")}>
          <IconPrint className="size-4" /> Print
        </button>
        <button type="button" onClick={download} disabled={busy} className={btn("primary", "sm")}>
          {busy ? <IconSpinner className="size-4" /> : <IconDownload className="size-4" />} {busy ? "Making PDF" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
