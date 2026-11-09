"use client";

import type { KeyboardEvent } from "react";
import { SLIDER } from "@/lib/config";
import { multSpoken } from "@/lib/format";
import { keyboardMove, snapPointer } from "@/lib/slider";

interface Props {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function Slider({ value, onChange, disabled }: Props) {
  // Keyboard moves are handled here so they are exact and never snap: arrows can step away from 0.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const v = keyboardMove(value, e.key);
    if (v === null) return;
    e.preventDefault();
    onChange(v);
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
