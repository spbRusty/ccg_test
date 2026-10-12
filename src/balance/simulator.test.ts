import { describe, expect, it } from "vitest";
import { simulateBatch, simulateMatch } from "./simulator";

describe("balance match simulator", () => {
  it("repeats the same seeded match exactly", () => {
    const first = simulateMatch(12345, { maxTurns: 30 });
    const second = simulateMatch(12345, { maxTurns: 30 });
    expect(second).toEqual(first);
  });

  it("keeps matches bounded and reports finite state metrics", () => {
    const result = simulateMatch(77, { maxTurns: 20 });
    expect(result.turns).toBeGreaterThanOrEqual(1);
    expect(result.turns).toBeLessThanOrEqual(20);
    expect(Number.isFinite(result.playerTime)).toBe(true);
    expect(Number.isFinite(result.opponentTime)).toBe(true);
    expect(result.playerCardsPlayed).toBeGreaterThanOrEqual(0);
    expect(["player", "opponent", "draw", "turn-limit"]).toContain(result.winner);
  });

  it("aggregates match batches consistently", () => {
    const batch = simulateBatch(8, 900, { maxTurns: 20 });
    expect(batch.matches).toBe(8);
    expect(batch.results).toHaveLength(8);
    expect(batch.playerWins + batch.opponentWins + batch.draws + batch.turnLimitMatches).toBe(8);
    expect(batch.playerWinRate + batch.opponentWinRate + batch.drawRate + batch.turnLimitMatches / 8).toBeCloseTo(1);
  });
});
