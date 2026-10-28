import type { Effect } from "./cards";

export interface EffectConditionContext {
  slot: number;
  slots: number;
  ownBoardCount: number;
  enemyBoardCount: number;
  ownHandCount: number;
  enemyHandCount: number;
  ownDeckCount: number;
  enemyDeckCount: number;
  ownStability: number;
  enemyStability: number;
  ownPlayedCount: number;
  enemyPlayedCount: number;
  oppositeOccupied: boolean;
  leftOccupied: boolean;
  rightOccupied: boolean;
}

/**
 * Purely evaluate an effect's declarative condition and count/stability gate.
 * The context is a snapshot assembled by the game engine; this function does not
 * mutate game state and can be tested independently from round resolution.
 */
export function evaluateEffectCondition(effect: Effect, context: EffectConditionContext): boolean {
  const condition = effect.condition;
  if (condition) {
    const threshold = condition.value ?? 0;
    switch (condition.type) {
      case "IS_EDGE":
        if (context.slot !== 0 && context.slot !== context.slots - 1) return false;
        break;
      case "IS_CENTER":
        if (context.slot === 0 || context.slot === context.slots - 1) return false;
        break;
      case "OPPOSITE_EMPTY":
        if (context.oppositeOccupied) return false;
        break;
      case "OPPOSITE_EXISTS":
        if (!context.oppositeOccupied) return false;
        break;
      case "LEFT_EMPTY":
        if (context.leftOccupied) return false;
        break;
      case "RIGHT_EMPTY":
        if (context.rightOccupied) return false;
        break;
      case "OWN_HAND_MORE":
        if (context.ownHandCount <= threshold) return false;
        break;
      case "ENEMY_HAND_MORE":
        if (context.enemyHandCount <= threshold) return false;
        break;
      case "OWN_BOARD_LESS":
        if (context.ownBoardCount >= threshold) return false;
        break;
      case "ENEMY_BOARD_LESS":
        if (context.enemyBoardCount >= threshold) return false;
        break;
      case "OWN_DECK_LESS":
        if (context.ownDeckCount >= threshold) return false;
        break;
      case "ENEMY_DECK_LESS":
        if (context.enemyDeckCount >= threshold) return false;
        break;
      case "OWN_STABILITY_BELOW":
        if (context.ownStability >= threshold) return false;
        break;
      case "ENEMY_STABILITY_BELOW":
        if (context.enemyStability >= threshold) return false;
        break;
    }
  }

  switch (effect.kind) {
    case "if-own-more": return context.ownBoardCount > context.enemyBoardCount;
    case "if-own-less": return context.ownBoardCount < context.enemyBoardCount;
    case "enemy-played-more": return context.enemyPlayedCount > (effect.threshold ?? 1);
    case "enemy-played-less": return context.enemyPlayedCount <= (effect.threshold ?? 1);
    case "own-played-more": return context.ownPlayedCount > (effect.threshold ?? 1);
    case "own-played-less": return context.ownPlayedCount <= (effect.threshold ?? 1);
    case "if-enemy-stability-low": return context.enemyStability <= (effect.threshold ?? 10);
    case "if-own-stability-low": return context.ownStability <= (effect.threshold ?? 10);
    default: return true;
  }
}
