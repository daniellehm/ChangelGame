import { describe, expect, it } from "vitest";
import { decodeShareCode, encodeShareCode, shareTeaser, shareText, shareUrl } from "@/lib/game/share";

describe("shareText", () => {
  it("matches the spec's exact format", () => {
    expect(shareText(12, 412, ["nailed", "close", "nailed", "wrong", "nailed"])).toBe(
      "Changel #12 ⇅ 412/500\n🟩🟨🟩🟥🟩\nchangel.app",
    );
  });
  it("uses 🟥 for both Way off and Wrong way, 🟧 for Meh", () => {
    expect(shareText(1, 50, ["off", "wrong", "meh", "meh", "off"]).split("\n")[1]).toBe("🟥🟥🟧🟧🟥");
  });
});

describe("share code (?r=)", () => {
  const r = { number: 12, total: 372, tiers: ["nailed", "close", "nailed", "wrong", "nailed"] as const }; // 412 would be impossible with a wrong-way round

  it("round-trips the puzzle number, total and each round's result", () => {
    const code = encodeShareCode({ ...r, tiers: [...r.tiers] });
    expect(code).toBe("c-ac-01040");
    expect(decodeShareCode(code)).toEqual({ ...r, tiers: [...r.tiers] });
    expect(shareUrl({ ...r, tiers: [...r.tiers] })).toBe("https://changel.app/?r=c-ac-01040");
  });

  it("rejects malformed or impossible codes (the total must fit the rounds)", () => {
    for (const bad of [null, "", "c-bg", "c-bg-0104", "c-bg-01045", "C-BG-01040", "0-bg-01040", "c-bg-01040x", "<script>"]) expect(decodeShareCode(bad), String(bad)).toBeNull();
    expect(decodeShareCode("c-0-00000")).toBeNull(); // five "nailed it" can't total 0
    expect(decodeShareCode(`c-${(500).toString(36)}-00000`)).not.toBeNull();
    expect(decodeShareCode(`c-${(1).toString(36)}-44444`)).toBeNull(); // five "wrong way" score exactly 0
  });

  it("the share sheet gets the text without the link line", () => {
    expect(shareTeaser(12, 372, [...r.tiers])).toBe("Changel #12 ⇅ 372/500\n🟩🟨🟩🟥🟩");
  });
});
