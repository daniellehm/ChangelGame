"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Faint animated background behind the card (Dani 2026-11-10): one of three scenes about the
 * world changing over time, picked at random on each visit. Starts after the page is idle
 * (never competes with the first paint), ≤30 fps, pauses while the tab is hidden, dims during
 * rounds (CSS), a still frame under reduced motion, and off in automated test browsers.
 */
type Scene = {
  init: (w: number, h: number) => unknown;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, state: never) => void;
};

const INK = "22,19,15";
const UP = "255,90,54";
const DOWN = "47,124,246";
const rgba = (c: string, a: number) => `rgba(${c},${a})`;
/** Seeded random, so a scene looks the same every time it's picked. */
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/*
 * Every scene runs indefinitely (Dani 2026-11-10: it built up and vanished too quickly).
 * Each builds up over a minute or more and then keeps changing, never emptying or resetting.
 */
type Building = { x: number; w: number; h0: number; h1: number; period: number; offset: number };
type Dot = { x: number; y: number; phase: number };
type LineSlot = { up: boolean; period: number; offset: number; seed: number };
type LineState = { w: number; h: number; slots: LineSlot[]; cache: Map<string, Array<[number, number]>> };

const SCENES: Scene[] = [
  {
    // Rising skyline: each building grows over 1–2.5 minutes, then is knocked down and rebuilt,
    // all at different times, so the city is always standing and always changing.
    init(w, h) {
      const r = rng(7);
      const b: Building[] = [];
      for (let x = -10; x < w + 10; ) {
        const bw = 14 + r() * 26;
        b.push({ x, w: bw, h0: 14 + r() * 30, h1: 70 + r() * (h * 0.45), period: 60 + r() * 90, offset: r() });
        x += bw + 3;
      }
      return b;
    },
    draw(ctx, _w, h, t, b: Building[]) {
      for (const k of b) {
        const c = (t / k.period + k.offset) % 1;
        // Grow for 90% of the cycle, then a quick rebuild down to its base.
        const e = c < 0.9 ? easeOut(c / 0.9) : 1 - easeOut((c - 0.9) / 0.1);
        const hh = k.h0 + (k.h1 - k.h0) * e;
        ctx.fillStyle = rgba(INK, 0.055);
        ctx.fillRect(k.x, h - hh, k.w, hh);
        ctx.fillStyle = rgba(UP, 0.05 * e);
        for (let y = h - hh + 6; y < h - 6; y += 9) for (let x = k.x + 4; x < k.x + k.w - 4; x += 7) if ((x * 7 + y) % 5 < 2) ctx.fillRect(x, y, 2, 3);
      }
    },
  },
  {
    // Multiplying dots: start with a visible handful (~3% of the screen's dots), double every
    // 6 s until full (~30 s), then stay full, twinkling, with occasional orange "newborns".
    init(w, h) {
      const r = rng(42);
      const n = Math.min(2400, Math.round((w * h) / 380));
      return Array.from({ length: n }, () => ({ x: r() * w, y: r() * h, phase: r() * Math.PI * 2 }));
    },
    draw(ctx, _w, _h, t, dots: Dot[]) {
      const start = Math.max(30, Math.round(dots.length * 0.03));
      const n = Math.min(dots.length, Math.floor(start * Math.pow(2, t / 6)));
      const growing = n < dots.length;
      for (let i = 0; i < n; i++) {
        const d = dots[i]!;
        // While growing, the newest eighth glows; once full, dots take turns glowing.
        const glow = growing ? i >= n * 0.88 : Math.sin(t * 0.35 + d.phase * 7) > 0.985;
        const twinkle = growing ? 1 : 0.75 + 0.25 * Math.sin(t * 0.6 + d.phase);
        ctx.fillStyle = glow ? rgba(UP, 0.2) : rgba(INK, 0.1 * twinkle);
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    // Trend lines: each line takes ~35–55 s to draw across, stays a while, then fades as the
    // next one in its slot starts. Slots are staggered, so several are always on screen.
    init(w, h) {
      const r = rng(99);
      const slots = Array.from({ length: Math.max(8, Math.round(w / 70)) }, (_, i) => ({ up: i % 3 !== 2, period: 55 + r() * 30, offset: r(), seed: 1 + Math.floor(r() * 1e6) }));
      return { w, h, slots, cache: new Map() } satisfies LineState;
    },
    draw(ctx, _w, _h, t, st: LineState) {
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const slot of st.slots) {
        const cycles = t / slot.period + slot.offset;
        const n = Math.floor(cycles);
        const c = cycles - n;
        // A fresh line each cycle (seeded by slot and cycle), cached while it's on screen.
        const key = `${slot.seed}:${n}`;
        let pts = st.cache.get(key);
        if (!pts) {
          const r = rng(slot.seed + n * 7919);
          pts = [];
          // Lines are spread evenly down the screen (so some always run outside the card).
          const band = (st.slots.indexOf(slot) + 0.5) / st.slots.length;
          let y = st.h * (0.06 + band * 0.9) + (r() - 0.5) * (st.h / st.slots.length) * 0.6;
          if (slot.up) y += st.h * 0.06; // start a little low so the rise stays on screen
          else y -= st.h * 0.06;
          for (let x = 0; x <= st.w; x += 6) {
            y += (slot.up ? -1 : 1) * (0.5 + r() * 1.1) * (st.h / 1000) * (900 / Math.max(400, st.w)) + (r() - 0.5) * 3.2;
            pts.push([x, y]);
          }
          st.cache.set(key, pts);
          if (st.cache.size > st.slots.length * 2) st.cache.delete(st.cache.keys().next().value!);
        }
        // Draw for 65% of the cycle, hold for 25%, fade over the last 10%.
        const upto = Math.floor(pts.length * Math.min(1, c / 0.65));
        if (upto < 2) continue;
        const fade = c > 0.9 ? 1 - (c - 0.9) / 0.1 : 1;
        ctx.strokeStyle = rgba(slot.up ? UP : DOWN, 0.13 * fade);
        ctx.beginPath();
        ctx.moveTo(...pts[0]!);
        for (let i = 1; i < upto; i++) ctx.lineTo(...pts[i]!);
        ctx.stroke();
        const [ex, ey] = pts[upto - 1]!;
        ctx.fillStyle = rgba(slot.up ? UP : DOWN, 0.2 * fade);
        ctx.beginPath();
        ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
];

export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  const hidden = usePathname()?.startsWith("/admin") ?? false;

  useEffect(() => {
    const canvas = ref.current;
    if (hidden || !canvas || navigator.webdriver) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // ?bg=skyline|dots|lines forces one scene (for previews); otherwise random per visit.
    const forced = ["skyline", "dots", "lines"].indexOf(new URLSearchParams(location.search).get("bg") ?? "");
    const scene = SCENES[forced >= 0 ? forced : Math.floor(Math.random() * SCENES.length)]!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let state: unknown = null;
    let raf = 0;
    let last = 0;
    let started = 0;
    let cancelled = false;

    const size = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = scene.init(w, h);
    };
    const paint = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      scene.draw(ctx, w, h, t, state as never);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 33) return; // ≤30 fps, nothing while hidden
      last = now;
      paint((now - started) / 1000);
    };
    const begin = () => {
      if (cancelled) return;
      size();
      canvas.classList.add("on");
      if (still) return paint(90); // reduced motion: one still frame, fully built
      // ?bgt=SECONDS fast-forwards (for previews). Dots start small and multiply; skyline and lines are staggered already.
      const skip = Number(new URLSearchParams(location.search).get("bgt")) || 0;
      started = performance.now() - Math.min(3600, Math.max(0, skip)) * 1000;
      raf = requestAnimationFrame(loop);
    };
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        size();
        if (still) paint(90);
      }, 150);
    };
    // Only once the page has loaded and gone idle, so it never competes with the first paint.
    const idle = () => ("requestIdleCallback" in window ? window.requestIdleCallback(begin, { timeout: 3000 }) : setTimeout(begin, 1500));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener("load", idle);
      window.removeEventListener("resize", onResize);
    };
  }, [hidden]);

  if (hidden) return null;
  return <canvas ref={ref} className="backdrop" aria-hidden="true" />;
}
