"use client";

import { createContext, useContext, useTransition, type TransitionStartFunction } from "react";
import { cn } from "@/lib/utils";

const Ctx = createContext<{ pending: boolean; start: TransitionStartFunction } | null>(null);

/** Shares one transition between the filter controls and the results grid, so both can react to it. */
export function FilterTransitionProvider({ children }: { children: React.ReactNode }) {
  const [pending, start] = useTransition();
  return <Ctx.Provider value={{ pending, start }}>{children}</Ctx.Provider>;
}

export function useFilterTransition() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFilterTransition must be used within a FilterTransitionProvider");
  return ctx;
}

/** Dims the results while a filter/sort change is in flight, instead of leaving them frozen with no feedback. */
export function FilterPendingOverlay({ children }: { children: React.ReactNode }) {
  const { pending } = useFilterTransition();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-40")}>
      {children}
    </div>
  );
}
