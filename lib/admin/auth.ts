/**
 * Admin access (SPEC §11: "Admin routes check the session email against
 * ADMIN_EMAILS on the server"). Every /api/admin route calls requireAdmin first;
 * admin data is only ever read by the server with the service role, so there is
 * no client database access to protect with RLS (DECISIONS 2026-11-09 "M5 admin").
 */
import type { NextResponse } from "next/server";
import { sessionUser, type SessionUser } from "../api/auth";
import { apiError } from "../api/http";
import type { RequestSupabase } from "../supabase/request";

/** ADMIN_EMAILS: comma-separated, case-insensitive. Empty means nobody. */
export function adminEmails(raw = process.env.ADMIN_EMAILS ?? ""): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(user: SessionUser | null, raw?: string): boolean {
  return !!user && !user.isAnonymous && !!user.email && adminEmails(raw).has(user.email.toLowerCase());
}

export type AdminCheck = { ok: true; user: SessionUser; sb: RequestSupabase } | { ok: false; res: NextResponse };

export async function requireAdmin(req: Request): Promise<AdminCheck> {
  const { user, sb } = await sessionUser(req);
  if (!user || user.isAnonymous) return { ok: false, res: sb.applyCookies(apiError("unauthorized", "Sign in with an admin email first.", 401)) };
  if (!isAdmin(user)) return { ok: false, res: sb.applyCookies(apiError("forbidden", "This account doesn't have admin access.", 403)) };
  return { ok: true, user, sb };
}
