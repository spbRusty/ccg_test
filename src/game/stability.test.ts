import { describe, expect, it } from "vitest";
import { CARDS } from "./cards";
import { aiCommit, applyOpeningEffects, commit, createGame, resolveRound, selectCard, swapCard, type Card } from "./stability";

function card(id: string, uid: string): Card {
  const def = CARDS.find((item) => item.id === id);
  if (!def) throw new Error("Unknown test card: " + id);
  return { ...def, effect: { ...def.effect }, uid, playedRound: 0 };
}

describe("Expanded collection and mechanics", () => {
  it("contains exactly 500 cards with unique IDs", () => {
    expect(CARDS).toHaveLength(500);
    expect(new Set(CARDS.map(item => item.id)).size).toBe(500);
  });

  it("supports negative costs and refunds the exact amount when a choice is cancelled", () => {
    const game = createGame({}, () => 0.5);
    const def = CARDS.find(item => item.cost < 0 && item.timing === "play");
    if (!def) throw new Error("No negative-cost card in collection");
    const chosen = { ...def, effect: { ...def.effect }, uid: "negative-cost-test", playedRound: 0 } as Card;
    game.player.hand = [chosen];
    game.player.stability = 20;
    expect(selectCard(game, "player", chosen.uid).ok).toBe(true);
    expect(game.player.stability).toBe(20 - chosen.cost);
    expect(selectCard(game, "player", chosen.uid).ok).toBe(true);
    expect(game.player.stability).toBe(20);
  });

  it("calculates damage from the total number of cards on both fields", () => {
    const game = createGame({ startStability: 30 }, () => 0.5);
    const def = CARDS.find(item => item.effect.kind === "total-count" && item.timing === "play")!
    const attacker = { ...def, effect: { ...def.effect }, uid: "total-count-test", playedRound: 0 } as Card;
    game.player.hand = [attacker];
    game.enemy.hand = [card("map", "total-count-target")];
    expect(selectCard(game, "player", attacker.uid).ok).toBe(true);
    expect(selectCard(game, "enemy", "total-count-target").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0.5);
    expect(game.enemy.stability).toBe(30 - 1 - 2 * attacker.effect.amount);
  });

  it("checks how many cards the opponent committed this round", () => {
    const game = createGame({ startStability: 30 }, () => 0.5);
    const def = CARDS.find(item => item.effect.kind === "enemy-played-more" && item.effect.threshold === 1 && item.timing === "play")!
    const attacker = { ...def, effect: { ...def.effect }, uid: "enemy-play-count-test", playedRound: 0 } as Card;
    game.player.hand = [attacker];
    game.enemy.hand = [card("map", "enemy-map-1"), card("map", "enemy-map-2")];
    expect(selectCard(game, "player", attacker.uid).ok).toBe(true);
    expect(selectCard(game, "enemy", "enemy-map-1").ok).toBe(true);
    expect(selectCard(game, "enemy", "enemy-map-2").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0.5);
    expect(game.enemy.stability).toBe(30 - 2 - attacker.effect.amount);
  });

  it("resolves cards marked for the start of the game", () => {
    const game = createGame({ startStability: 30 }, () => 0.5);
    const def = CARDS.find(item => item.timing === "start" && item.effect.kind === "damage")!
    const opening = { ...def, effect: { ...def.effect }, uid: "opening-test", playedRound: 0 } as Card;
    game.player.hand = [opening];
    game.player.deck = [];
    game.enemy.hand = [];
    game.enemy.deck = [];
    applyOpeningEffects(game, () => 0.5);
    expect(game.enemy.stability).toBe(30 - opening.effect.amount);
    expect(game.player.hand).not.toContain(opening);
    expect(game.log.some(line => line.includes("Начало игры"))).toBe(true);
  });
});

