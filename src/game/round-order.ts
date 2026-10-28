import type { Side } from "./cards";

/**
 * Return the fixed resolution order for one round.
 * The player with lower Stability resolves first; equal Stability is a random tie.
 * The result is computed once and must be reused for every slot and timing phase.
 */
export function getRoundResolutionOrder(
  playerStability: number,
  enemyStability: number,
  random: () => number = Math.random,
): [Side, Side] {
  const first: Side = playerStability === enemyStability
    ? (random() < 0.5 ? "player" : "enemy")
    : (playerStability < enemyStability ? "player" : "enemy");
  return first === "player" ? ["player", "enemy"] : ["enemy", "player"];
}
