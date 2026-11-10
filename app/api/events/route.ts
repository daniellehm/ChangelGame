/**
 * POST /api/events { name, date, props? } → record a browser-only analytics event
 * (SPEC §11): share_clicked { method }, signup_prompt_shown. Uses the session's user id
 * if there is one (never creates a session), else the daily visitor hash. 204 always on
 * valid input: analytics must never break the game.
 */
import { z } from "zod";
import { invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/ratelimit";
import { isBot, recordEvent } from "@/lib/analytics/server";
import { isDateString } from "@/lib/dates";
import { clientIp } from "@/lib/supabase/request";

const Body = z.discriminatedUnion("name", [
  z.object({ name: z.literal("share_clicked"), date: z.string().refine(isDateString), props: z.object({ method: z.enum(["share_sheet", "clipboard", "manual"]) }) }),
  z.object({ name: z.literal("signup_prompt_shown"), date: z.string().refine(isDateString), props: z.object({}).strict().optional() }),
]);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const limited = await rateLimit("events", clientIp(req) ?? "unknown");
  if (limited) return limited;
  if (isBot(req.headers.get("user-agent"))) return new Response(null, { status: 204 }); // tests, crawlers
  const { user, sb } = await sessionUser(req);
  await recordEvent({ name: parsed.data.name, props: parsed.data.props ?? {}, puzzleDate: parsed.data.date, userId: user?.id ?? null, headers: req.headers });
  // Always pass on refreshed session cookies, or the browser keeps a dead refresh token.
  return sb.applyCookies(new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }));
}
