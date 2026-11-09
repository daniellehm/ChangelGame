import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { LIMITS, rateLimit, resetRateLimitClientForTests } from "@/lib/api/ratelimit";

describe("rate limits (real Upstash)", () => {
  beforeAll(() => {
    process.env.UPSTASH_REDIS_REST_URL = process.env.RL_TEST_UPSTASH_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = process.env.RL_TEST_UPSTASH_TOKEN;
    resetRateLimitClientForTests();
  });
  afterAll(() => {
    process.env.UPSTASH_REDIS_REST_URL = "";
    process.env.UPSTASH_REDIS_REST_TOKEN = "";
    resetRateLimitClientForTests();
  });

  it.skipIf(!process.env.RL_TEST_UPSTASH_URL)("allows 30 guesses a minute per player, then 429s with Retry-After", async () => {
    const key = `itest-${randomUUID()}`; // fresh key, never collides with real players
    for (let i = 0; i < LIMITS.guess.tokens; i++) expect(await rateLimit("guess", key), `request ${i + 1}`).toBeNull();
    const blocked = await rateLimit("guess", key);
    expect(blocked?.status).toBe(429);
    const body = await blocked!.json();
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).toMatch(/Try again in \d+ seconds|in \d+ seconds/);
    expect(Number(blocked!.headers.get("retry-after"))).toBeGreaterThan(0);
    // Sign-in limits say what tripped, so players aren't left guessing.
    const ip = `itest-${randomUUID()}`;
    for (let i = 0; i < LIMITS.authEmail.tokens; i++) await rateLimit("authEmail", ip);
    const emailBlocked = await rateLimit("authEmail", ip);
    expect((await emailBlocked!.json()).error.message).toMatch(/^Too many sign-in emails from your network\. Try again in \d+ seconds\.$/);
    // Another player is unaffected.
    expect(await rateLimit("guess", `itest-${randomUUID()}`)).toBeNull();
  });
});
