"use client";

import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { Dropdown, type DropdownOption } from "./dropdown";

/** onChange payload shaped like a change event so `e.target.value` callers keep working */
export type SelectChange = { target: { value: string; name?: string }; currentTarget: { value: string; name?: string } };

export type SelectProps = {
  children?: ReactNode;
  name?: string;
  id?: string;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  onChange?: (e: SelectChange) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  sheetTitle?: string;
  size?: "md" | "sm";
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

type OptionEl = ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;

function text(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(text).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return text(n.props.children);
  return "";
}

function collect(children: ReactNode, out: OptionEl[] = []) {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) collect((c.props as { children?: ReactNode }).children, out);
    else if (c.type === "option") out.push(c as OptionEl);
    else if (c.type === "optgroup") collect((c.props as { children?: ReactNode }).children, out);
  });
  return out;
}

/**
 * Drop-in replacement for a native select element: reads <option> children
 * (value, label, disabled) and renders the bespoke Dropdown. A disabled
 * option with an empty value becomes the placeholder.
 */
export function Select({ children, value, defaultValue, onChange, placeholder, name, ...rest }: SelectProps) {
  let ph = placeholder;
  const options: DropdownOption[] = [];
  for (const o of collect(children)) {
    const label = o.props.children;
    const v = o.props.value != null ? String(o.props.value) : text(label);
    if (v === "" && o.props.disabled) {
      ph ??= text(label);
      continue;
    }
    options.push({ value: v, label, text: text(label), disabled: o.props.disabled });
  }
  const str = (x: SelectProps["value"]) => (x === undefined ? undefined : String(x));
  return (
    <Dropdown
      {...rest}
      aria-invalid={rest["aria-invalid"] === true || rest["aria-invalid"] === "true" || undefined}
      name={name}
      options={options}
      placeholder={ph}
      value={str(value)}
      defaultValue={str(defaultValue) ?? (ph ? null : options[0]?.value ?? null)}
      onChange={(v) => onChange?.({ target: { value: v, name }, currentTarget: { value: v, name } })}
    />
  );
}
