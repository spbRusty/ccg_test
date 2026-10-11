import { CARD_TYPES, CARD_POOL } from "../cards/card-data";
import type { CardInstance, PlayerState } from "../cards/types";

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function createDeck(createId: () => string): CardInstance[] {
  return shuffle(CARD_POOL.slice())
    .slice(0, 30)
    .map((key) => ({
      ...CARD_TYPES[key],
      key,
      id: createId(),
      charges: 0,
      shield: 0,
      evolution: 0,
    }));
}

export function createPlayer(
  name: string,
  startTime: number,
  createId: () => string,
): PlayerState {
  return {
    name,
    time: startTime,
    hand: [],
    deck: createDeck(createId),
    board: Array<CardInstance | null>(6).fill(null),
    played: [],
    discard: [],
    discount: 0,
    penalty: 0,
    delayed: [],
    turnPlays: 0,
    hiddenTrap: 0,
    ruleBonus: 0,
  };
}
