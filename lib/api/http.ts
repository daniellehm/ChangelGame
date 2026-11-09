/** Shared JSON helpers for route handlers (SPEC §7: errors are { error: { code, message } }). */
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ErrorCode =
  | "invalid_request"
  | "puzzle_not_available"
  | "puzzle_not_found"
  | "internal_error";

export function apiError(code: ErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function invalid(err: ZodError): NextResponse {
  const msg = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
  return apiError("invalid_request", msg, 400);
}

/** 200 with no caching (anything with answers or user data). */
export function ok(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
