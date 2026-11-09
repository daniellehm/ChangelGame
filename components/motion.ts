"use client";

/**
 * Motion & juice helpers (design pass). Everything here is skipped when the
 * player prefers reduced motion; the CSS reduced-motion block covers the rest.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when the player prefers reduced motion. Server render assumes motion is reduced (nothing animates before hydration). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => true);
}

/** Counts from 0 up to `to` over `ms` (ease-out) when `enabled`; otherwise returns `to` immediately. */
export function useCountUp(to: number, enabled: boolean, ms = 600): number {
  const [value, setValue] = useState(enabled ? 0 : to);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setValue(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, enabled, ms]);
  return enabled ? value : to;
}

/** Short haptic tick where supported (Android Chrome); a no-op elsewhere. */
export function buzz(ms = 8): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/** One confetti burst from the centre of `from`, drawn on a temporary full-screen canvas. */
export function confetti(from: Element | null): void {
  if (typeof window === "undefined" || window.matchMedia(QUERY).matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const css = getComputedStyle(document.documentElement);
  const colours = ["--up", "--down", "--g", "--y", "--o"].map((v) => css.getPropertyValue(v).trim() || "#16130f");
  const b = from?.getBoundingClientRect() ?? { left: W / 2, top: H / 3, width: 0, height: 0 };
  const ox = b.left + b.width / 2;
  const oy = b.top + b.height / 2;
  const parts = Array.from({ length: 90 }, () => ({
    x: ox, y: oy,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3,
    w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colours[Math.floor(Math.random() * colours.length)]!,
  }));
  const DURATION = 1600;
  const t0 = performance.now();
  const frame = (t: number) => {
    const el = t - t0;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - el / DURATION);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (el < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
