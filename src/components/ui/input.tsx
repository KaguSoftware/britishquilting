import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const inputClasses =
  "block w-full rounded-sm border border-stone-300 bg-cream-50 px-3.5 text-base text-ink md:text-[0.95rem] placeholder:text-stone-500 transition-[border-color,box-shadow,background-color] duration-200 hover:border-stone-500/60 focus:border-aubergine-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-aubergine-300/35 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger/70 aria-invalid:focus:ring-danger/20";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClasses, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(inputClasses, "py-2.5 leading-relaxed", className)} {...props} />;
});

const chevron =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%234b4250' stroke-width='1.5' fill='none'/></svg>\")";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, style, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(inputClasses, "h-11 appearance-none bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat pr-9", className)}
      style={{ backgroundImage: chevron, ...style }}
      {...props}
    >
      {children}
    </select>
  );
});
