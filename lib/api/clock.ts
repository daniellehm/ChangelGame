/**
 * Server "now". Tests can pin it with the `x-changel-test-now` header (ISO
 * timestamp), but ONLY when ALLOW_TEST_CLOCK=1 and never on a Vercel
 * production deployment, so real clients can't move the date window.
 */
export const TEST_CLOCK_HEADER = "x-changel-test-now";

export function testClockEnabled(): boolean {
  return process.env.ALLOW_TEST_CLOCK === "1" && process.env.VERCEL_ENV !== "production";
}

export function serverNow(req: Request): number {
  if (testClockEnabled()) {
    const h = req.headers.get(TEST_CLOCK_HEADER);
    const t = h ? Date.parse(h) : NaN;
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

/** Tests only: skip sending auth emails (codes come from the admin API). Never honoured in production. */
export const TEST_NO_EMAIL_HEADER = "x-changel-test-no-email";
export function skipEmailForTest(req: Request): boolean {
  return testClockEnabled() && req.headers.get(TEST_NO_EMAIL_HEADER) === "1";
}
