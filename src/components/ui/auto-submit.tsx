"use client";

import { useRef, type ComponentProps } from "react";
import { Dropdown } from "./dropdown";

/**
 * A Dropdown inside a filter form that applies itself as soon as something is picked, with no "Find" button needed.
 * It must have a `name`, so the form sends it.
 */
export function AutoSubmitDropdown(props: ComponentProps<typeof Dropdown> & { name: string }) {
  const here = useRef<HTMLSpanElement>(null);
  return (
    <span ref={here} className="contents">
      <Dropdown
        {...props}
        onChange={(v) => {
          props.onChange?.(v);
          // After React has written the new value into the form's hidden input.
          setTimeout(() => here.current?.closest("form")?.requestSubmit(), 0);
        }}
      />
    </span>
  );
}
