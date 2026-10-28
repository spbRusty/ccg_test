import { describe, expect, it } from "vitest";
import { CARDS, CARD_BY_ID, DEFAULT_DECK } from "./cards";
import { createGame, queueCard, resolveRound, type CardInstance } from "./rapid-core";

function instance(id: string, uid: string): CardInstance {
  const definition = CARD_BY_ID.get(id);
  if (!definition) throw new Error("Unknown card: " + id);
  return { ...definition, uid, playedRound: 0 };
}

function lockBoth(game: ReturnType<typeof createGame>): void {
  game.player.locked = true;
  game.enemy.locked = true;
}

describe("Rapid core — Stability and positional control", () => {
  it("uses a unique 14-card deck, a four-card hand, and Stability capped at 30", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    expect(CARDS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(CARDS.map(card => card.id)).size).toBe(CARDS.length);
    expect(DEFAULT_DECK).toHaveLength(14);
    expect(new Set(DEFAULT_DECK).size).toBe(14);
    expect(game.settings).toMatchObject({
      startStability: 30, maxStability: 30, deckSize: 14,
      startHand: 4, handLimit: 4, slots: 4, maxPlays: 2,
    });
    expect(game.player.stability).toBe(30);
    expect(game.player.hand).toHaveLength(4);
    expect(game.player.deck).toHaveLength(10);
    expect(CARDS.every(card => card.cost >= -7 && card.cost <= 4)).toBe(true);
  });

  it("gives initiative to the player with less Stability and breaks ties using the supplied RNG", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    game.player.stability = 18;
    game.enemy.stability = 22;
    lockBoth(game);
    resolveRound(game, () => 0.9);
    expect(game.lastRoundEvents[0]).toEqual({ type: "initiative", side: "player" });

    const tied = createGame(DEFAULT_DECK, () => 0.5);
    lockBoth(tied);
    resolveRound(tied, () => 0.1);
    expect(tied.lastRoundEvents[0]).toEqual({ type: "initiative", side: "player" });
  });

  it("destroys a face-down card before reveal without charging its cost or triggering it", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const remover = { ...instance("hook", "remover"), cost: 0, target: "opposite" as const, action: "remove" as const };
    const victim = instance("glass-cannon", "victim");
    game.player.hand = [remover];
    game.enemy.hand = [victim];
    game.player.stability = 20;
    game.enemy.stability = 20;
    expect(queueCard(game, "player", remover.uid, 0).ok).toBe(true);
    expect(queueCard(game, "enemy", victim.uid, 0).ok).toBe(true);
    lockBoth(game);
    resolveRound(game, () => 0.1);

    expect(game.lastRoundEvents.some(event => event.type === "reveal" && event.card.uid === "victim")).toBe(false);
    expect(game.lastRoundEvents.some(event => event.type === "reveal" && event.card.uid === "remover")).toBe(true);
    expect(game.enemy.discard.some(card => card.uid === "victim")).toBe(true);
    expect(game.enemy.stability).toBe(23);
  });

  it("applies occupied-slot pressure and empty-slot recovery", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    game.player.board = [instance("token", "p1"), instance("token", "p2"), null, null];
    game.enemy.board = [instance("token", "e1"), null, null, null];
    game.player.stability = 20;
    game.enemy.stability = 20;
    lockBoth(game);
    resolveRound(game, () => 0.5);

    expect(game.player.stability).toBe(21);
    expect(game.enemy.stability).toBe(21);
    expect(game.lastRoundEvents.find(event => event.type === "table_volley")).toMatchObject({
      occupied: { player: 2, enemy: 1 },
      empty: { player: 2, enemy: 3 },
      delta: { player: 1, enemy: 1 },
    });
  });

  it("does not allow a card cost to reduce Stability to zero or below", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const expensive = { ...instance("glass-cannon", "expensive"), cost: -2 };
    game.player.hand = [expensive];
    game.player.stability = 2;
    game.enemy.stability = 30;
    expect(queueCard(game, "player", expensive.uid, 0).ok).toBe(true);
    lockBoth(game);
    resolveRound(game, () => 0.5);

    expect(game.player.stability).toBe(6);
    expect(game.player.discard.some(card => card.uid === "expensive")).toBe(true);
    expect(game.lastRoundEvents.some(event => event.type === "reveal" && event.card.uid === "expensive")).toBe(false);
  });

  it("treats a positive card cost as Stability recovery, capped at 30", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const recovery = { ...instance("medic", "recovery"), cost: 3 };
    game.player.hand = [recovery];
    game.player.stability = 20;
    game.enemy.stability = 30;
    expect(queueCard(game, "player", recovery.uid, 0).ok).toBe(true);
    lockBoth(game);

    resolveRound(game, () => 0.1);

    expect(game.player.stability).toBe(26); // +3 card cost, then +3 empty slots.
    expect(game.lastRoundEvents.some(event => event.type === "reveal" && event.card.uid === "recovery" && event.paid === 3)).toBe(true);
  });

  it("keeps the card pool on the five supported control actions", () => {
    const allowedActions = ["remove", "bounce", "shift", "lock", "spawn_token"] as const;
    expect(CARDS.every(card => allowedActions.includes(card.action))).toBe(true);
    expect(CARDS.every(card => !/нанеси? \\d+ урона|наносит урон|щит|запрет хила/i.test(card.text))).toBe(true);
  });

  it("keeps on-round-end slot locks active through the following round", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    game.player.board[1] = instance("bulwark", "bulwark");
    game.enemy.board[0] = instance("token", "enemy-left");
    game.enemy.board[2] = instance("token", "enemy-right");
    lockBoth(game);

    resolveRound(game, () => 0.1);

    expect(game.enemy.lockedSlots.has(0)).toBe(true);
    expect(game.enemy.lockedSlots.has(2)).toBe(true);
    expect(game.enemy.lockedSlots.has(1)).toBe(false);
  });

  it("applies fatigue for each card missing from the four-card hand", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    game.player.hand = [];
    game.player.deck = [];
    game.enemy.hand = [];
    game.enemy.deck = [];
    game.player.board = [null, null, null, null];
    game.enemy.board = [null, null, null, null];
    lockBoth(game);
    resolveRound(game, () => 0.5);

    expect(game.lastRoundEvents.filter(event => event.type === "fatigue" && event.side === "player")).toHaveLength(4);
    expect(game.lastRoundEvents.filter(event => event.type === "fatigue" && event.side === "enemy")).toHaveLength(4);
    expect(game.player.stability).toBe(22);
    expect(game.enemy.stability).toBe(22);
  });

  it("caps recovery before applying the opposing table pressure", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    game.player.board = [null, null, null, null];
    game.enemy.board = [instance("token", "e1"), null, null, null];
    game.player.stability = 29;
    game.enemy.stability = 20;
    lockBoth(game);
    resolveRound(game, () => 0.5);

    expect(game.player.stability).toBe(29);
  });
});
