/**
 * Short-lived HTTP-only cookies for the email sign-in flow:
 *  - changel_auth: which kind of code to expect ({ email, type }). Keeps the
 *    API from revealing whether an email already has an account.
 *  - changel_merge: single-use merge token (raw); its SHA-256 lives in merge_tokens.
 */
import { parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

export const AUTH_FLOW_COOKIE = "changel_auth";
export const MERGE_COOKIE = "changel_merge";
export const FLOW_TTL_S = 60 * 60; // codes are valid for 1 hour
export const MERGE_TTL_S = 15 * 60; // SPEC §5: 15 minutes

export type OtpKind = "email" | "email_change";

export interface AuthFlow {
  email: string;
  type: OtpKind;
}

const base = () => ({ path: "/", httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" });

export function readCookie(req: Request, name: string): string | null {
  const c = parseCookieHeader(req.headers.get("cookie") ?? "").find((x) => x.name === name);
  return c?.value ?? null;
}

export function setCookie(res: Response, name: string, value: string, maxAge: number): void {
  res.headers.append("Set-Cookie", serializeCookieHeader(name, value, { ...base(), maxAge }));
}

export function clearCookie(res: Response, name: string): void {
  res.headers.append("Set-Cookie", serializeCookieHeader(name, "", { ...base(), maxAge: 0 }));
}

export function readFlow(req: Request): AuthFlow | null {
  const raw = readCookie(req, AUTH_FLOW_COOKIE);
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as AuthFlow;
    return typeof f.email === "string" && (f.type === "email" || f.type === "email_change") ? f : null;
  } catch {
    return null;
  }
}

export function setFlow(res: Response, flow: AuthFlow): void {
  setCookie(res, AUTH_FLOW_COOKIE, JSON.stringify(flow), FLOW_TTL_S);
}
