import { describe, expect, it } from "vitest";
import { keyboardMove, nudge, snapPointer, toStep } from "@/lib/slider";

describe("slider maths", () => {
  it("arrows move exactly one step (0.005) and never snap back to 0", () => {
    expect(keyboardMove(0, "ArrowRight")).toBe(0.005);
    expect(keyboardMove(0, "ArrowUp")).toBe(0.005);
    expect(keyboardMove(0.005, "ArrowLeft")).toBe(0);
    expect(keyboardMove(0, "ArrowDown")).toBe(-0.005);
  });
  it("Page Up/Down move 0.1; Home/End go to the ends", () => {
    expect(keyboardMove(0.38, "PageUp")).toBe(0.48);
    expect(keyboardMove(0, "PageDown")).toBe(-0.1);
    expect(keyboardMove(1, "Home")).toBe(-3);
    expect(keyboardMove(1, "End")).toBe(3);
    expect(keyboardMove(2.95, "PageUp")).toBe(3);
    expect(keyboardMove(0, "a")).toBeNull();
  });
  it("pointer input snaps to exactly 0 within ±0.01", () => {
    expect(snapPointer(0.01)).toBe(0);
    expect(snapPointer(-0.01)).toBe(0);
    expect(snapPointer(0.005)).toBe(0);
    expect(snapPointer(0.015)).toBe(0.015);
    expect(snapPointer(-0.4)).toBe(-0.4);
  });
  it("nudges move ±0.05 without float drift and clamp to the range", () => {
    expect(nudge(0.1, 1)).toBe(0.15);
    expect(nudge(0, -1)).toBe(-0.05);
    expect(nudge(2.98, 1)).toBe(3);
    let v = 0;
    for (let i = 0; i < 7; i++) v = nudge(v, 1);
    expect(v).toBe(0.35);
  });
  it("toStep rounds to the 0.005 grid", () => {
    expect(toStep(0.1234)).toBe(0.125);
    expect(toStep(-7)).toBe(-3);
  });
});
