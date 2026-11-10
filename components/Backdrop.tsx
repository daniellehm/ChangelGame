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
const fadeOut = (p: number, from: number) => (p > from ? 1 - (p - from) / (1 - from) : 1);

type Building = { x: number; w: number; h0: number; h1: number; d: number };
type Dot = { x: number; y: number };
type Line = { up: boolean; pts: Array<[number, number]>; delay: number };

const SCENES: Scene[] = [
  {
    // Rising skyline: buildings along the bottom grow taller over the loop.
    init(w, h) {
      const r = rng(7);
      const b: Building[] = [];
      for (let x = -10; x < w + 10; ) {
        const bw = 14 + r() * 26;
        b.push({ x, w: bw, h0: 18 + r() * 40, h1: 70 + r() * (h * 0.42), d: r() });
        x += bw + 3;
      }
      return b;
    },
    draw(ctx, w, h, t, b: Building[]) {
      const p = (t % 18) / 18;
      const fade = fadeOut(p, 0.92);
      for (const k of b) {
        const local = Math.min(1, Math.max(0, p * 1.4 - k.d * 0.4));
        const e = 1 - Math.pow(1 - local, 3);
        const hh = k.h0 + (k.h1 - k.h0) * e;
        ctx.fillStyle = rgba(INK, 0.055 * fade);
        ctx.fillRect(k.x, h - hh, k.w, hh);
        ctx.fillStyle = rgba(UP, 0.05 * fade * e);
        for (let y = h - hh + 6; y < h - 6; y += 9) for (let x = k.x + 4; x < k.x + k.w - 4; x += 7) if ((x * 7 + y) % 5 < 2) ctx.fillRect(x, y, 2, 3);
      }
    },
  },
  {
    // Multiplying dots: a few dots double until the screen is full, then reset.
    init(w, h) {
      const r = rng(42);
      const n = Math.min(2400, Math.round((w * h) / 380));
      return Array.from({ length: n }, () => ({ x: r() * w, y: r() * h }));
    },
    draw(ctx, w, h, t, dots: Dot[]) {
      const p = (t % 16) / 16;
      const n = Math.min(dots.length, Math.floor(4 * Math.pow(2, p * Math.log2(dots.length / 4) * 1.05)));
      const fade = fadeOut(p, 0.9);
      const fresh = Math.floor(n * 0.88);
      for (let i = 0; i < n; i++) {
        const d = dots[i]!;
        ctx.fillStyle = i >= fresh ? rgba(UP, 0.16 * fade) : rgba(INK, 0.075 * fade);
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    // Trend lines: faint red-up and blue-down lines draw themselves across.
    init(w, h) {
      const r = rng(99);
      return Array.from({ length: Math.max(4, Math.round(w / 140)) }, (_, i) => {
        const up = i % 3 !== 2;
        const pts: Array<[number, number]> = [];
        let y = h * (0.15 + r() * 0.75);
        for (let x = 0; x <= w; x += 6) {
          y += (up ? -1 : 1) * (0.35 + r() * 0.9) * (h / 700) + (r() - 0.5) * 3.2;
          pts.push([x, y]);
        }
        return { up, pts, delay: r() * 0.35 };
      });
    },
    draw(ctx, _w, _h, t, lines: Line[]) {
      const p = (t % 20) / 20;
      const fade = fadeOut(p, 0.88);
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const L of lines) {
        const upto = Math.floor(L.pts.length * Math.min(1, Math.max(0, (p - L.delay) / 0.55)));
        if (upto < 2) continue;
        ctx.strokeStyle = rgba(L.up ? UP : DOWN, 0.13 * fade);
        ctx.beginPath();
        ctx.moveTo(...L.pts[0]!);
        for (let i = 1; i < upto; i++) ctx.lineTo(...L.pts[i]!);
        ctx.stroke();
        const [ex, ey] = L.pts[upto - 1]!;
        ctx.fillStyle = rgba(L.up ? UP : DOWN, 0.2 * fade);
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
      if (still) return paint(7); // reduced motion: one still frame
      started = performance.now() - Math.random() * 8000; // start mid-loop, not always empty
      raf = requestAnimationFrame(loop);
    };
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        size();
        if (still) paint(7);
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
