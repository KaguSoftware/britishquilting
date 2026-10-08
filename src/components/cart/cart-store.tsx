"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartLine, SaleMode } from "@/lib/pricing";

/** What the cart remembers for display; prices are always re-quoted server-side. */
export type CartItem = CartLine & {
  key: string;
  name: string;
  subtitle?: string | null;
  slug: string;
  image?: string | null;
  saleMode: SaleMode;
  /** colour name shown with the line, for products sold in several colours */
  variantName?: string | null;
  /** display-only snapshot, refreshed by the server quote */
  unitPricePence: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  open: boolean;
  setOpen: (o: boolean) => void;
  add: (item: Omit<CartItem, "key">) => void;
  update: (key: string, patch: Partial<Pick<CartItem, "quantity" | "lengthM">>) => void;
  remove: (key: string) => void;
  clear: () => void;
  hydrated: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "bq-cart-v1";

const keyOf = (i: Pick<CartItem, "productId" | "variantId" | "lengthM" | "isSwatch">) =>
  `${i.productId}:${i.variantId ?? "-"}:${i.isSwatch ? "swatch" : (i.lengthM ?? "u")}`;

/** The cart line as the server prices it. */
export const toLine = ({ productId, variantId, lengthM, quantity, isSwatch }: CartItem): CartLine => ({ productId, variantId, lengthM, quantity, isSwatch });

/** Finds an item's line in a server quote. */
export const sameLine = (
  i: Pick<CartItem, "productId" | "variantId" | "lengthM" | "isSwatch">,
  l: { productId: string; variantId: string | null; lengthM?: number; isSwatch: boolean },
) => l.productId === i.productId && (l.variantId ?? null) === (i.variantId ?? null) && l.isSwatch === Boolean(i.isSwatch) && (i.isSwatch || l.lengthM === i.lengthM);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems((JSON.parse(raw) as CartItem[]).map((i) => ({ ...i, key: keyOf(i) })));
    } catch {}
    setHydrated(true);
    // keep tabs in sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try { setItems(e.newValue ? (JSON.parse(e.newValue) as CartItem[]).map((i) => ({ ...i, key: keyOf(i) })) : []); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items, hydrated]);

  const add = useCallback((item: Omit<CartItem, "key">) => {
    setItems((prev) => {
      const key = keyOf(item);
      const existing = prev.find((p) => p.key === key);
      if (existing) {
        if (item.isSwatch) return prev; // one swatch per fabric colour
        return prev.map((p) => (p.key === key ? { ...p, quantity: p.quantity + item.quantity } : p));
      }
      return [...prev, { ...item, key }];
    });
    setOpen(true);
  }, []);

  const update = useCallback((key: string, patch: Partial<Pick<CartItem, "quantity" | "lengthM">>) => {
    setItems((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const next = { ...p, ...patch };
        return { ...next, key: keyOf(next) };
      }),
    );
  }, []);

  const remove = useCallback((key: string) => setItems((prev) => prev.filter((p) => p.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: items.reduce((n, i) => n + (i.isSwatch ? 1 : i.quantity), 0), open, setOpen, add, update, remove, clear, hydrated }),
    [items, open, add, update, remove, clear, hydrated],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

export function useCart() {
  const c = use(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
