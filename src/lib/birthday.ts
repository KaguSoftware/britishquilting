/**
 * Birthday discount: pure date maths shared by checkout, the daily email and the admin.
 * Dates are YYYY-MM-DD strings in London time. A 29 February birthday is celebrated on 28 February in other years.
 */
import type { Discount } from "@/lib/pricing";

export type BirthdaySettings = {
  birthday_enabled: boolean;
  birthday_kind: "percent" | "fixed";
  /** Percent off, or pence off for "fixed". */
  birthday_value: number;
  /** How many days the discount lasts, counting the birthday itself. */
  birthday_days: number;
  birthday_min_subtotal_pence: number;
};

/** A changed birthday only counts again after this many days, so it can't be edited to get a discount. */
export const DOB_CHANGE_WAIT_DAYS = 60;

/** Stored as the order's discount code. Has a space, so it can never clash with a real code (letters, numbers, - and _ only). */
export const BIRTHDAY_CODE = "Birthday treat";

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad = (n: number) => String(n).padStart(2, "0");
const toUTC = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => fromUTC(toUTC(iso) + n * 86_400_000);

/** Today in London as YYYY-MM-DD. */
export const londonDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);

/** The day the birthday falls on in a given year. */
export function birthdayIn(dob: string, year: number) {
  const m = Number(dob.slice(5, 7));
  let d = Number(dob.slice(8, 10));
  if (m === 2 && d === 29 && !isLeap(year)) d = 28;
  return `${year}-${pad(m)}-${pad(d)}`;
}

/**
 * The birthday window that today falls in, if any: from the birthday through `days - 1` days after it.
 * `year` is the year of the birthday it celebrates, so a window that runs over New Year still counts once.
 */
export function birthdayWindow(dob: string, today: string, days: number): { year: number; start: string; end: string } | null {
  if (!dob || days < 1) return null;
  const y = Number(today.slice(0, 4));
  for (const year of [y, y - 1]) {
    const start = birthdayIn(dob, year);
    const end = addDays(start, days - 1);
    if (today >= start && today <= end) return { year, start, end };
  }
  return null;
}

/** True when today is the birthday itself (the day the email goes out). */
export const isBirthday = (dob: string, today: string) => birthdayIn(dob, Number(today.slice(0, 4))) === today;

/** The birthday discount for this customer today, or null with no reason to show it. */
export function birthdayEligibility(opts: {
  settings: BirthdaySettings | null;
  dob: string | null;
  dobChangedAt: string | null;
  today: string;
  /** Birthday years already used on an order. */
  usedYears: number[];
}): { year: number; end: string } | null {
  const { settings, dob, dobChangedAt, today } = opts;
  if (!settings?.birthday_enabled || !dob || settings.birthday_value <= 0) return null;
  const w = birthdayWindow(dob, today, settings.birthday_days);
  if (!w || opts.usedYears.includes(w.year)) return null;
  if (dobChangedAt && addDays(dobChangedAt.slice(0, 10), DOB_CHANGE_WAIT_DAYS) > w.start) return null;
  return { year: w.year, end: w.end };
}

/** The birthday discount as a checkout discount. */
export function birthdayDiscount(s: BirthdaySettings): Discount {
  return { code: BIRTHDAY_CODE, kind: s.birthday_kind, value: s.birthday_value, min_subtotal_pence: s.birthday_min_subtotal_pence };
}

/** "15% off" or "£10 off". */
export function birthdayOfferLabel(s: Pick<BirthdaySettings, "birthday_kind" | "birthday_value">) {
  return s.birthday_kind === "percent" ? `${s.birthday_value}% off` : `£${(s.birthday_value / 100).toFixed(s.birthday_value % 100 ? 2 : 0)} off`;
}

/** Days until the next birthday (0 on the day). */
export function daysUntilBirthday(dob: string, today: string) {
  const y = Number(today.slice(0, 4));
  let next = birthdayIn(dob, y);
  if (next < today) next = birthdayIn(dob, y + 1);
  return Math.round((toUTC(next) - toUTC(today)) / 86_400_000);
}
