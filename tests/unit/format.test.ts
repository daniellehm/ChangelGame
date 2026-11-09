import { describe, expect, it } from "vitest";
import { formatValue, isFormat, multLabel, multSpoken, pctChange, sig, type Format } from "@/lib/format";
import { loadPrototype } from "../helpers/prototype";

const proto = loadPrototype();

describe("formatValue", () => {
  it.each<[number, Format, string]>([
    // big
    [8.2e9, "big", "8.2 billion"],
    [4.07e9, "big", "4.07 billion"],
    [57.4e6, "big", "57.4 million"],
    [1808581, "big", "1.81 million"],
    [31655, "big", "31,655"],
    [999, "big", "999"],
    [12.345, "big", "12.3"],
    [1.29e12, "big", "1290 billion"], // prototype has no "trillion"
    // int
    [40199, "int", "40,199"],
    [51.4, "int", "51"],
    // usd: ≥1000, ≥1, cents, tiny
    [94400, "usd", "$94,400"],
    [7.25, "usd", "$7.25"],
    [0.78, "usd", "78¢"],
    [0.06, "usd", "6¢"],
    [0.00423, "usd", "$0.0042"],
    // aud mirrors usd with A$
    [1234.4, "aud", "A$1,234"],
    [2.5, "aud", "A$2.50"],
    [0.4, "aud", "40¢"],
    [0.005, "aud", "A$0.005"],
    // sec, m, yrs
    [9.58, "sec", "9.58s"],
    [828.4, "m", "828 m"],
    [46, "yrs", "46 yrs"],
    [7.25, "yrs", "7.3 yrs"],
    // time h:mm:ss
    [7796, "time", "2:09:56"],
    [8466, "time", "2:21:06"],
    [59.6, "time", "0:01:00"],
    // pct
    [45, "pct", "45%"],
    [3.456, "pct", "3.46%"],
  ])("%s as %s → %s", (v, f, out) => {
    expect(formatValue(v, f)).toBe(out);
  });

  it("matches the prototype for every start and end value in its pool", () => {
    for (const p of proto.POOL) {
      expect(isFormat(p.fmt)).toBe(true);
      expect(formatValue(p.v0, p.fmt as Format), p.q).toBe(proto.fmt(p.v0, p.fmt));
      expect(formatValue(p.v1, p.fmt as Format), p.q).toBe(proto.fmt(p.v1, p.fmt));
    }
  });

  it("matches the prototype for implied end values across the slider", () => {
    for (const p of proto.POOL) {
      for (let g = -3; g <= 3; g += 0.125) {
        const v = p.v0 * Math.pow(10, g);
        expect(formatValue(v, p.fmt as Format), `${p.q} g=${g}`).toBe(proto.fmt(v, p.fmt));
      }
    }
  });

  it("sig rounds to significant figures", () => {
    expect(sig(123456)).toBe(123000);
    expect(sig(0.0012345, 2)).toBe(0.0012);
  });
});

describe("multLabel / pctChange", () => {
  it("shows no change within ε", () => {
    expect(multLabel(0)).toMatchObject({ big: "×1", sub: "no change", cls: "" });
    expect(multLabel(0.0039).big).toBe("×1");
    expect(multLabel(-0.0039).big).toBe("×1");
  });

  it("formats increases", () => {
    expect(multLabel(Math.log10(2.4))).toMatchObject({ big: "×2.40", sub: "+140% bigger", cls: "up" });
    expect(multLabel(Math.log10(13)).big).toBe("×13.0");
    expect(multLabel(3)).toMatchObject({ big: "×1,000", sub: "+99,900% bigger" });
  });

  it("formats decreases", () => {
    expect(multLabel(-Math.log10(3.1))).toMatchObject({ big: "÷3.10", sub: "68% smaller", cls: "down" });
    expect(pctChange(1 / 3.1)).toBe("68%");
    expect(multLabel(-0.01).sub).toBe("2.3% smaller");
  });

  it("matches the prototype across the whole slider range", () => {
    for (let i = -600; i <= 600; i++) {
      const l = i * 0.005;
      const ours = multLabel(l);
      const theirs = proto.multLabel(l);
      expect([ours.big, ours.sub, ours.cls], `l=${l}`).toEqual([theirs.big, theirs.sub, theirs.cls]);
    }
  });
});

describe("multSpoken (aria-valuetext)", () => {
  it.each([
    [0, "no change"],
    [Math.log10(2.4), "2.4 times bigger"],
    [-Math.log10(3.1), "3.1 times smaller"],
    [Math.log10(12.34), "12.3 times bigger"],
    [3, "1,000 times bigger"],
    [-3, "1,000 times smaller"],
  ])("%f → %s", (l, out) => {
    expect(multSpoken(l)).toBe(out);
  });
});
