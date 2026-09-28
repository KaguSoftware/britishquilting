import { cn } from "@/lib/utils";

type Tone = "neutral" | "aubergine" | "gold" | "success" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-stone-500 bg-cream-200/70 text-ink-soft",
  aubergine: "border-aubergine-700 bg-aubergine-100/70 text-aubergine-800",
  gold: "border-gold-500 bg-gold-100/80 text-gold-600",
  success: "border-success bg-success/8 text-success",
  danger: "border-danger bg-danger/5 text-danger",
  info: "border-aubergine-500 bg-cream-50 text-aubergine-700",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border-l-2 py-0.5 pl-2 pr-2.5 text-[0.8rem] font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rotate-45 bg-current" />}
      {children}
    </span>
  );
}

export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "ready_for_collection"
  | "collected"
  | "delivered"
  | "cancelled"
  | "refunded";

export const orderStatusMeta: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  awaiting_payment: { label: "Awaiting payment", tone: "gold" },
  paid: { label: "Paid", tone: "aubergine" },
  processing: { label: "Being cut", tone: "aubergine" },
  shipped: { label: "Shipped", tone: "info" },
  ready_for_collection: { label: "Ready to collect", tone: "gold" },
  collected: { label: "Collected", tone: "success" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const m = orderStatusMeta[status as OrderStatus] ?? { label: status.replace(/_/g, " "), tone: "neutral" as Tone };
  return (
    <Badge tone={m.tone} dot className={className}>
      {m.label}
    </Badge>
  );
}
