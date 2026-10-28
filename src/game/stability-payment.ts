/** Result of paying a card's Stability cost. */
export interface CardPayment {
  /** Stability after applying the cost and the game cap. */
  nextStability: number;
  /** Actual resource change: positive means spent, negative means gained. */
  stabilityDelta: number;
}

/**
 * Apply a card cost using the game's rules:
 * - positive costs may never reduce Stability below 1;
 * - at 1 Stability, positive-cost cards can be selected for free;
 * - negative costs restore Stability, up to the configured maximum.
 *
 * The delta records the actual capped change so cancelling the selection can
 * reverse it exactly, including when a negative-cost card hits the cap.
 */
export function calculateCardPayment(
  currentStability: number,
  cost: number,
  maxStability: number,
): CardPayment {
  const requestedPayment = cost > 0
    ? (currentStability <= 1 ? 0 : Math.min(cost, currentStability - 1))
    : cost;
  const nextStability = Math.max(0, Math.min(maxStability, currentStability - requestedPayment));

  return {
    nextStability,
    stabilityDelta: currentStability - nextStability,
  };
}
