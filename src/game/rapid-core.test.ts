import { describe, expect, it } from "vitest";
import { CARDS, CARD_BY_ID, DEFAULT_DECK } from "./cards";
import { createGame, queueCard, unqueueCard, resolveRound } from "./rapid-core";

describe("Rapid core: короткая дуэль", () => {
  it("содержит ровно 120 карт с уникальными ID", () => {
    expect(CARDS).toHaveLength(120);
    expect(new Set(CARDS.map(card => card.id)).size).toBe(120);
    expect(CARDS.every(card => card.name && card.text && Number.isFinite(card.cost))).toBe(true);
  });

  it("использует колоду 12, стартовую руку 4 и поле из 4 мест и рука ограничена 4 картами", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    expect(game.settings.deckSize).toBe(12);
    expect(game.player.stability).toBe(30);
    expect(game.player.hand).toHaveLength(4);
    expect(game.settings.handLimit).toBe(4);
    expect(game.player.board).toHaveLength(4);
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

  it("ограничивает оплату единицей Стабильности, разрешает отрицательную цену и четыре слота", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const cards = [...game.player.hand];
    game.player.hand = [...cards];
    game.player.stability = 2;
    const positive = { ...cards[0], cost: 9, effect: { ...cards[0].effect } };
    game.player.hand[0] = positive;
    expect(queueCard(game, "player", positive.uid, 0).ok).toBe(true);
    expect(game.player.stability).toBe(1);
    game.player.stability = 10;
    const negative = { ...cards[1], cost: -3, effect: { ...cards[1].effect } };
    game.player.hand[0] = negative;
    expect(queueCard(game, "player", negative.uid, 1).ok).toBe(true);
    expect(game.player.stability).toBe(13);
    game.player.stability = 30;
    game.player.hand = [...cards];
    game.player.committed = [];
    expect(queueCard(game, "player", cards[0].uid, 0).ok).toBe(true);
    expect(queueCard(game, "player", cards[1].uid, 1).ok).toBe(true);
    expect(queueCard(game, "player", cards[2].uid, 2).ok).toBe(true);
    expect(queueCard(game, "player", cards[3].uid, 3).ok).toBe(true);
  });

  it("эффекты меняют Стабильность, у карт нет атаки и здоровья", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const raid = CARD_BY_ID.get("raid")!;
    const card = { ...raid, effect: { ...raid.effect }, uid: "test-raid", playedRound: 0 };
    game.player.hand = [card];
    game.player.stability = 30;
    game.enemy.stability = 3;
    const filler = { ...card, uid: "enemy-filler", timing: "start" as const, cost: 0 };
    game.enemy.board = [filler, { ...filler, uid: "enemy-filler-2" }, { ...filler, uid: "enemy-filler-3" }, { ...filler, uid: "enemy-filler-4" }];
    expect(queueCard(game, "player", card.uid, 0).ok).toBe(true);
    game.player.locked = true;
    game.enemy.locked = true;
    resolveRound(game, () => 0.5);
    expect(game.enemy.stability).toBe(0);
    expect(game.winner).toBe("player");
    expect("health" in card).toBe(false);
    expect("attack" in card).toBe(false);
  });

  it("поддерживает позиционные условия эффекта по слоту", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const base = CARD_BY_ID.get("raid")!;
    const card = { ...base, effect: { ...base.effect, condition: { type: "IS_EDGE" as const } }, uid: "edge-test", playedRound: 0 };
    game.player.hand = [card];
    game.player.stability = 30;
    game.enemy.stability = 30;
    expect(queueCard(game, "player", card.uid, 1).ok).toBe(true);
    game.player.locked = true;
    game.enemy.locked = true;
    resolveRound(game, () => 0.5);
    expect(game.enemy.stability).toBe(33);
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
    const filler = { ...pCard, uid: "filler", timing: "start" as const, cost: 0 };
    game.player.board = [filler, { ...filler, uid: "filler-p2" }, { ...filler, uid: "filler-p3" }, { ...filler, uid: "filler-p4" }];
    game.enemy.board = [{ ...filler, uid: "filler-e1" }, { ...filler, uid: "filler-e2" }, { ...filler, uid: "filler-e3" }, { ...filler, uid: "filler-e4" }];
    expect(queueCard(game, "player", pCard.uid, 0).ok).toBe(true);
    expect(queueCard(game, "enemy", eCard.uid, 0).ok).toBe(true);
    game.player.locked = true;
    game.enemy.locked = true;
    resolveRound(game, () => 0.5);
    expect(game.player.stability).toBe(0);
    expect(game.enemy.stability).toBe(0);
    expect(game.winner).toBe("draw");
  });

  it("стартовая колода собрана из существующих уникальных карт", () => {
    expect(DEFAULT_DECK.every(id => CARD_BY_ID.has(id))).toBe(true);
    expect(DEFAULT_DECK).toContain("raid");
    expect(CARDS.find(card => card.id === "raid")?.cost).toBe(-2);
  });
});