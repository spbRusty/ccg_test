import type { CardInstance, PlayerKey, PlayerState } from "../cards/types";

type Players = Record<PlayerKey, PlayerState>;
type CardCost = (key: PlayerKey, card: CardInstance) => number;

/** Estimates a card's immediate strategic value for the computer opponent. */
export function scoreCard(
  card: CardInstance,
  key: PlayerKey,
  players: Players,
  cardCost: CardCost,
  lastEffect: unknown,
  startTime: number,
  maxHand: number,
): number {
  const actor = players[key];
  const target = players[key === "player" ? "opponent" : "player"];
  const cost = cardCost(key, card);
  let score = Math.random() * 0.8 - cost * 0.16;

  switch (card.type) {
    case "gain": score += (startTime - actor.time) * 0.09 + card.amount * 0.8; break;
    case "steal": score += Math.min(card.amount, target.time) * 1.1; break;
    case "swap": score += (target.time - actor.time) * 0.12; break;
    case "discount": score += actor.time < 20 ? 0.5 : 2.5; break;
    case "slow": score += target.time > 10 ? 2.5 : 0.5; break;
    case "copy": score += lastEffect ? 3.2 : -100; break;
    case "cancel": score += target.board.some(Boolean) ? 2.5 : 0.5; break;
    case "delayed": score += target.time > 5 ? 3.1 : 0.5; break;
    case "conditional": score += target.time < 20 ? 7 : 2.8; break;
    case "percent": score += target.time * 0.045; break;
    case "fieldGain": score += actor.board.filter(Boolean).length * 0.8; break;
    case "fieldDrain": score += target.board.filter(Boolean).length * 1.4; break;
    case "fieldTax": score += target.board.filter(Boolean).length * 1.1; break;
    case "mill": score += Math.min(card.amount, target.deck.length) * 1.4; break;
    case "hijack": score += target.hand.length > 0 && actor.hand.length < maxHand ? 3.6 : -1; break;
    case "accumulate": score += 3; break;
    case "discharge": score += (card.charges || 0) * card.amount; break;
    case "transferCharge": score += actor.board.some((c) => c && (c.charges || 0) > 0) ? 2 : 0; break;
    case "massDestroy": score += target.board.filter(Boolean).length * 1.2; break;
    case "return": score += actor.board.filter(Boolean).length * 0.7; break;
    case "move": score += 1; break;
    case "evolve": score += actor.board.filter(Boolean).length * 0.8; break;
    case "combo": score += actor.board.filter(Boolean).length * card.amount * 0.4; break;
    case "shield": score += 2; break;
    case "overheat": score += actor.board.filter(Boolean).length * 0.8; break;
    case "massPlay": score += actor.hand.length < 5 ? 3 : 1; break;
    case "trap": score += 2.4; break;
    case "ruleChange": score += 2; break;
    case "random": score += 1.8; break;
    case "duplicate": score += actor.board.filter(Boolean).length ? 2.5 : -1; break;
    case "sacrifice": score += actor.board.filter(Boolean).length ? 2 : 0; break;
    default: break;
  }
  return score;
}
