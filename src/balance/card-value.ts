import type { CardDefinition } from "../cards/types";

export interface BalanceReferenceState {
  ownTime: number;
  enemyTime: number;
  maxTime: number;
  friendlyBoardCards: number;
  enemyBoardCards: number;
  enemyDeckCards: number;
  ownHandCards: number;
  enemyHandCards: number;
  ownCharges: number;
  hasLastEffect: boolean;
  hasFriendlyTarget: boolean;
  hasEnemyTarget: boolean;
}

export const DEFAULT_BALANCE_STATE: BalanceReferenceState = {
  ownTime: 30,
  enemyTime: 40,
  maxTime: 60,
  friendlyBoardCards: 3,
  enemyBoardCards: 3,
  enemyDeckCards: 20,
  ownHandCards: 4,
  enemyHandCards: 4,
  ownCharges: 2,
  hasLastEffect: true,
  hasFriendlyTarget: true,
  hasEnemyTarget: true,
};

export interface CardBalanceRow {
  key: string;
  name: string;
  type: CardDefinition["type"];
  amount: number;
  currentCost: number;
  referenceValue: number;
  candidateCost: number;
  costDelta: number;
  flags: string[];
  estimateKind: "time-swing" | "utility-proxy" | "state-dependent";
}

const STATE_DEPENDENT = new Set([
  "swap", "copy", "conditional", "percent", "fieldGain", "fieldDrain", "fieldTax",
  "mill", "hijack", "accumulate", "discharge", "transferCharge", "massDestroy",
  "return", "evolve", "combo", "overheat", "massPlay", "random", "duplicate", "sacrifice",
]);
const LOOP_RISK = new Set([
  "copy", "discount", "fieldGain", "accumulate", "discharge", "transferCharge",
  "combo", "massPlay", "ruleChange", "duplicate", "sacrifice",
]);
const AMOUNT_IGNORED_OR_INDIRECT = new Set([
  "swap", "copy", "shield", "duplicate", "evolve", "transferCharge",
]);

