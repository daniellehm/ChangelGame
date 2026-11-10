import { describe, expect, it } from "vitest";
import { crowdLine, NEUTRAL_LINE, todaysTrap, type RoundCrowd } from "@/lib/game/crowd";

const r = (position: number, plays: number, wrong_way: number, nailed: number, avg_points: number): RoundCrowd => ({ position, plays, wrong_way, nailed, avg_points });

describe("crowd line", () => {
  it("is neutral until a round has 50 plays", () => {
    expect(crowdLine(undefined)).toBe(NEUTRAL_LINE);
    expect(crowdLine(r(1, 49, 40, 0, 10))).toBe(NEUTRAL_LINE);
  });
  it("leads with the wrong-way share when at least 20% went the wrong way", () => {
    expect(crowdLine(r(1, 200, 76, 10, 30))).toBe("38% of players went the wrong way");
    expect(crowdLine(r(1, 50, 10, 0, 30))).toBe("20% of players went the wrong way");
  });
  it("otherwise reports how many nailed it ('Only' when under 25%)", () => {
    expect(crowdLine(r(1, 100, 5, 9, 40))).toBe("Only 9% nailed this");
    expect(crowdLine(r(1, 100, 5, 61, 80))).toBe("61% of players nailed this");
  });
});

describe("today's trap", () => {
  it("is the round with the lowest average, once every round has 50 plays", () => {
    const day = [r(1, 60, 1, 30, 70), r(2, 60, 30, 2, 22.5), r(3, 60, 2, 20, 55), r(4, 60, 5, 10, 48), r(5, 60, 0, 40, 81)];
    expect(todaysTrap(day, 5)?.position).toBe(2);
    expect(todaysTrap(day.slice(0, 4), 5)).toBeNull();
    expect(todaysTrap([...day.slice(0, 4), r(5, 49, 0, 40, 1)], 5)).toBeNull();
  });
});
