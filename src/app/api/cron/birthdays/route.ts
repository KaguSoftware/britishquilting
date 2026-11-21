import { createAdminClient } from "@/lib/supabase/server";
import { sendBirthdayEmail } from "@/lib/email";
import { birthdayOfferLabel, birthdayWindow, isBirthday, londonDay } from "@/lib/birthday";
import { formatPence } from "@/lib/utils";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily birthday emails (Vercel Cron, see vercel.json). Sends each website account whose birthday is today a note
 * about their birthday treat, once a year. Vercel calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const db = createAdminClient();
  const { data: settings } = await db
    .from("store_settings")
    .select("birthday_enabled, birthday_kind, birthday_value, birthday_days, birthday_min_subtotal_pence")
    .eq("id", 1)
    .single();
  if (!settings?.birthday_enabled || settings.birthday_value <= 0) return Response.json({ sent: 0, skipped: "Birthday treats are switched off" });

  const today = londonDay();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  // 29 February birthdays are celebrated on 28 February in other years, so that day also looks at the 29th.
  const days = month === 2 && day === 28 ? [28, 29] : [day];

  const { data: people, error } = await db
    .from("profiles")
    .select("id, email, full_name, dob, birthday_emailed_year")
    .not("dob", "is", null)
    .or(`birthday_emailed_year.is.null,birthday_emailed_year.lt.${year}`)
    .limit(5000);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const due = (people ?? []).filter((p) => p.dob && Number(p.dob.slice(5, 7)) === month && days.includes(Number(p.dob.slice(8, 10))) && isBirthday(p.dob, today));
  const offer = birthdayOfferLabel(settings);
  const minimum = settings.birthday_min_subtotal_pence > 0 ? `on orders of ${formatPence(settings.birthday_min_subtotal_pence)} or more` : "";

  let sent = 0;
  for (const p of due) {
    const w = birthdayWindow(p.dob!, today, settings.birthday_days);
    if (!w) continue;
    const until = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${w.end}T12:00:00Z`));
    // Mark first, so a retry of this run never sends twice.
    const { error: markError } = await db.from("profiles").update({ birthday_emailed_year: year }).eq("id", p.id);
    if (markError) continue;
    const ok = await sendBirthdayEmail(p.email, { firstName: p.full_name?.split(" ")[0] ?? null, offer, days: settings.birthday_days, until, minimum });
    if (ok) sent++;
  }
  return Response.json({ due: due.length, sent });
}
