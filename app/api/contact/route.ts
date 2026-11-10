/**
 * POST /api/contact { topic, message, reply_email?, website? } → save a message for the admin
 * inbox. Attaches the player id when there's a session (never creates one). The honeypot
 * `website` must be empty; bots that fill it get a quiet 201 and nothing is stored.
 */
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/ratelimit";
import { ContactBody, saveContact } from "@/lib/contact";
import { clientIp } from "@/lib/supabase/request";

export async function POST(req: Request) {
  const parsed = ContactBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const limited = await rateLimit("contact", clientIp(req) ?? "unknown");
  if (limited) return limited;
  const ok = Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  if (parsed.data.website) return ok; // honeypot
  try {
    const { user, sb } = await sessionUser(req);
    await saveContact(parsed.data, user?.id ?? null);
    return sb.applyCookies(ok); // pass on refreshed session cookies
  } catch (e) {
    console.error("POST /api/contact failed", e);
    return apiError("internal_error", "Couldn't send that. Try again in a minute.", 500);
  }
}
