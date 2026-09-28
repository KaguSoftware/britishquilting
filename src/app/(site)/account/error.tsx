"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="border-t-2 border-aubergine-900 pt-10">
      <p className="font-display text-3xl text-aubergine-900">We couldn&apos;t load this page</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
        It&apos;s likely a brief connection problem on our side. Please try again; if it persists, <Link href="/contact" className="text-aubergine-700 underline underline-offset-4">let us know</Link>.
      </p>
      <Button className="mt-7" onClick={reset}>Try again</Button>
    </div>
  );
}
