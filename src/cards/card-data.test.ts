import { describe, expect, it } from "vitest";
import { CARD_POOL, CARD_TYPES } from "./card-data";
import type { CardEffectType } from "./types";

const supportedEffects: CardEffectType[] = [
  "gain", "steal", "swap", "discount", "slow", "copy", "cancel",
  "delayed", "conditional", "percent", "fieldGain", "fieldDrain",
  "fieldTax", "mill", "hijack", "accumulate", "discharge",
  "transferCharge", "massDestroy", "return", "move", "evolve",
  "combo", "shield", "overheat", "massPlay", "trap", "ruleChange",
  "random", "duplicate", "sacrifice",
];

describe("card library", () => {
  it("contains 500 cards with unique keys and names", () => {
    expect(CARD_POOL).toHaveLength(500);
    expect(new Set(CARD_POOL).size).toBe(500);
    expect(new Set(CARD_POOL.map((key) => CARD_TYPES[key].name)).size).toBe(500);
  });

  it("defines valid cost, amount, and supported effects for every card", () => {
    for (const key of CARD_POOL) {
      const card = CARD_TYPES[key];
      expect(card.key).toBe(key);
      expect(card.name.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(card.cost)).toBe(true);
      expect(card.cost).toBeGreaterThan(0);
      expect(Number.isFinite(card.amount)).toBe(true);
      expect(supportedEffects).toContain(card.type);
      expect(card.description.trim().length).toBeGreaterThan(0);
    }
  });
});
