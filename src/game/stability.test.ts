import { describe, expect, it } from "vitest";
import { CARDS } from "./cards";
import { aiCommit, commit, createGame, resolveRound, selectCard, type Card } from "./stability";

function card(id: string, uid: string): Card {
  const def = CARDS.find((item) => item.id === id);
  if (!def) throw new Error("Unknown test card: " + id);
  return { ...def, effect: { ...def.effect }, uid, playedRound: 0 };
}

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
  it("does not let a newly played guard absorb a hit in its entry round", () => {
    const game = createGame({}, () => 0.5);
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
      card("recycler", "return-while-full"),
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
  it("sacrifices the weakest old card when the AI has a better card and a full field", () => {
    const game = createGame({ startStability: 20, maxPlays: 0 }, () => 0.5);
    game.enemy.board = Array.from({ length: 6 }, (_, i) => card("map", "old-" + i));
    game.enemy.hand = [card("blackout", "strong-new-card")];
    aiCommit(game, () => 0.99);
    expect(game.enemy.board.filter(Boolean)).toHaveLength(5);
    expect(game.enemy.discard.some((item) => item.uid.startsWith("old-"))).toBe(true);
    expect(game.enemy.committed.some((item) => item.uid === "strong-new-card")).toBe(true);
  });
});
