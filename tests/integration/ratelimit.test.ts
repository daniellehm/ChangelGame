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
    expect((await blocked!.json()).error.code).toBe("rate_limited");
    expect(Number(blocked!.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another player is unaffected.
    expect(await rateLimit("guess", `itest-${randomUUID()}`)).toBeNull();
  });
});
