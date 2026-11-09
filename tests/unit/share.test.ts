import { describe, expect, it } from "vitest";
import { shareText } from "@/lib/game/share";

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
