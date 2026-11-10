#!/usr/bin/env node
// Replace the mock hand-added customers with the customers from the old system.
// Usage: node scripts/seed-legacy-customers.mjs           (dry run: prints what would happen)
//        node scripts/seed-legacy-customers.mjs --apply   (removes the mock customers, adds the old ones)
// Keeps CID-1001 and every website account. Needs the dob column (20261108130000_customer_dob.sql).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnv(new URL("../.env.local", import.meta.url));

const KEEP = [1001];
const apply = process.argv.includes("--apply");

/** UK numbers (44... or 0..., 10 digits after) as +44 20 7790 3919 / +44 7779 022772; anything else as written.
 *  Placeholders too short to be a phone number (1234) are dropped. */
export function formatPhone(raw) {
  const v = raw?.trim();
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length < 6) return null;
  const nat = d.length === 12 && d.startsWith("44") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : null;
  if (!nat) return v;
  if (nat.startsWith("20")) return `+44 20 ${nat.slice(2, 6)} ${nat.slice(6)}`;
  return `+44 ${nat.slice(0, 4)} ${nat.slice(4)}`;
}

/** The digits that identify a phone number, as public.phone_key in the database compares them. */
const phoneKey = (raw) => {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0044")) d = d.slice(4);
  else if (d.startsWith("44") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d || null;
};

const rows = JSON.parse(readFileSync(new URL("./data/legacy-customers.json", import.meta.url), "utf8"));
const customers = [];
const skipped = [];
// The database allows one email and one phone number per customer, so a repeat entry keeps the first one.
const repeats = [];
const seen = new Set();
for (const [created_at, first, middle, last, email, phone, altPhone, mobile, altMobile, dob, gender, comment] of rows) {
  const full_name = [first, middle, last].map((s) => s?.trim()).filter(Boolean).join(" ");
  if (full_name.length < 2) {
    skipped.push({ created_at, phone, altPhone, mobile });
    continue;
  }
  // Telephone and one alternative. Someone with neither keeps their mobile as the telephone.
  let tel = formatPhone(phone);
  let alt = formatPhone(altPhone);
  if (!tel && !alt) tel = formatPhone(mobile) ?? formatPhone(altMobile);
  if (alt && alt === tel) alt = null;
  const keys = [email?.trim().toLowerCase() && `e:${email.trim().toLowerCase()}`, ...[tel, alt].map((p) => phoneKey(p) && `p:${phoneKey(p)}`)].filter(Boolean);
  if (keys.some((k) => seen.has(k))) {
    repeats.push({ created_at, full_name, email, phone: tel });
    continue;
  }
  keys.forEach((k) => seen.add(k));
  const note = comment?.trim();
  customers.push({
    full_name,
    email: email?.trim() || null,
    phone: tel,
    alt_phone: alt,
    dob: dob || null,
    gender: gender || null,
    note: note && note !== "-" ? note : null,
    created_at,
  });
}

console.table(customers.map(({ full_name, email, phone, alt_phone, dob, gender, note }) => ({ full_name, email, phone, alt_phone, dob, gender, note })));
console.log(`${customers.length} to add, ${skipped.length} skipped without a name:`, skipped);
console.log(`${repeats.length} skipped as repeats of an earlier customer (same email or phone):`, repeats);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: doomed, error: listErr } = await db.from("manual_customers").select("id, number, full_name").not("number", "in", `(${KEEP.join(",")})`).order("number");
if (listErr) throw listErr;
console.log("To remove:", doomed.map((c) => `CID-${c.number} ${c.full_name}`));

if (!apply) {
  console.log("\nDry run. Run again with --apply to make these changes.");
  process.exit(0);
}

const { error: colErr } = await db.from("manual_customers").select("dob").limit(1);
if (colErr) throw new Error("The dob column is missing. Apply supabase/migrations/20261108130000_customer_dob.sql first.");

if (doomed.length) {
  const { error } = await db.from("manual_customers").delete().in("id", doomed.map((c) => c.id));
  if (error) throw error;
}
// One at a time, oldest first, so the CIDs follow the order they joined the old system.
for (const c of customers) {
  const { data, error } = await db.from("manual_customers").insert(c).select("number").single();
  if (error) throw new Error(`${c.full_name}: ${error.message}`);
  console.log(`CID-${data.number}  ${c.full_name}`);
}
console.log(`Removed ${doomed.length}, added ${customers.length}.`);
