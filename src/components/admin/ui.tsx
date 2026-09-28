import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { IconArrowLeft } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Tone } from "./format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

export function btn(variant: Variant = "primary", size: Size = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-all duration-200 ease-(--ease-silk) select-none",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    size === "sm" && "h-10 px-3.5 text-sm lg:h-8 lg:px-3 lg:text-[0.8rem]",
    size === "md" && "h-12 px-5 text-[0.95rem] lg:h-10 lg:px-4 lg:text-sm",
    size === "lg" && "h-14 px-6 text-base lg:h-12 lg:text-[0.95rem]",
    variant === "primary" && "bg-aubergine-800 text-cream-50 hover:bg-aubergine-700",
    variant === "gold" && "bg-gold-500 text-aubergine-950 hover:bg-gold-300",
    variant === "secondary" && "border border-stone-300 bg-cream-50 text-ink hover:border-aubergine-300 hover:bg-white",
    variant === "ghost" && "text-ink-soft hover:bg-cream-200/70 hover:text-ink",
    variant === "danger" && "border border-danger/25 bg-cream-50 text-danger hover:bg-danger hover:text-cream-50",
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={cn(btn(variant, size), className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  target,
}: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode; target?: string }) {
  return (
    <Link href={href} target={target} className={cn(btn(variant, size), className)}>
      {children}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-ink/15 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-aubergine-700">
            <IconArrowLeft className="size-4" /> {back.label}
          </Link>
        )}
        {eyebrow && <p className="mb-1.5 font-display text-[1.05rem] italic text-gold-600">{eyebrow}</p>}
        <h1 className="font-display text-[2.1rem] leading-[1.05] text-aubergine-900 md:text-[2.6rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[0.95rem] text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-[3px] border border-ink/12 bg-cream-50", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <div>
            {title && <h2 className="font-display text-[1.35rem] leading-tight text-aubergine-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const toneClass: Record<Tone, string> = {
  neutral: "bg-cream-200 text-ink-soft",
  gold: "bg-gold-100 text-gold-600 ring-1 ring-gold-300/60",
  aubergine: "bg-aubergine-100 text-aubergine-700",
  green: "bg-success/10 text-success",
  red: "bg-danger/10 text-danger",
  blue: "bg-[#e3ecf5] text-[#2f5577]",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-[2px] px-2 py-0.5 text-xs font-medium before:size-1.5 before:rounded-full before:bg-current before:opacity-70", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border-y border-dashed border-ink/15 px-6 py-14 text-center">
      {icon && <div className="mb-4 text-gold-600 [&_svg]:size-9">{icon}</div>}
      <p className="font-display text-2xl text-aubergine-900">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-sm border border-stone-300 bg-white px-3 py-3 text-base text-ink lg:py-2.5 lg:text-[0.95rem] placeholder:text-stone-500/70 transition-colors focus:border-aubergine-500 focus:outline-none focus:ring-2 focus:ring-aubergine-100 disabled:bg-cream-100";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-24 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "appearance-auto pr-8", className)} {...props} />;
}

/** Money input with a £ prefix. Value is pounds as text. */
export function MoneyInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-stone-500">£</span>
      <input inputMode="decimal" className={cn(inputClass, "pl-7 tabular-nums", className)} {...props} />
    </div>
  );
}

/** Number input with a unit suffix, e.g. "m" or "cm". */
export function UnitInput({ unit, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  return (
    <div className="relative">
      <input inputMode="decimal" className={cn(inputClass, "pr-12 tabular-nums", className)} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-stone-500">{unit}</span>
    </div>
  );
}
