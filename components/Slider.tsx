"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { multSpoken } from "@/lib/format";
import { epsilon, toPercent, type GuessRange } from "@/lib/range";
import { keyboardMove, snapPointer } from "@/lib/slider";

interface Props {
  value: number;
  range: GuessRange;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function Slider({ value, range, onChange, disabled }: Props) {
  // Keyboard moves are handled here so they are exact and never snap: arrows can step away from 0.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const v = keyboardMove(range, value, e.key);
    if (v === null) return;
    e.preventDefault();
    onChange(v);
  };

  return (
    <input
      type="range"
      id="slider"
      min={range.lo}
      max={range.hi}
      // "any": a native step grid would be anchored at the left end and could make exact 0 unreachable; lib/slider rounds instead.
      step="any"
      value={value}
      disabled={disabled}
      aria-label="Your guess"
      aria-valuetext={multSpoken(value, epsilon(range))}
      // The track's down/up colour split sits at "no change", wherever that is on this question's range.
      style={{ "--zero": `${toPercent(range, 0)}%` } as CSSProperties}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(snapPointer(range, parseFloat(e.currentTarget.value)))}
    />
  );
}
