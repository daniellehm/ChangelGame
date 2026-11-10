/**
 * First-party, cookieless analytics (SPEC §8 "How it is measured", §11). Server only.
 * Visitors are a daily-rotating salted hash of IP + user agent + date: no cookie, and
 * nobody can be followed from one day to the next. Only aggregates are ever shown.
 */
import { createHash } from "node:crypto";
import { isValidTimeZone, localDate } from "../dates";
import { adminClient } from "../supabase/admin";

export type ClientEvent = "share_clicked" | "signup_prompt_shown";
export type EventName = ClientEvent | "signup_completed";

/** Crawlers, link unfurlers and headless browsers (including our own tests and Lighthouse) aren't visitors. */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|slack|discord|telegram|twitter|linkedin|embedly|pinterest|skype|vercel|lighthouse|headless|curl|wget|python|node-fetch|axios|go-http/i;

export function isBot(ua: string | null): boolean {
  return !ua || BOT.test(ua);
}

export function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** The referring site's domain, or null: same site, no referrer, or the browser asks not to be tracked. */
export function referrerDomain(referer: string | null, host: string | null, doNotTrack: boolean): string | null {
  if (doNotTrack || !referer) return null;
  try {
    const d = new URL(referer).hostname.replace(/^www\./, "");
    const own = (host ?? "").replace(/:\d+$/, "").replace(/^www\./, "");
    return d && d !== own ? d.slice(0, 100) : null;
  } catch {
    return null;
  }
}

/** Salted hash that changes every day (UTC), so the same person on two days looks like two visitors. */
export function visitorHash(ip: string, ua: string, now: Date): string {
  const salt = process.env.CRON_SECRET ?? "changel-dev-salt";
  return createHash("sha256").update(`${salt}|${now.toISOString().slice(0, 10)}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

const dnt = (h: Headers) => h.get("dnt") === "1" || h.get("sec-gpc") === "1";

/** The visitor's puzzle date, from Vercel's IP time zone (else UTC). */
function puzzleDateFor(h: Headers, now: Date): string {
  const tz = h.get("x-vercel-ip-timezone");
  return tz && isValidTimeZone(tz) ? localDate(now, tz) : now.toISOString().slice(0, 10);
}

const ipOf = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

/** Record one visit to the game page (one row per visitor per day; repeats are ignored). Never throws. */
export async function recordVisit(h: Headers, fromShare: boolean, now = new Date()): Promise<void> {
  try {
    const ua = h.get("user-agent");
    if (isBot(ua)) return;
    const country = h.get("x-vercel-ip-country");
    await adminClient()
      .from("visits")
      .upsert(
        {
          visitor_hash: visitorHash(ipOf(h), ua!, now),
          puzzle_date: puzzleDateFor(h, now),
          country: country && /^[A-Z]{2}$/.test(country) ? country : null,
          device: deviceOf(ua!),
          referrer: referrerDomain(h.get("referer"), h.get("host"), dnt(h)),
          from_share: fromShare,
        },
        { onConflict: "visitor_hash,puzzle_date", ignoreDuplicates: true },
      );
  } catch (e) {
    console.error("recordVisit failed", e);
  }
}

/** Record an event. `userId` when there's a session; otherwise the visitor hash. Never throws. */
export async function recordEvent(e: { name: EventName; props?: Record<string, string | number | boolean>; puzzleDate?: string | null; userId?: string | null; headers?: Headers; now?: Date }): Promise<void> {
  try {
    const now = e.now ?? new Date();
    const visitor = !e.userId && e.headers ? visitorHash(ipOf(e.headers), e.headers.get("user-agent") ?? "", now) : null;
    await adminClient()
      .from("events")
      .insert({ name: e.name, props: e.props ?? {}, puzzle_date: e.puzzleDate ?? null, user_id: e.userId ?? null, visitor_hash: visitor });
  } catch (err) {
    console.error("recordEvent failed", err);
  }
}

/** Reserved test domains (RFC 2606): our tests' throwaway accounts never count as sign-ups. */
const TEST_EMAIL = /@(example\.(com|org|net)|[^@]+\.test)$/i;

/** "signup_completed" once per account, the first time it confirms an email. Never throws. */
export async function recordSignup(userId: string, email: string | null | undefined, flow: string, puzzleDate: string): Promise<void> {
  try {
    if (!email || TEST_EMAIL.test(email)) return;
    const { count } = await adminClient().from("events").select("id", { count: "exact", head: true }).eq("name", "signup_completed").eq("user_id", userId);
    if (!count) await recordEvent({ name: "signup_completed", props: { method: "email", flow }, puzzleDate, userId });
  } catch (e) {
    console.error("recordSignup failed", e);
  }
}
