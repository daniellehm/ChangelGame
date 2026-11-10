/**
 * Cloudflare Turnstile (SPEC §11: "Turnstile on anonymous sign-up"). Required only when
 * TURNSTILE_SECRET is set, so local dev and tests work without it.
 */
export function turnstileRequired(): boolean {
  return !!process.env.TURNSTILE_SECRET;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** True if Cloudflare accepts the token. Network trouble counts as a failure (the game falls back to local play). */
export async function verifyTurnstile(token: string, ip: string | null, fetchFn: FetchLike = fetch): Promise<boolean> {
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET ?? "", response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetchFn("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5_000) });
    const out = (await res.json()) as { success?: boolean };
    return out.success === true;
  } catch {
    return false;
  }
}
