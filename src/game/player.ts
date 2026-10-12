import { CARD_TYPES, CARD_POOL } from "../cards/card-data.ts";
import type { CardInstance, PlayerState } from "../cards/types.ts";

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function createDeck(createId: () => string, preferredKeys: string[] = []): CardInstance[] {
  const keys = preferredKeys.length === 30 && preferredKeys.every(key => key in CARD_TYPES)
    ? preferredKeys.slice()
    : shuffle(CARD_POOL.slice()).slice(0, 30);
  return keys
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
  preferredDeckKeys: string[] = [],
): PlayerState {
  return {
    name,
    time: startTime,
    hand: [],
    deck: createDeck(createId, preferredDeckKeys),
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
