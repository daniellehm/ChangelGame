import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { computeAlerts, consecutiveReadyDays, type RunSummary } from "@/lib/admin/alerts";
import { adminEmails, isAdmin } from "@/lib/admin/auth";

describe("admin access", () => {
  const raw = " Dani@Example.com, ops@example.com ,,";
  it("parses ADMIN_EMAILS (comma-separated, trimmed, case-insensitive)", () => {
    expect(adminEmails(raw)).toEqual(new Set(["dani@example.com", "ops@example.com"]));
    expect(adminEmails("")).toEqual(new Set());
  });
  it("admits only signed-in, non-anonymous users on the list", () => {
    expect(isAdmin({ id: "1", isAnonymous: false, email: "dani@EXAMPLE.com" }, raw)).toBe(true);
    expect(isAdmin({ id: "1", isAnonymous: false, email: "someone@example.com" }, raw)).toBe(false);
    expect(isAdmin({ id: "1", isAnonymous: true, email: "dani@example.com" }, raw)).toBe(false);
    expect(isAdmin({ id: "1", isAnonymous: false, email: null }, raw)).toBe(false);
    expect(isAdmin(null, raw)).toBe(false);
    expect(isAdmin({ id: "1", isAnonymous: false, email: "dani@example.com" }, "")).toBe(false); // empty list = nobody
  });
});

const run = (over: Partial<RunSummary> = {}): RunSummary => ({ status: "done", trigger: "cron", verified: 10, flagged: 1, started_at: "2026-11-09T02:00:00Z", ...over });

describe("alerts", () => {
  it("nothing to say when all is well", () => {
    expect(computeAlerts({ readyDaysAhead: 30, nightly: [run()], capReached: false })).toEqual([]);
  });
  it("banner under 14 ready days; email under 7", () => {
    expect(computeAlerts({ readyDaysAhead: 13, nightly: [], capReached: false })).toMatchObject([{ kind: "low_buffer", email: false }]);
    expect(computeAlerts({ readyDaysAhead: 6, nightly: [], capReached: false })).toMatchObject([{ kind: "very_low_buffer", level: "danger", email: true }]);
    expect(computeAlerts({ readyDaysAhead: 14, nightly: [], capReached: false })).toEqual([]);
  });
  it("a failed run is a banner; two nights in a row is an email", () => {
    expect(computeAlerts({ readyDaysAhead: 30, nightly: [run({ status: "failed", error: "boom" })], capReached: false })).toMatchObject([{ kind: "run_failed", email: false }]);
    expect(computeAlerts({ readyDaysAhead: 30, nightly: [run({ status: "failed" }), run({ status: "failed" })], capReached: false })).toMatchObject([{ kind: "runs_failed_twice", email: true }]);
  });
  it("more than 40% of a night's candidates failing is a banner (with at least 5 candidates)", () => {
    expect(computeAlerts({ readyDaysAhead: 30, nightly: [run({ verified: 5, flagged: 5 })], capReached: false })).toMatchObject([{ kind: "high_fail_rate" }]);
    expect(computeAlerts({ readyDaysAhead: 30, nightly: [run({ verified: 6, flagged: 4 })], capReached: false })).toEqual([]);
    expect(computeAlerts({ readyDaysAhead: 30, nightly: [run({ verified: 1, flagged: 3 })], capReached: false })).toEqual([]);
  });
  it("the spend cap is a banner, never an email", () => {
    expect(computeAlerts({ readyDaysAhead: 30, nightly: [], capReached: true })).toMatchObject([{ kind: "spend_cap", email: false }]);
  });
  it("counts consecutive ready days from today", () => {
    const ready = new Set(["2026-11-09", "2026-11-10", "2026-11-12"]);
    expect(consecutiveReadyDays("2026-11-09", ready, addDays)).toBe(2);
    expect(consecutiveReadyDays("2026-11-11", ready, addDays)).toBe(0);
  });
});