describe("Stability rules", () => {
  it("starts with five cards, six slots, and configured Stability", () => {
    const game = createGame({ startStability: 20 }, () => 0.5);
    expect(game.player.stability).toBe(20);
    expect(game.enemy.stability).toBe(20);
    expect(game.player.hand).toHaveLength(5);
    expect(game.player.board).toHaveLength(6);
    expect(game.player.deck.length + game.player.hand.length).toBe(30);
  });

  it("charges Stability immediately and refunds a cancelled choice", () => {
    const game = createGame({}, () => 0.5);
    const chosen = game.player.hand[0];
    const before = game.player.stability;
    expect(selectCard(game, "player", chosen.uid).ok).toBe(true);
    expect(game.player.stability).toBe(before - chosen.cost);
    expect(selectCard(game, "player", chosen.uid).ok).toBe(true);
    expect(game.player.stability).toBe(before);
    expect(game.player.hand).toContain(chosen);
    expect(game.player.committed).toHaveLength(0);
  });

  it("does not allow a payment that would reduce Stability to zero", () => {
    const game = createGame({}, () => 0.5);
    const chosen = card("blackout", "blackout-test");
    game.player.hand = [chosen];
    game.player.stability = chosen.cost;
    const result = selectCard(game, "player", chosen.uid);
    expect(result.ok).toBe(false);
    expect(game.player.stability).toBe(chosen.cost);
    expect(game.player.hand).toContain(chosen);
  });

  it("enforces the optional two-card round limit", () => {
    const game = createGame({ startStability: 20, maxPlays: 2 }, () => 0.5);
    game.player.hand = [card("map", "map-1"), card("map", "map-2"), card("map", "map-3")];
    expect(selectCard(game, "player", "map-1").ok).toBe(true);
    expect(selectCard(game, "player", "map-2").ok).toBe(true);
    expect(selectCard(game, "player", "map-3").ok).toBe(false);
  });

  it("swaps one card per round for free and then locks the swap", () => {
    const game = createGame({}, () => 0.5);
    game.player.hand = [card("map", "swap-me"), card("raid", "keep")];
    game.player.stability = 10;
    expect(swapCard(game, "player", "swap-me").ok).toBe(true);
    expect(game.player.stability).toBe(10);
    expect(game.player.discard.some((item) => item.uid === "swap-me")).toBe(true);
    expect(swapCard(game, "player", "keep").ok).toBe(false);
  });

  it("keeps cards played this round immune to removal", () => {
    const game = createGame({}, () => 0.5);
    game.player.hand = [card("cleaner", "cleaner-test")];
    game.enemy.hand = [card("raid", "new-enemy-card")];
    expect(selectCard(game, "player", "cleaner-test").ok).toBe(true);
    expect(selectCard(game, "enemy", "new-enemy-card").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0);
    expect(game.enemy.board.some((item) => item?.uid === "new-enemy-card")).toBe(true);
  });

  it("ends the duel when a revealed effect reduces the opponent to zero", () => {
    const game = createGame({}, () => 0.5);
    game.player.hand = [card("raid", "raid-test")];
    game.enemy.stability = 2;
    expect(selectCard(game, "player", "raid-test").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0);
    expect(game.enemy.stability).toBe(0);
    expect(game.winner).toBe("player");
  });

  it("resolves both sides simultaneously so a mirror round ends in a draw", () => {
    const game = createGame({}, () => 0.5);
    game.player.stability = 6;
    game.enemy.stability = 6;
    game.player.hand = [card("raid", "player-raid"), card("ration", "player-heal")];
    game.enemy.hand = [card("raid", "enemy-raid"), card("ration", "enemy-heal")];
    for (const side of ["player", "enemy"] as const) {
      const [first, second] = game[side].hand;
      expect(selectCard(game, side, first.uid).ok).toBe(true);
      expect(selectCard(game, side, second.uid).ok).toBe(true);
      commit(game, side);
    }
    resolveRound(game, () => 0);
    expect(game.player.stability).toBe(0);
    expect(game.enemy.stability).toBe(0);
    expect(game.winner).toBe("draw");
  });

  it("blocks a cursed side from healing this round", () => {
    const game = createGame({ startStability: 15 }, () => 0.5);
    game.enemy.stability = 10;
    game.player.hand = [card("curse", "curse-test")];
    game.enemy.hand = [card("ration", "enemy-heal")];
    expect(selectCard(game, "player", "curse-test").ok).toBe(true);
    expect(selectCard(game, "enemy", "enemy-heal").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0);
    expect(game.enemy.stability).toBe(8);
    expect(game.player.stability).toBe(12);
  });

  it("doubles payoff damage when the caster is below the threshold", () => {
    const game = createGame({ startStability: 15 }, () => 0.5);
    game.player.stability = 7;
    game.player.hand = [card("payoff", "payoff-test")];
    expect(selectCard(game, "player", "payoff-test").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0);
    expect(game.enemy.stability).toBe(9);
    expect(game.player.stability).toBe(4);
  });

  it("lets the AI use more than three cards when no per-round limit is set", () => {
    const game = createGame({ startStability: 20, maxPlays: 0 }, () => 0.5);
    game.enemy.hand = [
      card("map", "ai-1"), card("map", "ai-2"), card("map", "ai-3"),
      card("map", "ai-4"), card("map", "ai-5"),
    ];
    aiCommit(game, () => 0.99);
    expect(game.enemy.committed.length).toBeGreaterThan(3);
    expect(game.enemy.locked).toBe(true);
  });

  it("does not grant transferred Stability when an old guard blocks the hit", () => {
    const game = createGame({ startStability: 15 }, () => 0.5);
    const guard = card("barrier", "old-guard");
    guard.playedRound = 0;
    game.enemy.board[0] = guard;
    game.player.hand = [card("mediator", "transfer-test")];
    expect(selectCard(game, "player", "transfer-test").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0);
    expect(game.enemy.stability).toBe(15);
    expect(game.player.stability).toBe(11);
    expect(game.enemy.board[0]).toBeNull();
  });

  it("does not let a newly played guard absorb a hit in its entry round", () => {
    const game = createGame({ startStability: 15 }, () => 0.5);
    game.player.hand = [card("barrier", "fresh-guard")];
    game.enemy.hand = [card("raid", "raid-into-guard")];
    expect(selectCard(game, "player", "fresh-guard").ok).toBe(true);
    expect(selectCard(game, "enemy", "raid-into-guard").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0);
    expect(game.player.board.some((item) => item?.uid === "fresh-guard")).toBe(true);
    expect(game.player.stability).toBe(9);
  });

  it("does not discard a card when a return effect resolves into a full hand", () => {
    const game = createGame({}, () => 0.5);
    const old = card("map", "old-card");
    old.playedRound = 0;
    game.player.board[0] = old;
    game.player.hand = [
      card("reserves", "draw-before-return"),
      card("recall", "return-while-full"),
      card("map", "filler-1"),
      card("map", "filler-2"),
      card("map", "filler-3"),
      card("map", "filler-4"),
    ];
    expect(selectCard(game, "player", "draw-before-return").ok).toBe(true);
    expect(selectCard(game, "player", "return-while-full").ok).toBe(true);
    commit(game, "player");
    commit(game, "enemy");
    resolveRound(game, () => 0);
    expect(game.player.hand).toHaveLength(6);
    expect(game.player.board.some((item) => item?.uid === "old-card")).toBe(true);
    expect(game.player.discard.some((item) => item.uid === "old-card")).toBe(false);
  });

  it("lets the AI spend down to one Stability when it is under pressure", () => {
    const game = createGame({}, () => 0.5);
    game.enemy.stability = 3;
    game.enemy.hand = [card("map", "last-resort")];
    aiCommit(game, () => 0.99);
    expect(game.enemy.stability).toBe(2);
    expect(game.enemy.committed.some((item) => item.uid === "last-resort")).toBe(true);
  });

  it("sacrifices enough weak old cards to play multiple cards on a full field", () => {
    const game = createGame({ startStability: 20, maxPlays: 0 }, () => 0.5);
    game.enemy.board = Array.from({ length: 6 }, (_, i) => card("map", "old-" + i));
    game.enemy.hand = [card("convoy", "strong-new-card"), card("battery", "second-new-card")];
    aiCommit(game, () => 0.99);
    expect(game.enemy.board.filter(Boolean)).toHaveLength(4);
    expect(game.enemy.discard.filter((item) => item.uid.startsWith("old-"))).toHaveLength(2);
    expect(game.enemy.committed.some((item) => item.uid === "strong-new-card")).toBe(true);
    expect(game.enemy.committed.some((item) => item.uid === "second-new-card")).toBe(true);
  });
});
