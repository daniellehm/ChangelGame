import { afterEach, describe, expect, it } from "vitest";
import { turnstileRequired, verifyTurnstile } from "@/lib/api/turnstile";

const saved = process.env.TURNSTILE_SECRET;
afterEach(() => {
  process.env.TURNSTILE_SECRET = saved;
});

describe("Turnstile (server)", () => {
  it("is required only when TURNSTILE_SECRET is set", () => {
    delete process.env.TURNSTILE_SECRET;
    expect(turnstileRequired()).toBe(false);
    process.env.TURNSTILE_SECRET = "x";
    expect(turnstileRequired()).toBe(true);
  });

  it("sends secret, token and IP to Cloudflare and trusts only success: true", async () => {
    process.env.TURNSTILE_SECRET = "sekrit";
    let sent = "";
    const ok = await verifyTurnstile("tok", "203.0.113.9", async (_url, init) => {
      sent = String(init.body);
      return Response.json({ success: true });
    });
    expect(ok).toBe(true);
    expect(sent).toBe("secret=sekrit&response=tok&remoteip=203.0.113.9");
    expect(await verifyTurnstile("tok", null, async () => Response.json({ success: false }))).toBe(false);
    expect(await verifyTurnstile("tok", null, async () => Response.json({}))).toBe(false);
    expect(await verifyTurnstile("tok", null, async () => { throw new Error("down"); })).toBe(false);
  });
});
