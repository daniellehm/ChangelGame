import { describe, expect, it } from "vitest";
import { clientIp, sessionCookieOptions } from "@/lib/supabase/request";

const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then null", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(req({}))).toBeNull();
  });
});

describe("session cookies", () => {
  it("are HTTP-only and Lax (SPEC §5)", () => {
    expect(sessionCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });
});
