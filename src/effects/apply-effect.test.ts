import { describe, expect, it } from "vitest";
import { CARD_TYPES } from "../cards/card-data";
import type { CardInstance, PlayerKey, PlayerState } from "../cards/types";
import { createPlayer } from "../game/player";
import { applyEffect } from "./apply-effect";

function setup() {
  let id = 0;
  const players: Record<PlayerKey, PlayerState> = {
    player: createPlayer("Ты", 60, () => `p-${++id}`),
    opponent: createPlayer("Противник", 60, () => `o-${++id}`),
  };
  const logs: string[] = [];
  let sequence = 0;
  const context = {
    getPlayers: () => players,
    maxTime: 60,
    maxHand: 7,
    drawCard: (key: PlayerKey) => {
      const player = players[key];
      if (player.hand.length < 7 && player.deck.length) player.hand.push(player.deck.pop()!);
    },
    addLog: (message: string) => logs.push(message),
    transferTime: (key: PlayerKey, amount: number) => {
      const actor = players[key];
      const target = players[key === "player" ? "opponent" : "player"];
      const moved = Math.min(amount, target.time, 60 - actor.time);
      actor.time += moved;
      target.time -= moved;
      return moved;
    },
    labelOf: (key: PlayerKey) => key === "player" ? "Ты" : "Противник",
    nextSequence: () => ++sequence,
  };
  return { players, logs, context };
}

function makeEffect(type: CardInstance["type"], amount = 1): CardInstance {
  return {
    ...CARD_TYPES.card_001,
    id: "effect-instance",
    type,
    amount,
    charges: 0,
    shield: 0,
    evolution: 0,
  };
}

describe("card effect resolution", () => {
  it("caps a gain effect at the time limit", () => {
    const { players, context } = setup();
    players.player.time = 57;
    applyEffect(makeEffect("gain", 10), "player", false, context);
    expect(players.player.time).toBe(60);
  });

  it("transfers time from the opponent without exceeding the actor's limit", () => {
    const { players, context } = setup();
    players.player.time = 55;
    players.opponent.time = 30;
    applyEffect(makeEffect("steal", 12), "player", false, context);
    expect(players.player.time).toBe(60);
    expect(players.opponent.time).toBe(25);
  });

  it("sets a hidden trap on the player who plays the effect", () => {
    const { players, context } = setup();
    applyEffect(makeEffect("trap", 2), "opponent", false, context);
    expect(players.opponent.hiddenTrap).toBe(2);
  });

  it("does not destroy a shielded card with mass destroy", () => {
    const { players, context } = setup();
    const protectedCard = makeEffect("gain", 1);
    protectedCard.id = "protected";
    protectedCard.shield = 1;
    players.opponent.board[0] = protectedCard;
    applyEffect(makeEffect("massDestroy", 6), "player", false, context);
    expect(players.opponent.board[0]?.id).toBe("protected");
    expect(players.opponent.discard).toHaveLength(0);
  });

  it("duplicates a friendly card into an empty slot", () => {
    const { players, context } = setup();
    const source = makeEffect("gain", 4);
    source.id = "source-card";
    players.player.board[0] = source;
    applyEffect(makeEffect("duplicate"), "player", false, context);
    expect(players.player.board[0]?.id).toBe("source-card");
    expect(players.player.board[1]?.name).toBe(source.name);
    expect(players.player.board[1]?.id).not.toBe(source.id);
  });
});
