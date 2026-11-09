import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every env var the app uses must be documented in .env.example (CLAUDE.md working rule).
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LAUNCH_DATE",
  "ADMIN_EMAILS",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "TURNSTILE_SECRET",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ANTHROPIC_API_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
];

describe(".env.example", () => {
  const lines = readFileSync(".env.example", "utf8").split("\n");
  const entries = lines.filter((l) => /^[A-Z0-9_]+=/.test(l));

  it.each(REQUIRED)("documents %s", (name) => {
    expect(entries.some((l) => l.startsWith(`${name}=`))).toBe(true);
  });

  it("contains no secret values (only LAUNCH_DATE may be pre-filled)", () => {
    for (const l of entries) {
      const [k, v] = l.split("=");
      if (k !== "LAUNCH_DATE") expect(v, k).toBe("");
    }
  });
});
