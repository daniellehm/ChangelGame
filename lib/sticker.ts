/**
 * Sticker look (design pass): each category gets a stable colour and tilt, so
 * "Money" always looks the same and a day's rounds look varied.
 */
const COLORS = ["var(--y)", "var(--g)", "var(--o)", "var(--slider-down-mid)", "var(--slider-up-mid)"] as const;
const TILTS = [-3, 2, -2, 3, -1] as const;

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export interface StickerStyle {
  color: string;
  tiltDeg: number;
}

export function stickerFor(category: string): StickerStyle {
  const h = hash(category.trim().toLowerCase());
  return { color: COLORS[h % COLORS.length]!, tiltDeg: TILTS[Math.floor(h / COLORS.length) % TILTS.length]! };
}
