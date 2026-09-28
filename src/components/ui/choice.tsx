import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Custom checkbox and radio controls.
 *
 * Each renders a real <input> (visually hidden, still focusable, still submits
 * with forms and works with defaultChecked / checked + onChange) inside a
 * <label>, next to a drawn 18px box. Every native input prop is forwarded.
 *
 *   <Checkbox name="marketing" label="Send me tips" description="Optional" />
 *   <Radio name="topic" value="order" label="An order" defaultChecked />
 *   <RadioCard name="rate" value="std" checked={x} onChange={...}
 *              title="Standard" description="2 to 3 days" aside="£4.95" />
 *
 * Props shared by all three: every InputHTMLAttributes prop except `type`,
 * plus `className` (applied to the outer label). Checkbox and Radio take
 * `label` and optional `description`; RadioCard takes `title`, optional
 * `description` and an optional right-hand `aside` slot.
 */

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "title">;

const ring =
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-500";

function Box({ round }: { round?: boolean }) {
  return round ? (
    <span
      aria-hidden
      className={cn(
        "relative grid size-[18px] shrink-0 place-items-center rounded-full border border-stone-500/70 bg-cream-50 transition-colors duration-200",
        "peer-checked:border-aubergine-700 peer-hover:border-aubergine-500 peer-disabled:opacity-50",
        "[&>span]:scale-0 [&>span]:transition-transform [&>span]:duration-200 peer-checked:[&>span]:scale-100 motion-reduce:[&>span]:transition-none",
        ring,
      )}
    >
      <span className="size-2 rounded-full bg-aubergine-700" />
    </span>
  ) : (
    <span
      aria-hidden
      className={cn(
        "relative grid size-[18px] shrink-0 place-items-center rounded-[3px] border border-stone-500/70 bg-cream-50 text-cream-50 transition-colors duration-200",
        "peer-checked:border-aubergine-700 peer-checked:bg-aubergine-700 peer-hover:border-aubergine-500 peer-disabled:opacity-50",
        "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
        ring,
      )}
    >
      <IconCheck className="size-3.5 [stroke-width:2.4]" />
    </span>
  );
}

function Text({ label, description }: { label: ReactNode; description?: ReactNode }) {
  return (
    <span className="text-sm leading-snug">
      <span className="text-ink">{label}</span>
      {description && <span className="mt-0.5 block text-ink-soft">{description}</span>}
    </span>
  );
}

type LabelProps = Base & { label: ReactNode; description?: ReactNode };

export const Checkbox = forwardRef<HTMLInputElement, LabelProps>(function Checkbox({ className, label, description, ...props }, ref) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-1 has-disabled:cursor-not-allowed has-disabled:opacity-60", className)}>
      <span className="relative mt-px flex">
        <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
        <Box />
      </span>
      <Text label={label} description={description} />
    </label>
  );
});

export const Radio = forwardRef<HTMLInputElement, LabelProps>(function Radio({ className, label, description, ...props }, ref) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-1 has-disabled:cursor-not-allowed has-disabled:opacity-60", className)}>
      <span className="relative mt-px flex">
        <input ref={ref} type="radio" className="peer sr-only" {...props} />
        <Box round />
      </span>
      <Text label={label} description={description} />
    </label>
  );
});

type CardProps = Base & { title?: ReactNode; description?: ReactNode; aside?: ReactNode; children?: ReactNode };

/** Large selectable row: delivery rates, payment methods, topics. */
export const RadioCard = forwardRef<HTMLInputElement, CardProps>(function RadioCard(
  { className, title, description, aside, children, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        "relative flex min-h-14 cursor-pointer items-start gap-3.5 rounded-sm border border-stone-300 bg-cream-50 px-4 py-3.5 transition-colors duration-200",
        "hover:border-stone-500/60 has-checked:border-aubergine-700 has-checked:bg-white has-checked:shadow-[inset_3px_0_0_var(--color-aubergine-700)]",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-gold-500",
        "has-disabled:cursor-not-allowed has-disabled:opacity-55",
        className,
      )}
    >
      <span className="relative mt-0.5 flex">
        <input ref={ref} type="radio" className="peer sr-only" {...props} />
        <Box round />
      </span>
      <span className="min-w-0 flex-1">
        {title != null && <span className="block text-[0.95rem] font-medium text-ink">{title}</span>}
        {description && <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{description}</span>}
        {children}
      </span>
      {aside != null && <span className="shrink-0 text-right text-[0.95rem] tabular-nums text-ink">{aside}</span>}
    </label>
  );
});
