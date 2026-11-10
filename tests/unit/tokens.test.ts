import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rootBlock = css.match(/:root\{[\s\S]*?\}/)?.[0] ?? "";
const rest = css.replace(rootBlock, "");

describe("design tokens", () => {
  it("defines the spec tokens with the spec values", () => {
    const tokens: Record<string, string> = {
      "--bg": "#f6f1e7", "--ink": "#16130f", "--muted": "#6e665b" /* spec #7a7166, darkened for AA (DECISIONS item 12) */, "--card": "#fffdf8",
      "--line": "#e3dacb", "--up": "#ff5a36", "--down": "#2f7cf6",
      "--g": "#2bb673", "--y": "#f3c13a", "--o": "#ff8a3d", "--r": "#e5484d",
    };
    for (const [k, v] of Object.entries(tokens)) expect(rootBlock).toContain(`${k}:${v}`);
  });

  it("has no hard-coded colours outside :root (dark mode must be a token swap)", () => {
    expect(rest.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(rest.match(/\brgba?\(/g)).toBeNull();
  });

  it("disables motion under prefers-reduced-motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
