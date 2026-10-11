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
