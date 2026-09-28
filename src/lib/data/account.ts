import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";

/** Verified viewer for account pages. Every page calls this, not just the layout. */
export const requireViewer = cache(async (next = "/account") => {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
});

export type OrderSummary = {
  id: string;
  number: number;
  status: string;
  total_pence: number;
  created_at: string;
  fulfilment: "delivery" | "collection";
  item_count: number;
};

export async function getMyOrders(userId: string, limit?: number): Promise<OrderSummary[]> {
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id, number, status, total_pence, created_at, fulfilment, order_items(quantity)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error("Could not load orders");
  return (data ?? []).map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    total_pence: o.total_pence,
    created_at: o.created_at,
    fulfilment: o.fulfilment,
    item_count: (o.order_items ?? []).length,
  }));
}

export type Address = {
  id: string;
  label: string | null;
  full_name: string;
  line1: string;
  line2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  country: string;
  phone: string | null;
  is_default: boolean;
};

export async function getMyAddresses(userId: string): Promise<Address[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("id, label, full_name, line1, line2, city, county, postcode, country, phone, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load addresses");
  return data ?? [];
}

export type TradeInfo = {
  status: "none" | "pending" | "approved" | "rejected";
  application: { company_name: string; created_at: string; status: string; reviewed_at: string | null } | null;
};

export async function getTradeInfo(userId: string): Promise<TradeInfo> {
  const supabase = await createClient();
  const [{ data: profile }, { data: apps }] = await Promise.all([
    supabase.from("profiles").select("trade_status").eq("id", userId).maybeSingle(),
    supabase
      .from("trade_applications")
      .select("company_name, created_at, status, reviewed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const application = apps?.[0] ?? null;
  let status = (profile?.trade_status ?? "none") as TradeInfo["status"];
  // trade_status only changes when staff review, so a fresh application shows as pending here.
  if (status === "none" && application?.status === "pending") status = "pending";
  if (status === "rejected" && application?.status === "pending") status = "pending";
  return { status, application };
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export const formatDate = (d: string) => dateFmt.format(new Date(d));
export const formatShortDate = (d: string) => shortFmt.format(new Date(d));
export const formatTime = (d: string) => timeFmt.format(new Date(d));
export const orderRef = (n: number) => `No. ${n}`;
