import { IconWarning } from "@/components/icons";
import { cn } from "@/lib/utils";

export function Label({ className, children, optional, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { optional?: boolean }) {
  return (
    <label className={cn("mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-ink", className)} {...props}>
      <span>{children}</span>
      {optional && <span className="text-xs font-normal text-stone-500">Optional</span>}
    </label>
  );
}

/**
 * Label, control and hint or error. Give the control id={id}, aria-invalid,
 * and aria-describedby={`${id}-msg`} when there is an error or hint.
 */
export function Field({
  id,
  label,
  error,
  hint,
  optional,
  className,
  labelAside,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string | string[] | null;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  labelAside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} optional={optional} className="flex-1">
          {label}
        </Label>
        {labelAside}
      </div>
      {children}
      {msg ? (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[0.8rem] text-danger">
          <IconWarning className="mt-0.5 size-3.5 shrink-0" /> {msg}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[0.8rem] text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Inline banner for form-level messages. */
export function FormMessage({ tone = "error", children, className }: { tone?: "error" | "success" | "info"; children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-sm border px-4 py-3 text-sm leading-relaxed",
        tone === "error" && "border-danger/25 bg-danger/5 text-danger",
        tone === "success" && "border-success/25 bg-success/5 text-success",
        tone === "info" && "border-gold-500/40 bg-gold-100/60 text-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Custom checkbox (see ./choice). Same props as before: label, description, and any input prop. */
export { Checkbox } from "./choice";
