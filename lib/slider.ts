/** Pure slider maths (SPEC §2, §9). */
import { SLIDER } from "./config";

export function clampToSlider(v: number): number {
  return Math.min(SLIDER.MAX, Math.max(SLIDER.MIN, v));
}

/** Round to the slider step to avoid float drift (e.g. 0.1 + 0.05). */
export function toStep(v: number): number {
  return clampToSlider(Number((Math.round(v / SLIDER.STEP) * SLIDER.STEP).toFixed(3)));
}

/** Pointer drags snap to exactly 0 within ±SNAP so "no change" is easy to hit. */
export function snapPointer(v: number): number {
  return Math.abs(v) <= SLIDER.SNAP ? 0 : toStep(v);
}

/** Keyboard: arrows move one step, Page Up/Down move PAGE, Home/End go to the ends. No snapping. */
export function keyboardMove(value: number, key: string): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return toStep(value + SLIDER.STEP);
    case "ArrowLeft":
    case "ArrowDown":
      return toStep(value - SLIDER.STEP);
    case "PageUp":
      return toStep(value + SLIDER.PAGE);
    case "PageDown":
      return toStep(value - SLIDER.PAGE);
    case "Home":
      return SLIDER.MIN;
    case "End":
      return SLIDER.MAX;
    default:
      return null;
  }
}

/** "− a bit" / "+ a bit". */
export function nudge(value: number, direction: 1 | -1): number {
  return toStep(value + direction * SLIDER.NUDGE);
}
