"use client";

import { useState } from "react";
import { IconPencil, IconPlus } from "@/components/icons";
import type { ActionResult } from "@/lib/actions/admin/types";
import { Button, Textarea } from "../ui";
import { useAction } from "../controls";

/**
 * A staff-only note, edited in place: shows the note (or "Add a note"), and turns into a text box with
 * Save and Cancel when clicked.
 */
export function NoteEditor({ note, onSave, max = 1000, className }: { note: string | null; onSave: (note: string) => Promise<ActionResult>; max?: number; className?: string }) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [saved, setSaved] = useState(note ?? "");

  if (!editing) {
    return (
      <div className={className}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-ink">Staff note</p>
          <button
            type="button"
            onClick={() => {
              setValue(saved);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 text-sm text-aubergine-700 underline-offset-2 hover:underline"
          >
            {saved ? <IconPencil className="size-3.5" /> : <IconPlus className="size-3.5" />}
            {saved ? "Edit" : "Add a note"}
          </button>
        </div>
        {saved ? (
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{saved}</p>
        ) : (
          <p className="mt-1.5 text-sm italic text-stone-500">No note yet. Only staff see notes.</p>
        )}
      </div>
    );
  }

  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() => onSave(value));
        if (res.ok) {
          setSaved(value.trim());
          setEditing(false);
        }
      }}
    >
      <label htmlFor="staff-note" className="text-sm font-medium text-ink">
        Staff note
      </label>
      <Textarea
        id="staff-note"
        value={value}
        maxLength={max}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        rows={4}
        autoFocus
        className="mt-1.5"
        placeholder="e.g. Prefers delivery after 10am. Pays by bank transfer."
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-stone-500">
          {value.length} of {max}
        </span>
        <span className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Save note"}
          </Button>
        </span>
      </div>
    </form>
  );
}
