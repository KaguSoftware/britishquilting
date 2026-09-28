import { cn } from "@/lib/utils";

/** Numbered editorial section heading used across the account area. */
export function SectionHead({
  n,
  title,
  children,
  aside,
  className,
}: {
  n?: string;
  title: string;
  children?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex items-baseline gap-4">
        {n && <span className="font-display text-lg tabular-nums text-gold-600">{n}</span>}
        <div>
          <h2 className="font-display text-3xl text-aubergine-900 md:text-[2.1rem]">{title}</h2>
          {children && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">{children}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-stone-300 bg-cream-50/60 px-6 py-14 text-center md:py-20">
      {icon && <div className="mx-auto mb-5 flex size-12 items-center justify-center text-gold-600">{icon}</div>}
      <p className="font-display text-2xl text-aubergine-900 md:text-3xl">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">{children}</p>}
      {action && <div className="mt-7 flex justify-center">{action}</div>}
    </div>
  );
}
