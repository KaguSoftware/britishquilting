"use client";

import { setSubscribed } from "@/lib/actions/admin/marketing";
import { useAction } from "./controls";
import { Button } from "./ui";

export function SubscriberToggle({ id, subscribed }: { id: string; subscribed: boolean }) {
  const { run, pending } = useAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => setSubscribed(id, !subscribed), { undo: () => setSubscribed(id, subscribed) })}
    >
      {subscribed ? "Unsubscribe" : "Subscribe again"}
    </Button>
  );
}
