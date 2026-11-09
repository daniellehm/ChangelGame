import { describe, expect, it } from "vitest";
import { mergeNote } from "@/components/SaveStreak";

describe("mergeNote", () => {
  it("plain sign-in", () => {
    expect(mergeNote(null)).toBe("Done. You're signed in on this browser.");
    expect(mergeNote({ merged: 0, kept: 0, replaced: 0 })).toBe("Done. You're signed in on this browser.");
  });
  it("replay of a day the account already played: the first score stands", () => {
    expect(mergeNote({ merged: 0, kept: 1, replaced: 0 })).toBe(
      "Signed in. You'd already played that day on your account, so your first score stands. This device's replay was discarded.",
    );
  });
  it("new games added", () => {
    expect(mergeNote({ merged: 2, kept: 0, replaced: 0 })).toBe("Signed in. 2 games from this device were added to your account.");
  });
  it("mixed", () => {
    expect(mergeNote({ merged: 3, kept: 1, replaced: 1 })).toContain("2 games from this device were added");
  });
});
