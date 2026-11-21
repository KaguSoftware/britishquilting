import Link from "next/link";
import { staffDb } from "@/lib/actions/admin/guard";
import { birthdayIn, birthdayWindow, daysUntilBirthday, londonDay, type BirthdaySettings } from "@/lib/birthday";
import { customerNo } from "@/lib/invoices";
import { Card } from "@/components/admin/ui";
import { BirthdayForm } from "@/components/admin/birthday-form";

export const metadata = { title: "Birthday treats" };

const AHEAD = 30;
const USED = ["paid", "processing", "shipped", "ready_for_collection", "collected", "delivered"];
const dayMonth = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

export default async function BirthdaysPage() {
  const { db, viewer } = await staffDb();
  const today = londonDay();
  const year = Number(today.slice(0, 4));
  const [{ data: s }, { data: people }, { data: used }, { count: total }] = await Promise.all([
    db.from("store_settings").select("birthday_enabled, birthday_kind, birthday_value, birthday_days, birthday_min_subtotal_pence").eq("id", 1).single(),
    db.from("profiles").select("id, cid, full_name, email, dob, birthday_emailed_year").not("dob", "is", null).limit(10000),
    db.from("orders").select("user_id, birthday_year").not("birthday_year", "is", null).in("status", USED),
    db.from("profiles").select("id", { count: "exact", head: true }).not("dob", "is", null),
  ]);
  const settings = s as BirthdaySettings;
  const usedBy = new Set((used ?? []).map((o) => `${o.user_id}:${o.birthday_year}`));

  const rows = (people ?? [])
    .map((p) => {
      const days = daysUntilBirthday(p.dob!, today);
      const window = birthdayWindow(p.dob!, today, settings.birthday_days);
      const thisYear = birthdayIn(p.dob!, year);
      return { ...p, days, window, next: thisYear >= today ? thisYear : birthdayIn(p.dob!, year + 1) };
    })
    .filter((p) => p.days <= AHEAD || p.window)
    .sort((a, b) => (a.window && !b.window ? -1 : !a.window && b.window ? 1 : a.days - b.days));

  return (
    <div className="space-y-6">
      <BirthdayForm initial={settings} canEdit={viewer.role === "owner"} />

      <Card
        title="Coming up"
        description={`Birthdays in the next ${AHEAD} days, and anyone whose treat is running now. ${total ?? 0} customer${total === 1 ? " has" : "s have"} told us their birthday.`}
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-soft">No birthdays in the next {AHEAD} days.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left text-xs text-stone-500">
                <th className="px-5 py-3 font-normal">Customer</th>
                <th className="px-3 py-3 font-normal">Birthday</th>
                <th className="hidden px-3 py-3 font-normal sm:table-cell">Email</th>
                <th className="px-5 py-3 text-right font-normal">Treat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const celebrating = p.window?.year ?? year;
                const usedIt = usedBy.has(`${p.id}:${celebrating}`);
                const emailed = (p.birthday_emailed_year ?? 0) >= celebrating;
                return (
                  <tr key={p.id} className="border-b border-ink/10 last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/admin/customers/${p.id}`} className="font-medium text-ink hover:text-aubergine-700 hover:underline">
                        {p.full_name || p.email}
                      </Link>
                      <span className="block text-xs text-stone-500">{[p.cid ? customerNo(p.cid) : null, p.email].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {dayMonth(p.window?.start ?? p.next)}
                      <span className="block text-xs text-stone-500">{p.days === 0 ? "Today" : p.window ? "Treat running" : `In ${p.days} day${p.days === 1 ? "" : "s"}`}</span>
                    </td>
                    <td className="hidden px-3 py-3 text-ink-soft sm:table-cell">{emailed ? "Sent" : p.window ? "Not sent" : "Due on the day"}</td>
                    <td className="px-5 py-3 text-right">
                      {usedIt ? (
                        <span className="text-success">Used</span>
                      ) : p.window ? (
                        <span className="text-aubergine-800">Until {dayMonth(p.window.end)}</span>
                      ) : (
                        <span className="text-stone-500">Not yet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