function cap(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

/**
 * A deliberately transparent screening heuristic, not a claim of true card value.
 * It evaluates every effect in one fixed reference state. Values for card/deck/board
 * utility are proxies and must not be treated as seconds or as validated prices.
 */
export function estimateReferenceValue(
  card: Pick<CardDefinition, "type" | "amount">,
  state: BalanceReferenceState = DEFAULT_BALANCE_STATE,
): { value: number; kind: CardBalanceRow["estimateKind"] } {
  const amount = Math.max(0, card.amount);
  const room = Math.max(0, state.maxTime - state.ownTime);
  const enemyTime = Math.max(0, state.enemyTime);
  let value: number;
  let kind: CardBalanceRow["estimateKind"] = "time-swing";

  switch (card.type) {
    case "gain":
      value = cap(amount, room);
      break;
    case "steal":
      value = 2 * Math.min(amount, enemyTime, room);
      break;
    case "swap":
      value = 2 * (state.enemyTime - state.ownTime);
      break;
    case "discount":
      value = Math.min(amount, 4);
      break;
    case "slow":
      value = Math.min(amount, 4);
      break;
    case "copy":
      value = state.hasLastEffect ? 4 : 0;
      break;
    case "cancel":
      value = cap(amount, room) + (state.hasEnemyTarget ? 3 : 0);
      break;
    case "delayed":
      value = 2 * Math.min(amount, enemyTime, room);
      break;
    case "conditional":
      value = 2 * Math.min(state.enemyTime < 20 ? 7 : 3, enemyTime, room);
      break;
    case "percent": {
      const moved = Math.min(Math.ceil(enemyTime * amount / 100), room, enemyTime);
      value = moved * 2;
      break;
    }
    case "fieldGain":
      value = Math.min(room, amount * state.friendlyBoardCards);
      break;
    case "fieldDrain":
      value = (2 * Math.min(amount, room) + (state.hasEnemyTarget ? 3 : 0));
      break;
    case "fieldTax":
      value = Math.min(enemyTime, amount * state.enemyBoardCards);
      break;
    case "mill":
      value = Math.min(amount, state.enemyDeckCards) * 1.2;
      kind = "utility-proxy";
      break;
    case "hijack":
      value = state.enemyHandCards > 0 && state.ownHandCards < 7 ? 3.5 : 0;
      kind = "utility-proxy";
      break;
    case "accumulate":
      value = amount * 2.5;
      kind = "state-dependent";
      break;
    case "discharge":
      value = Math.min(room, state.ownCharges * amount);
      kind = "state-dependent";
      break;
    case "transferCharge":
      value = state.hasFriendlyTarget ? Math.min(amount, state.ownCharges) * 0.75 : 0;
      kind = "state-dependent";
      break;
    case "massDestroy":
      value = Math.min(amount, state.enemyBoardCards) * 3.5;
      kind = "utility-proxy";
      break;
    case "return":
      value = Math.min(amount, state.friendlyBoardCards) * 1.2;
      kind = "utility-proxy";
      break;
    case "move":
      value = cap(amount, room) + 0.5;
      break;
    case "evolve":
      value = state.hasFriendlyTarget ? 3 : 0;
      kind = "state-dependent";
      break;
    case "combo":
      value = Math.min(room, amount * Math.max(0, state.friendlyBoardCards - 1));
      break;
    case "shield":
      value = state.hasFriendlyTarget ? 3 : 0;
      kind = "utility-proxy";
      break;
    case "overheat":
      value = Math.max(0, Math.min(amount, state.friendlyBoardCards - 1) * 1.5);
      kind = "state-dependent";
      break;
    case "massPlay":
      value = Math.min(amount, Math.max(0, 7 - state.ownHandCards)) * 1.2 + Math.min(amount, 4);
      kind = "utility-proxy";
      break;
    case "trap":
      value = 3;
      kind = "utility-proxy";
      break;
    case "ruleChange":
      value = amount * 0.8;
      kind = "state-dependent";
      break;
    case "random":
      value = amount * 0.5 + 1;
      kind = "state-dependent";
      break;
    case "duplicate":
      value = state.hasFriendlyTarget && state.friendlyBoardCards < 6 ? 4 : 0;
      kind = "utility-proxy";
      break;
    case "sacrifice":
      value = state.hasFriendlyTarget ? Math.max(0, amount + 2 - 2.5) : 0;
      kind = "state-dependent";
      break;
    default: {
      const exhaustive: never = card.type;
      throw new Error("Unhandled card effect: " + exhaustive);
    }
  }

  return { value: Math.round(value * 100) / 100, kind };
}

export function auditCard(
  card: CardDefinition,
  state: BalanceReferenceState = DEFAULT_BALANCE_STATE,
): CardBalanceRow {
  const estimate = estimateReferenceValue(card, state);
  const candidateCost = Math.max(1, Math.min(8, Math.round(estimate.value)));
  const flags: string[] = [];

  if (Math.abs(estimate.value - card.cost) >= 3) flags.push("cost-gap");
  if (STATE_DEPENDENT.has(card.type)) flags.push("state-dependent");
  if (LOOP_RISK.has(card.type)) flags.push("combo-loop-risk");
  if (AMOUNT_IGNORED_OR_INDIRECT.has(card.type)) flags.push("amount-not-direct");
  if (estimate.value > 8) flags.push("value-over-cost-cap");
  if (estimate.kind === "utility-proxy") flags.push("non-time-value-proxy");

  return {
    key: card.key,
    name: card.name,
    type: card.type,
    amount: card.amount,
    currentCost: card.cost,
    referenceValue: estimate.value,
    candidateCost,
    costDelta: candidateCost - card.cost,
    flags,
    estimateKind: estimate.kind,
  };
}

export function auditLibrary(cards: Record<string, CardDefinition>): CardBalanceRow[] {
  return Object.values(cards).map((card) => auditCard(card));
}

export function summarizeAudit(rows: CardBalanceRow[]) {
  const flagged = rows.filter((row) => row.flags.length > 0);
  const mismatches = rows.filter((row) => row.flags.includes("cost-gap"));
  const loopRisks = rows.filter((row) => row.flags.includes("combo-loop-risk"));
  const changedCandidates = rows.filter((row) => row.costDelta !== 0);
  const byType: Record<string, CardBalanceRow[]> = {};
  for (const row of rows) (byType[row.type] ??= []).push(row);
  return {
    total: rows.length,
    flagged: flagged.length,
    costMismatches: mismatches.length,
    comboLoopRisks: loopRisks.length,
    candidateCostChanges: changedCandidates.length,
    meanCurrentCost: rows.reduce((sum, row) => sum + row.currentCost, 0) / Math.max(1, rows.length),
    meanReferenceValue: rows.reduce((sum, row) => sum + row.referenceValue, 0) / Math.max(1, rows.length),
    byType: Object.fromEntries(Object.entries(byType).map(([type, typeRows]) => [
      type,
      {
        count: typeRows.length,
        meanCost: typeRows.reduce((sum, row) => sum + row.currentCost, 0) / typeRows.length,
        meanValue: typeRows.reduce((sum, row) => sum + row.referenceValue, 0) / typeRows.length,
        flagged: typeRows.filter((row) => row.flags.length > 0).length,
      },
    ])),
  };
}
