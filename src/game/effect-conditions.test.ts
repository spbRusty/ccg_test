import { describe, expect, it } from "vitest";
import type { Effect } from "./cards";
import { evaluateEffectCondition, type EffectConditionContext } from "./effect-conditions";

const context = (overrides: Partial<EffectConditionContext> = {}): EffectConditionContext => ({
  slot: 1,
  slots: 4,
  ownBoardCount: 2,
  enemyBoardCount: 1,
  ownHandCount: 3,
  enemyHandCount: 2,
  ownDeckCount: 5,
  enemyDeckCount: 4,
  ownStability: 12,
  enemyStability: 8,
  ownPlayedCount: 2,
  enemyPlayedCount: 1,
  oppositeOccupied: true,
  leftOccupied: false,
  rightOccupied: false,
  ...overrides,
});

const effect = (kind: Effect["kind"], condition?: NonNullable<Effect["condition"]>, threshold?: number): Effect => ({
  kind, amount: 1, ...(condition ? { condition } : {}), ...(threshold === undefined ? {} : { threshold }),
});

describe("pure effect condition evaluation", () => {
  it("checks edge and center slots", () => {
    expect(evaluateEffectCondition(effect("damage", { type: "IS_EDGE" }), context({ slot: 0 }))).toBe(true);
    expect(evaluateEffectCondition(effect("damage", { type: "IS_EDGE" }), context({ slot: 1 }))).toBe(false);
    expect(evaluateEffectCondition(effect("damage", { type: "IS_CENTER" }), context({ slot: 1 }))).toBe(true);
    expect(evaluateEffectCondition(effect("damage", { type: "IS_CENTER" }), context({ slot: 3 }))).toBe(false);
  });

  it("checks occupancy and numeric thresholds", () => {
    expect(evaluateEffectCondition(effect("damage", { type: "OPPOSITE_EXISTS" }), context())).toBe(true);
    expect(evaluateEffectCondition(effect("damage", { type: "OPPOSITE_EMPTY" }), context())).toBe(false);
    expect(evaluateEffectCondition(effect("damage", { type: "LEFT_EMPTY" }), context())).toBe(true);
    expect(evaluateEffectCondition(effect("damage", { type: "OWN_HAND_MORE", value: 2 }), context())).toBe(true);
    expect(evaluateEffectCondition(effect("damage", { type: "OWN_STABILITY_BELOW", value: 12 }), context())).toBe(false);
  });

  it("evaluates board, played-card, and Stability gates", () => {
    expect(evaluateEffectCondition(effect("if-own-more"), context())).toBe(true);
    expect(evaluateEffectCondition(effect("if-own-less"), context())).toBe(false);
    expect(evaluateEffectCondition(effect("enemy-played-more", undefined, 0), context())).toBe(true);
    expect(evaluateEffectCondition(effect("enemy-played-less", undefined, 1), context())).toBe(true);
    expect(evaluateEffectCondition(effect("if-enemy-stability-low", undefined, 8), context())).toBe(true);
    expect(evaluateEffectCondition(effect("if-own-stability-low", undefined, 10), context())).toBe(false);
  });

  it("does not mutate the supplied snapshot", () => {
    const snapshot = context();
    const before = { ...snapshot };
    evaluateEffectCondition(effect("if-own-more", { type: "OPPOSITE_EXISTS" }), snapshot);
    expect(snapshot).toEqual(before);
  });
});
