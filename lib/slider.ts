/** Pure slider maths (SPEC §2, §9), relative to the question's range (lib/range.ts). */
import { clampTo, sliderSteps, type GuessRange } from "./range";

/** Round to the slider step (anchored at 0, so "no change" is always reachable) and clamp. */
export function toStep(r: GuessRange, v: number): number {
  const { step } = sliderSteps(r);
  return clampTo(r, Number((Math.round(v / step) * step).toFixed(6)));
}

/** Pointer drags snap to exactly 0 within ±snap so "no change" is easy to hit. */
export function snapPointer(r: GuessRange, v: number): number {
  return Math.abs(v) <= sliderSteps(r).snap ? 0 : toStep(r, v);
}

/** Keyboard: arrows move one step, Page Up/Down move a page, Home/End go to the ends. No snapping. */
export function keyboardMove(r: GuessRange, value: number, key: string): number | null {
  const { step, page } = sliderSteps(r);
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return toStep(r, value + step);
    case "ArrowLeft":
    case "ArrowDown":
      return toStep(r, value - step);
    case "PageUp":
      return toStep(r, value + page);
    case "PageDown":
      return toStep(r, value - page);
    case "Home":
      return r.lo;
    case "End":
      return r.hi;
    default:
      return null;
  }
}

/** "− a bit" / "+ a bit". */
export function nudge(r: GuessRange, value: number, direction: 1 | -1): number {
  return toStep(r, value + direction * sliderSteps(r).nudge);
}
