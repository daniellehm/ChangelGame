/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` (SPEC §7: cron routes are protected). */
import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
