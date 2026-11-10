/**
 * Session refresh (Supabase's recommended pattern), before API and admin requests.
 *
 * When the short-lived access token has expired, Supabase swaps the refresh token for a
 * new pair and the old refresh token stops working. Whoever does that swap MUST send the new
 * cookies back, or the browser is silently signed out a little later (Dani 2026-11-10: "I'm
 * logged in but Stats tells me to log in"). Server Components (the admin layout) can't set
 * cookies at all, and a few routes didn't send them back. So the refresh happens here, once,
 * with the new cookies on the response AND on the request, so everything after sees a fresh
 * session and never needs to refresh again.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "@/lib/supabase/request";

/** Public routes that never use the session: nothing to refresh. */
const SKIP = /^\/api\/(cron|og|puzzle|crowd)(\/|$)/;

export async function proxy(request: NextRequest) {
  if (SKIP.test(request.nextUrl.pathname)) return NextResponse.next();
  // No Supabase auth cookie: nothing to refresh (most visitors).
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))) return NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        // On the request, so the route or page after this sees the refreshed session…
        for (const c of cookies) request.cookies.set(c.name, c.value);
        response = NextResponse.next({ request });
        // …and on the response, so the browser keeps it.
        for (const c of cookies) response.cookies.set(c.name, c.value, { ...c.options, ...sessionCookieOptions(), maxAge: c.options.maxAge ?? sessionCookieOptions().maxAge });
      },
    },
    auth: { detectSessionInUrl: false },
  });
  try {
    // Verifies the access token, refreshing it (and calling setAll) only if it has expired.
    await supabase.auth.getClaims();
  } catch (e) {
    console.error("proxy session refresh failed", e);
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
