/**
 * Server error reporting (M6 task 6.6). Sentry starts only when SENTRY_DSN is set;
 * without it, onRequestError is a no-op. No tracing, no personal data.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0, // errors only; Sentry 11 sends no personal data by default
  });
}

/** Errors thrown while rendering or in route handlers. */
export const onRequestError = Sentry.captureRequestError;
