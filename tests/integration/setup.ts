import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Integration tests need SUPABASE_SERVICE_ROLE_KEY in .env.local");
process.env.ALLOW_TEST_CLOCK = "1";
process.env.LAUNCH_DATE = "2026-11-09";
// Never email Dani from tests: alerts are recorded in alerts_sent but not sent.
process.env.CHANGEL_NO_ALERT_EMAIL = "1";

// Route tests make far more requests per minute than a player; keep the real
// limiter off here. tests/integration/ratelimit.test.ts turns it on explicitly.
process.env.RL_TEST_UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? "";
process.env.RL_TEST_UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
