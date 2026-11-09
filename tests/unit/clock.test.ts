import { afterEach, describe, expect, it } from "vitest";
import { serverNow, TEST_CLOCK_HEADER } from "@/lib/api/clock";

const req = (h?: string) => new Request("http://x/", { headers: h ? { [TEST_CLOCK_HEADER]: h } : {} });
const env = { ...process.env };

describe("serverNow", () => {
  afterEach(() => {
    process.env = { ...env };
  });

  it("uses the real clock by default, even if the header is sent", () => {
    delete process.env.ALLOW_TEST_CLOCK;
    const t = serverNow(req("2001-01-01T00:00:00Z"));
    expect(Math.abs(t - Date.now())).toBeLessThan(1000);
  });

  it("honours the header when ALLOW_TEST_CLOCK=1", () => {
    process.env.ALLOW_TEST_CLOCK = "1";
    expect(serverNow(req("2001-01-01T00:00:00Z"))).toBe(Date.parse("2001-01-01T00:00:00Z"));
  });

  it("never honours it on Vercel production", () => {
    process.env.ALLOW_TEST_CLOCK = "1";
    process.env.VERCEL_ENV = "production";
    expect(Math.abs(serverNow(req("2001-01-01T00:00:00Z")) - Date.now())).toBeLessThan(1000);
  });

  it("falls back to the real clock on a malformed header", () => {
    process.env.ALLOW_TEST_CLOCK = "1";
    expect(Math.abs(serverNow(req("yesterday")) - Date.now())).toBeLessThan(1000);
  });
});
