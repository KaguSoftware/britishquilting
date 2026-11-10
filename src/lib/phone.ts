/**
 * How many digits a phone number has after its country code, for the customer form (to stop typing at the
 * limit) and the server (to refuse a wrong length). Digits only: spaces, brackets and dashes don't count, and
 * neither does a leading 0, which is dropped when a number is written with a country code in front.
 * Countries not listed here accept 4 digits up to the 15 that international numbers can have in total.
 */
type Rule = { min: number; max: number; name: string };

const R = (name: string, min: number, max = min): Rule => ({ name, min, max });

export const COUNTRIES: Record<string, Rule> = {
  "1": R("US and Canada", 10),
  "7": R("Russia and Kazakhstan", 10),
  "20": R("Egypt", 9, 10),
  "27": R("South Africa", 9),
  "30": R("Greece", 10),
  "31": R("the Netherlands", 9),
  "32": R("Belgium", 8, 9),
  "33": R("France", 9),
  "34": R("Spain", 9),
  "36": R("Hungary", 8, 9),
  "39": R("Italy", 6, 11),
  "40": R("Romania", 9),
  "41": R("Switzerland", 9),
  "43": R("Austria", 4, 13),
  "44": R("the UK", 9, 10),
  "45": R("Denmark", 8),
  "46": R("Sweden", 7, 10),
  "47": R("Norway", 8),
  "48": R("Poland", 9),
  "49": R("Germany", 6, 13),
  "52": R("Mexico", 10),
  "55": R("Brazil", 10, 11),
  "61": R("Australia", 9),
  "62": R("Indonesia", 8, 11),
  "63": R("the Philippines", 10),
  "64": R("New Zealand", 8, 10),
  "65": R("Singapore", 8),
  "81": R("Japan", 9, 10),
  "82": R("South Korea", 8, 10),
  "86": R("China", 11),
  "90": R("Turkey", 10),
  "91": R("India", 10),
  "92": R("Pakistan", 10),
  "212": R("Morocco", 9),
  "234": R("Nigeria", 8, 10),
  "254": R("Kenya", 9),
  "351": R("Portugal", 9),
  "353": R("Ireland", 7, 9),
  "357": R("Cyprus", 8),
  "358": R("Finland", 5, 10),
  "359": R("Bulgaria", 8, 9),
  "380": R("Ukraine", 9),
  "420": R("the Czech Republic", 9),
  "421": R("Slovakia", 9),
  "880": R("Bangladesh", 10),
  "966": R("Saudi Arabia", 9),
  "971": R("the UAE", 8, 9),
  "972": R("Israel", 8, 9),
  "994": R("Azerbaijan", 9),
};

/** Italian numbers keep their 0 (landlines start with it); everywhere else a leading 0 is the national dialling prefix. */
const KEEPS_ZERO = new Set(["39"]);

export function phoneRule(code: string): Rule {
  return COUNTRIES[code] ?? { name: "", min: 4, max: Math.max(4, 15 - code.length) };
}

export const digitsOf = (s: string) => s.replace(/\D/g, "");

/** The number as typed after a country code: a leading 0 is dropped and the digits are cut at the country's limit. */
export function trimNational(code: string, raw: string): string {
  let out = raw.replace(/[^\d\s()-]/g, "");
  if (!KEEPS_ZERO.has(code)) out = out.replace(/^[\s(]*0+/, "");
  const { max } = phoneRule(code);
  let seen = 0;
  let cut = "";
  for (const ch of out) {
    if (/\d/.test(ch)) {
      if (seen >= max) continue;
      seen++;
    }
    cut += ch;
  }
  return seen >= max ? cut.trimEnd() : cut;
}

/** "+90 532 123 45 67" as ["90", "532 123 45 67"]; null when it isn't written with a country code. */
export function parseInternational(v: string): [string, string] | null {
  const m = v.trim().match(/^\+(\d{1,3})\s+(.+)$/);
  return m ? [m[1], m[2]] : null;
}

/** Why a number can't be saved, or null when it is fine. Numbers without a "+code" keep the old, looser check. */
export function phoneProblem(value: string | null | undefined, what = "phone number"): string | null {
  const v = value?.trim();
  if (!v) return null;
  const intl = parseInternational(v);
  if (!intl) return /^[+\d][\d\s()-]{5,}$/.test(v) ? null : `That ${what} doesn't look right`;
  const [code, rest] = intl;
  if (!/^[\d\s()-]+$/.test(rest)) return `That ${what} doesn't look right`;
  const n = digitsOf(rest).length;
  const { min, max, name } = phoneRule(code);
  if (n >= min && n <= max) return null;
  const want = min === max ? `${min} digits` : `${min} to ${max} digits`;
  return name ? `A number in ${name} (+${code}) needs ${want} after the code, not ${n}.` : `A +${code} number needs ${want} after the code, not ${n}.`;
}
