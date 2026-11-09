import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimitClientForTests } from "@/lib/api/ratelimit";

describe("rateLimit without Upstash configured", () => {
  it("lets everything through (local dev / tests)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetRateLimitClientForTests();
    for (let i = 0; i < 100; i++) expect(await rateLimit("guess", "k")).toBeNull();
  });
});
