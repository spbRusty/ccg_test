import { describe, expect, it } from "vitest";
import { CARDS, CARD_BY_ID, DEFAULT_DECK } from "./cards";
import { createGame, queueCard, unqueueCard, resolveRound } from "./rapid-core";

describe("Стабильность: короткая дуэль", () => {
  it("содержит ровно 120 карт с уникальными ID", () => {
    expect(CARDS).toHaveLength(120);
    expect(new Set(CARDS.map(card => card.id)).size).toBe(120);
    expect(CARDS.every(card => card.name && card.text && card.cost >= 1)).toBe(true);
  });

  it("использует колоду 12, стартовую руку 4 и поле из 3 мест", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    expect(game.settings.deckSize).toBe(12);
    expect(game.player.stability).toBe(30);
    expect(game.player.hand).toHaveLength(4);
    expect(game.player.board).toHaveLength(3);
    expect(game.player.deck.length + game.player.hand.length).toBe(12);
    expect(DEFAULT_DECK).toHaveLength(12);
    expect(new Set(DEFAULT_DECK).size).toBe(12);
  });

  it("списывает цену при выборе и возвращает её при отмене", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const card = game.player.hand[0];
    const initial = game.player.stability;
    expect(queueCard(game, "player", card.uid, 0).ok).toBe(true);
    expect(game.player.stability).toBe(initial - card.cost);
    expect(unqueueCard(game, "player", card.uid)).toBe(true);
    expect(game.player.stability).toBe(initial);
    expect(game.player.hand.some(item => item.uid === card.uid)).toBe(true);
  });

  it("не позволяет потратить Стабильность до нуля или выбрать больше двух карт", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const card = game.player.hand[0];
    game.player.stability = card.cost;
    expect(queueCard(game, "player", card.uid, 0).ok).toBe(false);
    game.player.stability = 30;
    const first = game.player.hand[0];
    const second = game.player.hand[1];
    const third = game.player.hand[2];
    expect(queueCard(game, "player", first.uid, 0).ok).toBe(true);
    expect(queueCard(game, "player", second.uid, 1).ok).toBe(true);
    expect(queueCard(game, "player", third.uid, 2).ok).toBe(false);
  });

  it("эффекты меняют Стабильность, у карт нет атаки и здоровья", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const raid = CARD_BY_ID.get("raid")!;
    const card = { ...raid, effect: { ...raid.effect }, uid: "test-raid", playedRound: 0 };
    game.player.hand = [card];
    game.player.stability = 30;
    game.enemy.stability = 3;
    expect(queueCard(game, "player", card.uid, 0).ok).toBe(true);
    game.player.locked = true;
    game.enemy.locked = true;
    resolveRound(game, () => 0.5);
    expect(game.enemy.stability).toBe(0);
    expect(game.winner).toBe("player");
    expect("health" in card).toBe(false);
    expect("attack" in card).toBe(false);
  });

  it("при одновременном смертельном эффекте обеих сторон фиксирует ничью", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const ambush = CARD_BY_ID.get("ambush")!;
    const pCard = { ...ambush, effect: { ...ambush.effect }, uid: "p-ambush", playedRound: 0 };
    const eCard = { ...ambush, effect: { ...ambush.effect }, uid: "e-ambush", playedRound: 0 };
    game.player.hand = [pCard];
    game.enemy.hand = [eCard];
    game.player.stability = 2;
    game.enemy.stability = 2;
    expect(queueCard(game, "player", pCard.uid, 0).ok).toBe(true);
    expect(queueCard(game, "enemy", eCard.uid, 0).ok).toBe(true);
    game.player.locked = true;
    game.enemy.locked = true;
    resolveRound(game, () => 0.5);
    expect(game.player.stability).toBe(0);
    expect(game.enemy.stability).toBe(0);
    expect(game.winner).toBe("draw");
  });

  it("стартовая колода собрана из существующих карт без дубликатов", () => {
    expect(DEFAULT_DECK.every(id => CARD_BY_ID.has(id))).toBe(true);
    expect(DEFAULT_DECK).toContain("raid");
    expect(CARDS.find(card => card.id === "raid")?.cost).toBe(2);
  });
});