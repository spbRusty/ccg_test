export type CardEffectType =
  | "gain" | "steal" | "swap" | "discount" | "slow" | "copy" | "cancel"
  | "delayed" | "conditional" | "percent" | "fieldGain" | "fieldDrain"
  | "fieldTax" | "mill" | "hijack" | "accumulate" | "discharge"
  | "transferCharge" | "massDestroy" | "return" | "move" | "evolve"
  | "combo" | "shield" | "overheat" | "massPlay" | "trap" | "ruleChange"
  | "random" | "duplicate" | "sacrifice";

export interface CardDefinition {
  key: string;
  name: string;
  cost: number;
  type: CardEffectType;
  amount: number;
  symbol: string;
  description: string;
  color: string;
  variant: number;
}

export interface CardViewData extends CardDefinition {
  id?: string;
  charges?: number;
  shield?: number;
  evolution?: number;
}

export type PlayerKey = "player" | "opponent";

export interface CardInstance extends CardDefinition {
  id: string;
  charges: number;
  shield: number;
  evolution: number;
  playedAt?: number;
}

export interface PlayerState {
  name: string;
  time: number;
  hand: CardInstance[];
  deck: CardInstance[];
  board: Array<CardInstance | null>;
  played: CardInstance[];
  discard: CardInstance[];
  discount: number;
  penalty: number;
  delayed: unknown[];
  turnPlays: number;
  hiddenTrap: number;
  ruleBonus: number;
}
