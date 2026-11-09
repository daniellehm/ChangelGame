import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Integration tests need SUPABASE_SERVICE_ROLE_KEY in .env.local");
process.env.ALLOW_TEST_CLOCK = "1";
process.env.LAUNCH_DATE = "2026-11-09";
