"use client";

import type { KeyboardEvent } from "react";
import { SLIDER } from "@/lib/config";
import { multSpoken } from "@/lib/format";

/** Round to the slider step to avoid float drift (e.g. 0.1 + 0.05). */
export function toStep(v: number): number {
  const stepped = Math.round(v / SLIDER.STEP) * SLIDER.STEP;
  return Math.min(SLIDER.MAX, Math.max(SLIDER.MIN, Number(stepped.toFixed(3))));
}

/** Pointer drags snap to exactly 0 near the middle so "no change" is easy to hit. */
export function snapPointer(v: number): number {
  return Math.abs(v) <= SLIDER.SNAP ? 0 : toStep(v);
}

const KEY_STEPS: Record<string, number> = {
  ArrowRight: SLIDER.STEP,
  ArrowUp: SLIDER.STEP,
  ArrowLeft: -SLIDER.STEP,
  ArrowDown: -SLIDER.STEP,
  PageUp: SLIDER.PAGE,
  PageDown: -SLIDER.PAGE,
};

interface Props {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function Slider({ value, onChange, disabled }: Props) {
  // Keyboard moves are exact (no snap), so arrows can step away from 0.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      onChange(e.key === "Home" ? SLIDER.MIN : SLIDER.MAX);
      return;
    }
    const d = KEY_STEPS[e.key];
    if (d === undefined) return;
    e.preventDefault();
    onChange(toStep(value + d));
  };

  return (
    <input
      type="range"
      id="slider"
      min={SLIDER.MIN}
      max={SLIDER.MAX}
      step={SLIDER.STEP}
      value={value}
      disabled={disabled}
      aria-label="Your guess"
      aria-valuetext={multSpoken(value)}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(snapPointer(parseFloat(e.currentTarget.value)))}
    />
  );
}
