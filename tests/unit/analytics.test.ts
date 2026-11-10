import { describe, expect, it } from "vitest";
import { deviceOf, isBot, referrerDomain, visitorHash } from "@/lib/analytics/server";
import { latestClosedDate } from "@/lib/analytics/metrics";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_TAB = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("visits", () => {
  it("skips bots, link unfurlers and headless browsers", () => {
    for (const ua of [null, "", "WhatsApp/2.24", "facebookexternalhit/1.1", "Twitterbot/1.0", "Slackbot-LinkExpanding 1.0", "Mozilla/5.0 HeadlessChrome/130", "Mozilla/5.0 (compatible; Googlebot/2.1)", "curl/8.4"]) {
      expect(isBot(ua), String(ua)).toBe(true);
    }
    expect(isBot(IPHONE)).toBe(false);
    expect(isBot(MAC)).toBe(false);
  });

  it("classifies devices", () => {
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(deviceOf(IPAD)).toBe("tablet");
    expect(deviceOf(ANDROID_TAB)).toBe("tablet");
    expect(deviceOf(MAC)).toBe("desktop");
  });

  it("keeps only the referring domain, never our own, and none under Do Not Track", () => {
    expect(referrerDomain("https://www.reddit.com/r/dailygames/comments/x", "changel.app", false)).toBe("reddit.com");
    expect(referrerDomain("https://changel.app/stats", "changel.app", false)).toBeNull();
    expect(referrerDomain("https://www.changel.app/", "changel.app", false)).toBeNull();
    expect(referrerDomain("https://t.co/abc", "changel.app", true)).toBeNull();
    expect(referrerDomain("not a url", "changel.app", false)).toBeNull();
  });

  it("the visitor hash is stable within a day and different the next day (no cross-day tracking)", () => {
    const a = visitorHash("1.2.3.4", IPHONE, new Date("2026-11-10T01:00:00Z"));
    expect(visitorHash("1.2.3.4", IPHONE, new Date("2026-11-10T23:00:00Z"))).toBe(a);
    expect(visitorHash("1.2.3.4", IPHONE, new Date("2026-11-11T01:00:00Z"))).not.toBe(a);
    expect(visitorHash("1.2.3.5", IPHONE, new Date("2026-11-10T01:00:00Z"))).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("daily metrics", () => {
  it("only finished days: D is final from D+1 12:00 UTC", () => {
    expect(latestClosedDate(new Date("2026-11-11T17:30:00Z"))).toBe("2026-11-10"); // the cron's time
    expect(latestClosedDate(new Date("2026-11-11T11:59:00Z"))).toBe("2026-11-09");
    expect(latestClosedDate(new Date("2026-11-11T12:00:00Z"))).toBe("2026-11-10");
  });
});
