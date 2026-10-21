import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One row of a back office list (customers, invoices). Every row is the same height whatever is in it: each line
 * is cut short with an ellipsis rather than wrapping, and the row's actions sit in one button plus a "⋯" menu.
 *
 *   [ref]  [title / sub]  [aside]  [badge]  [figure]  [action ⋯]
 */
export const LIST_COLS = "md:grid-cols-[92px_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,150px)_96px_auto]";

export function ListHead({ cols }: { cols: [ref: string, title: string, aside: string, badge: string, figure: string] }) {
  return (
    <div className={cn("hidden gap-4 border-b border-ink/15 px-5 py-3 text-xs text-stone-500 md:grid", LIST_COLS)}>
      <span>{cols[0]}</span>
      <span>{cols[1]}</span>
      <span>{cols[2]}</span>
      <span>{cols[3]}</span>
      <span className="text-right">{cols[4]}</span>
      <span className="w-[132px]">
        <span className="sr-only">Actions</span>
      </span>
    </div>
  );
}

export function ListRow({
  href,
  refLabel,
  title,
  sub,
  aside,
  badge,
  figure,
  action,
  menu,
}: {
  href: string;
  refLabel: ReactNode;
  title: string;
  sub?: string | null;
  aside?: ReactNode;
  badge?: ReactNode;
  figure?: ReactNode;
  action?: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-ink/10 px-4 last:border-0 hover:bg-cream-100/70 md:h-16 md:px-5",
        LIST_COLS,
      )}
    >
      <span className="hidden truncate font-display text-lg tabular-nums text-aubergine-900 md:block">{refLabel}</span>
      <Link href={href} className="min-w-0 group">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-xs tabular-nums text-stone-500 md:hidden">{refLabel}</span>
          <span className="truncate font-medium text-ink group-hover:text-aubergine-700 group-hover:underline">{title}</span>
        </span>
        <span className="block truncate text-xs text-stone-500">{sub || " "}</span>
      </Link>
      <span className="hidden truncate text-sm tabular-nums text-ink-soft md:block">{aside}</span>
      <span className="hidden min-w-0 truncate md:block">{badge}</span>
      <span className="hidden truncate text-right text-sm tabular-nums md:block">{figure}</span>
      <span className="flex w-auto items-center justify-end gap-1.5 md:w-[132px]">
        {action}
        {menu}
      </span>
    </div>
  );
}

export function ListFrame({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[3px] border border-ink/12 bg-cream-50">{children}</div>;
}
