import { describe, expect, it } from "vitest";
import { CARD_POOL, CARD_TYPES } from "./card-data";
import type { CardEffectType } from "./types";
import { createDeck, createPlayer } from "../game/player";

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


describe("player factory", () => {
  it("creates a 30-card deck with unique instance IDs", () => {
    let sequence = 0;
    const deck = createDeck(() => `test-card-${++sequence}`);
    expect(deck).toHaveLength(30);
    expect(new Set(deck.map((card) => card.id)).size).toBe(30);
    expect(deck.every((card) => CARD_TYPES[card.key])).toBe(true);
    expect(deck.every((card) => card.charges === 0 && card.shield === 0 && card.evolution === 0)).toBe(true);
  });

  it("creates a player with six empty board slots and a full deck", () => {
    let sequence = 0;
    const player = createPlayer("Тест", 60, () => `test-card-${++sequence}`);
    expect(player.name).toBe("Тест");
    expect(player.time).toBe(60);
    expect(player.deck).toHaveLength(30);
    expect(player.board).toHaveLength(6);
    expect(player.board.every((card) => card === null)).toBe(true);
  });
});
