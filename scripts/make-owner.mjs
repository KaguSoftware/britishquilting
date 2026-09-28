#!/usr/bin/env node
// Make an existing account the shop owner.
// Usage: node scripts/make-owner.mjs you@example.com
// The person must have signed up on the site first.
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

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/make-owner.mjs you@example.com");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: profile, error } = await db.from("profiles").select("id, email, role").eq("email", email).maybeSingle();
if (error) {
  console.error("Lookup failed:", error.message);
  process.exit(1);
}
if (!profile) {
  console.error(`No account found for ${email}. Sign up on the site with that email first, then run this again.`);
  process.exit(1);
}
const { error: upErr } = await db.from("profiles").update({ role: "owner" }).eq("id", profile.id);
if (upErr) {
  console.error("Update failed:", upErr.message);
  process.exit(1);
}
await db.from("audit_log").insert({ actor_id: profile.id, action: "staff.promote", entity: "profile", entity_id: profile.id, data: { email, to: "owner", via: "script" } });
console.log(`${email} is now the owner (was ${profile.role}). Sign in and open /admin.`);
