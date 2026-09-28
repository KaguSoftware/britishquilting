"use client";

import { useState } from "react";
import { addTimelineNote, saveInternalNote } from "@/lib/actions/admin/orders";
import { useAction } from "../controls";
import { Button, Card, Textarea } from "../ui";

export function OrderNotes({ orderId, initial }: { orderId: string; initial: string }) {
  const { run, pending } = useAction();
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [log, setLog] = useState("");
  return (
    <Card title="Staff notes" description="Private. Customers never see these.">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer asked for the roll to be folded, not rolled." className="min-h-28" />
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant={note !== saved ? "primary" : "secondary"} disabled={pending || note === saved} onClick={() => run(() => saveInternalNote(orderId, note), { onDone: () => setSaved(note) })}>
          {note === saved ? "Saved" : "Save note"}
        </Button>
      </div>
      <div className="mt-5 border-t border-ink/10 pt-4">
        <p className="mb-2 text-sm font-medium">Add to the history</p>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run(() => addTimelineNote(orderId, log));
            if (r.ok) setLog("");
          }}
        >
          <input value={log} onChange={(e) => setLog(e.target.value)} placeholder="e.g. Rang customer about the colour" className="h-9 flex-1 rounded-[3px] border border-ink/15 bg-white px-3 text-sm focus:border-aubergine-500 focus:outline-none" />
          <Button size="sm" type="submit" variant="secondary" disabled={pending || !log.trim()}>
            Add
          </Button>
        </form>
      </div>
    </Card>
  );
}
