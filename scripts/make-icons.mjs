/**
 * Generates the web app manifest icons from the logo (app/icon.svg's drawing).
 *   node scripts/make-icons.mjs
 * - icon-192.png, icon-512.png: the rounded logo, transparent corners.
 * - icon-maskable-512.png: full-bleed ink with the arrows inside Android's safe zone,
 *   so launchers can crop it to a circle or squircle without clipping the arrows.
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";

const logo = readFileSync("app/icon.svg");
const arrows = `<g fill="none" stroke="#f6f1e7" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 47V18M13.5 27.5 23 17.5l9.5 10"/><path d="M41 17v29M31.5 36.5 41 46.5l9.5-10"/></g>`;
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#16130f"/><g transform="translate(32 32) scale(0.72) translate(-32 -32)">${arrows}</g></svg>`);

for (const size of [192, 512]) await sharp(logo, { density: 600 }).resize(size, size).png().toFile(`public/icon-${size}.png`);
await sharp(maskable, { density: 600 }).resize(512, 512).png().toFile("public/icon-maskable-512.png");
console.log("icons written to public/");
