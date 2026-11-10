/** M6 task 6.6: Sentry is inert until a DSN is set (no account yet; see PROGRESS "Needs from Dani"). */
import * as Sentry from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { register } from "@/instrumentation";

describe("server error reporting", () => {
  it("does nothing without SENTRY_DSN", async () => {
    const saved = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    await register();
    expect(Sentry.getClient()).toBeUndefined();
    process.env.SENTRY_DSN = saved;
  });
});
