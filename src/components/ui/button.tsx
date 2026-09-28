import { forwardRef } from "react";
import Link from "next/link";
import { IconSpinner } from "@/components/icons";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "gold" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium tracking-wide transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-(--ease-silk) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:pointer-events-none disabled:opacity-55 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary: "bg-aubergine-800 text-cream-50 shadow-soft hover:bg-aubergine-700",
  secondary: "border border-stone-300 bg-cream-50 text-aubergine-800 hover:border-aubergine-300 hover:bg-cream-100",
  outline: "border border-aubergine-700/40 text-aubergine-800 hover:border-aubergine-700 hover:bg-aubergine-100/50",
  ghost: "text-aubergine-800 hover:bg-aubergine-100/60",
  gold: "bg-gold-500 text-aubergine-950 shadow-soft hover:bg-gold-300",
  danger: "border border-danger/40 text-danger hover:bg-danger hover:text-cream-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-[0.95rem]",
};

export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <IconSpinner className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
