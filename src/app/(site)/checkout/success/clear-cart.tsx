"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/cart-store";

/** Empties the basket once the order is confirmed (waits for localStorage hydration first). */
export function ClearCart() {
  const { hydrated, clear } = useCart();
  useEffect(() => {
    if (hydrated) clear();
  }, [hydrated, clear]);
  return null;
}
