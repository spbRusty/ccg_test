import { describe, expect, it } from "vitest";
import { getRoundResolutionOrder } from "./round-order";

describe("round resolution order", () => {
  it("gives priority to the player with lower Stability", () => {
    expect(getRoundResolutionOrder(12, 20, () => 0.9)).toEqual(["player", "enemy"]);
    expect(getRoundResolutionOrder(20, 12, () => 0.1)).toEqual(["enemy", "player"]);
  });

  it("uses the random tie-break only when Stability is equal", () => {
    expect(getRoundResolutionOrder(15, 15, () => 0.1)).toEqual(["player", "enemy"]);
    expect(getRoundResolutionOrder(15, 15, () => 0.9)).toEqual(["enemy", "player"]);
  });

  it("returns each side exactly once", () => {
    for (const [player, enemy] of [[1, 2], [2, 1], [3, 3]] as const) {
      const order = getRoundResolutionOrder(player, enemy, () => 0.25);
      expect(order).toHaveLength(2);
      expect(new Set(order)).toEqual(new Set(["player", "enemy"]));
    }
  });
});
