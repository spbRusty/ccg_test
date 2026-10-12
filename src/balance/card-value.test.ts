import { describe, expect, it } from "vitest";
import { CARD_TYPES } from "../cards/card-data";
import { auditCard, auditLibrary, DEFAULT_BALANCE_STATE, estimateReferenceValue, summarizeAudit } from "./card-value";

describe("card balance audit", () => {
  it("audits all 500 generated cards without mutating source definitions", () => {
    const before = JSON.stringify(CARD_TYPES);
    const rows = auditLibrary(CARD_TYPES);
    expect(rows).toHaveLength(500);
    expect(new Set(rows.map((row) => row.key)).size).toBe(500);
    expect(rows.every((row) => row.currentCost >= 1 && row.currentCost <= 8)).toBe(true);
    expect(rows.every((row) => row.candidateCost >= 1 && row.candidateCost <= 8)).toBe(true);
    expect(JSON.stringify(CARD_TYPES)).toBe(before);
    expect(summarizeAudit(rows).total).toBe(500);
  });

  it("evaluates direct time gain against the available time cap", () => {
    const result = estimateReferenceValue({ type: "gain", amount: 8 }, {
      ...DEFAULT_BALANCE_STATE,
      ownTime: 57,
      maxTime: 60,
    });
    expect(result.value).toBe(3);
    expect(result.kind).toBe("time-swing");
  });

  it("values time theft as a swing for both players", () => {
    const result = estimateReferenceValue({ type: "steal", amount: 8 }, {
      ...DEFAULT_BALANCE_STATE,
      ownTime: 30,
      enemyTime: 40,
    });
    expect(result.value).toBe(16);
  });

  it("marks amount-independent and combo-sensitive effects for review", () => {
    const swap = auditCard(CARD_TYPES.card_035);
    expect(swap.flags).toContain("amount-not-direct");
    const loopRisk = Object.values(CARD_TYPES).find((card) => card.type === "accumulate")!;
    expect(auditCard(loopRisk).flags).toContain("combo-loop-risk");
  });

  it("does not present a candidate price as an applied balance change", () => {
    const card = CARD_TYPES.card_180;
    const row = auditCard(card);
    expect(row.currentCost).toBe(card.cost);
    expect(row.costDelta).toBe(row.candidateCost - row.currentCost);
  });
});
