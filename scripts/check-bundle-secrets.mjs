/**
 * Fails the build if a server-only secret reaches the browser bundle (SPEC §11:
 * "Service-role key only on the server ... add a CI check that greps the build output").
 * Runs after `next build` (package.json "build"), so a leak stops the Vercel deploy.
 * Scans .next/static (everything browsers download) for the actual secret values and for
 * anything that looks like a Supabase service-role key.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/static";
const SECRETS = ["SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "RESEND_API_KEY", "CRON_SECRET", "UPSTASH_REDIS_REST_TOKEN", "TURNSTILE_SECRET"];
const PATTERNS = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, "a Supabase secret key (sb_secret_…)"],
  [/c2VydmljZV9yb2xl/, 'a JWT whose payload says "service_role"'],
  [/"role"\s*:\s*"service_role"/, 'a decoded service_role claim'],
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|mjs|css|html|json|map|txt)$/.test(name)) yield p;
  }
}

const values = SECRETS.map((k) => [k, process.env[k]]).filter(([, v]) => v && v.length >= 12);
const problems = [];
let scanned = 0;
for (const f of files(ROOT)) {
  const text = readFileSync(f, "utf8");
  scanned++;
  for (const [k, v] of values) if (text.includes(v)) problems.push(`${f}: contains the value of ${k}`);
  for (const [re, what] of PATTERNS) if (re.test(text)) problems.push(`${f}: contains ${what}`);
}

if (problems.length) {
  console.error(`\n✖ Secret check failed: ${problems.length} problem(s) in the browser bundle:\n  ${problems.join("\n  ")}\n`);
  process.exit(1);
}
console.log(`✓ Secret check: ${scanned} browser files clean (${values.length} secret values checked).`);
