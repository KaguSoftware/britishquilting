import "server-only";
import { penceToDecimal } from "@/lib/checkout/helpers";

/** PayPal Orders v2 over REST, client credentials. No SDK needed. */

export function paypalConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

const base = () => process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

let cached: { token: string; expires: number } | null = null;

async function accessToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const id = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal is not configured");
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function call<T>(path: string, init: { method: string; body?: unknown; requestId?: string }): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${base()}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { name?: string; message?: string; details?: { issue?: string }[] };
  if (!res.ok) {
    const issue = json.details?.[0]?.issue ?? json.name ?? res.status;
    const err = new Error(`PayPal ${init.method} ${path} failed: ${issue}`) as Error & { issue?: unknown };
    err.issue = issue;
    throw err;
  }
  return json;
}

export type PayPalOrder = {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  purchase_units: {
    custom_id?: string;
    reference_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: { captures?: { id: string; status: string; amount: { currency_code: string; value: string } }[] };
  }[];
};

export async function createPayPalOrder(opts: { orderId: string; orderNumber: number; totalPence: number }) {
  return call<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    // Same request id for the same order + amount: PayPal returns the existing order on retries.
    requestId: `bq-${opts.orderId}-${opts.totalPence}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.orderId,
          custom_id: opts.orderId,
          invoice_id: `BQ-${opts.orderNumber}`,
          description: `British Quilting order #${opts.orderNumber}`,
          amount: { currency_code: "GBP", value: penceToDecimal(opts.totalPence) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "British Quilting",
            locale: "en-GB",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
          },
        },
      },
    },
  });
}

export async function getPayPalOrder(id: string) {
  return call<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function capturePayPalOrder(id: string) {
  return call<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {
    method: "POST",
    requestId: `bq-capture-${id}`,
    body: {},
  });
}
