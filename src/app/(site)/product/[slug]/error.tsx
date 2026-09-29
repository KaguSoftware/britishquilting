"use client";

import { PageError } from "@/components/shop/page-error";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError retry={reset} />;
}
