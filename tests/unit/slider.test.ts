import { describe, expect, it } from "vitest";
import { FULL_RANGE as F, rangeFromFactor } from "@/lib/range";
import { keyboardMove, nudge, snapPointer, toStep } from "@/lib/slider";

describe("slider maths", () => {
  it("arrows move exactly one step (0.005) and never snap back to 0", () => {
    expect(keyboardMove(F, 0, "ArrowRight")).toBe(0.005);
    expect(keyboardMove(F, 0, "ArrowUp")).toBe(0.005);
    expect(keyboardMove(F, 0.005, "ArrowLeft")).toBe(0);
    expect(keyboardMove(F, 0, "ArrowDown")).toBe(-0.005);
  });
  it("Page Up/Down move 0.1; Home/End go to the ends", () => {
    expect(keyboardMove(F, 0.38, "PageUp")).toBe(0.48);
    expect(keyboardMove(F, 0, "PageDown")).toBe(-0.1);
    expect(keyboardMove(F, 1, "Home")).toBe(-3);
    expect(keyboardMove(F, 1, "End")).toBe(3);
    expect(keyboardMove(F, 2.95, "PageUp")).toBe(3);
    expect(keyboardMove(F, 0, "a")).toBeNull();
  });
  it("pointer input snaps to exactly 0 within ±0.01", () => {
    expect(snapPointer(F, 0.01)).toBe(0);
    expect(snapPointer(F, -0.01)).toBe(0);
    expect(snapPointer(F, 0.005)).toBe(0);
    expect(snapPointer(F, 0.015)).toBe(0.015);
    expect(snapPointer(F, -0.4)).toBe(-0.4);
  });
  it("nudges move ±0.05 without float drift and clamp to the range", () => {
    expect(nudge(F, 0.1, 1)).toBe(0.15);
    expect(nudge(F, 0, -1)).toBe(-0.05);
    expect(nudge(F, 2.98, 1)).toBe(3);
    let v = 0;
    for (let i = 0; i < 7; i++) v = nudge(F, v, 1);
    expect(v).toBe(0.35);
  });
  it("toStep rounds to the 0.005 grid", () => {
    expect(toStep(F, 0.1234)).toBe(0.125);
    expect(toStep(F, -7)).toBe(-3);
  });

});

describe("slider maths on a narrow range (UN members, max_change 8)", () => {
  const r = rangeFromFactor(8);
  it("ends are the range bounds, not ÷1000/×1000", () => {
    expect(keyboardMove(r, 0, "Home")).toBeCloseTo(-Math.log10(8), 12);
    expect(keyboardMove(r, 0, "End")).toBeCloseTo(Math.log10(8), 12);
    expect(toStep(r, 5)).toBe(r.hi);
    expect(toStep(r, -5)).toBe(r.lo);
  });
  it("steps scale with the range: 1200 steps, 120 nudges end to end", () => {
    const w = r.hi - r.lo;
    expect(keyboardMove(r, 0, "ArrowRight")).toBeCloseTo(w / 1200, 5);
    expect(nudge(r, 0, 1)).toBeCloseTo(w / 120, 5);
  });
  it("0 stays reachable and pointer still snaps to it", () => {
    expect(keyboardMove(r, keyboardMove(r, 0, "ArrowRight")!, "ArrowLeft")).toBe(0);
    expect(snapPointer(r, 0.0005)).toBe(0);
  });
});
