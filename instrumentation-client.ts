/**
 * Browser error reporting (M6 task 6.6, JS budget: DECISIONS item 11). Nothing loads up
 * front: the Sentry SDK is fetched only the first time an uncaught error or rejected
 * promise happens, and only when NEXT_PUBLIC_SENTRY_DSN is set. No tracing, no replay,
 * no personal data.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  let sdk: Promise<typeof import("@sentry/browser")> | null = null;
  const report = (error: unknown) => {
    sdk ??= import("@sentry/browser").then((S) => {
      S.init({ dsn, environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development", tracesSampleRate: 0, defaultIntegrations: false, integrations: [S.dedupeIntegration(), S.linkedErrorsIntegration()] });
      return S;
    });
    void sdk.then((S) => S.captureException(error)).catch(() => undefined);
  };
  window.addEventListener("error", (e) => report(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => report(e.reason));
}
