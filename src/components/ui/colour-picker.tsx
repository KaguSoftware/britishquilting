"use client";

import { useEffect, useId, useState } from "react";
import { IconCheck } from "@/components/icons";
import { inputClasses } from "./input";
import { cn } from "@/lib/utils";

/** Curated fabric tones. Names are what a customer would call the cloth. */
export const FABRIC_TONES: { name: string; hex: string }[] = [
  { name: "White", hex: "#fbfaf7" },
  { name: "Ivory", hex: "#f4efe1" },
  { name: "Cream", hex: "#ece2c8" },
  { name: "Natural", hex: "#dccfb3" },
  { name: "Oatmeal", hex: "#cbbd9f" },
  { name: "Stone", hex: "#b1a58f" },
  { name: "Taupe", hex: "#8e7f6e" },
  { name: "Grey", hex: "#9a9a97" },
  { name: "Charcoal", hex: "#45444a" },
  { name: "Black", hex: "#1c1b1d" },
  { name: "Navy", hex: "#232d4b" },
  { name: "Duck egg", hex: "#a9c1bd" },
  { name: "Sage", hex: "#9aa88a" },
  { name: "Forest", hex: "#2f4a36" },
  { name: "Aubergine", hex: "#4a1d5c" },
  { name: "Plum", hex: "#6e3552" },
  { name: "Blush", hex: "#e3c4bb" },
  { name: "Rust", hex: "#a0502e" },
  { name: "Ochre", hex: "#c08d3c" },
  { name: "Gold", hex: "#c9a45c" },
];

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
export function normaliseHex(v: string): string | null {
  const m = v.trim().match(HEX);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

/**
 * Fabric colour picker: palette of named swatches plus a hex field with a live
 * swatch. `onChange` receives a normalised "#rrggbb" or "" when cleared; the
 * optional `onPickName` fires with the tone name when a swatch is chosen.
 * No native colour input.
 */
export function ColourPicker({
  value,
  onChange,
  onPickName,
  id,
  className,
}: {
  value: string;
  onChange: (hex: string) => void;
  onPickName?: (name: string) => void;
  id?: string;
  className?: string;
}) {
  const auto = useId();
  const fieldId = id ?? `cp-${auto}`;
  const [draft, setDraft] = useState(value);
  const [bad, setBad] = useState(false);
  // follow outside changes (swatch clicks, form reset) without fighting typing
  useEffect(() => {
    setDraft((d) => (normaliseHex(d) === normaliseHex(value) && (d.trim() !== "" || value === "") ? d : value));
    setBad(false);
  }, [value]);

  const current = normaliseHex(value);
  const live = normaliseHex(draft);

  const commit = (text: string) => {
    setDraft(text);
    if (!text.trim()) {
      setBad(false);
      return onChange("");
    }
    const h = normaliseHex(text);
    setBad(!h);
    if (h) onChange(h);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div role="radiogroup" aria-label="Fabric tones" className="grid grid-cols-5 gap-1 sm:grid-cols-10">
        {FABRIC_TONES.map((t) => {
          const on = current === t.hex;
          return (
            <button
              key={t.hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t.name}
              title={t.name}
              onClick={() => {
                onChange(t.hex);
                onPickName?.(t.name);
              }}
              className={cn(
                "group flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-sm px-0 py-1 text-[0.66rem] leading-none tracking-tight text-ink-soft transition-colors hover:bg-cream-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-500",
                on && "text-aubergine-800",
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full border border-ink/15 transition-shadow",
                  on && "shadow-[0_0_0_2px_var(--color-cream-50),0_0_0_3px_var(--color-aubergine-700)]",
                )}
                style={{ background: t.hex }}
              >
                {on && <IconCheck className={cn("size-3.5 [stroke-width:2.4]", isDark(t.hex) ? "text-cream-50" : "text-ink")} />}
              </span>
              <span className="w-full truncate text-center">{t.name}</span>
            </button>
          );
        })}
      </div>
      <div>
        <label htmlFor={fieldId} className="mb-1 block text-xs text-ink-soft">
          Or a colour code
        </label>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-11 shrink-0 rounded-sm border border-stone-300"
            style={{ background: live ?? "transparent", backgroundImage: live ? undefined : "repeating-linear-gradient(45deg, var(--color-stone-300) 0 1px, transparent 1px 6px)" }}
          />
          <input
            id={fieldId}
            value={draft}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => live && setDraft(live)}
            placeholder="#f4efe1"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={bad || undefined}
            aria-describedby={bad ? `${fieldId}-msg` : undefined}
            className={cn(inputClasses, "h-11 w-32 font-mono text-sm")}
          />
        </div>
        {bad && (
          <p id={`${fieldId}-msg`} className="mt-1.5 text-xs text-danger">
            Use a hex code like #f4efe1.
          </p>
        )}
      </div>
    </div>
  );
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}
