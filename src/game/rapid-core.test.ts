import { describe, expect, it } from "vitest";
import { CARDS, CARD_BY_ID, DEFAULT_DECK } from "./cards";
import { createGame, queueCard, resolveRound, type CardInstance } from "./rapid-core";

function instance(id: string, uid: string): CardInstance {
  const def = CARD_BY_ID.get(id);
  if (!def) throw new Error("Unknown card: " + id);
  return { ...def, uid, playedRound: 0 };
}
function ready(game: ReturnType<typeof createGame>): void {
  game.player.locked = true;
  game.enemy.locked = true;
}

describe("Rapid core — новая кор-механика", () => {
  it("имеет стартовую коллекцию уникальных карт и синглтон-колоду из 14 карт", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(CARDS.map(card => card.id)).size).toBe(CARDS.length);
    expect(DEFAULT_DECK).toHaveLength(14);
    expect(new Set(DEFAULT_DECK).size).toBe(14);
    expect(createGame(DEFAULT_DECK, () => 0.5).player.stability).toBe(30);
    expect(createGame(DEFAULT_DECK, () => 0.5).settings.maxStability).toBe(30);
  });

  it("инициатива у игрока с меньшей Стойкостью; при равенстве используется random", () => {
    const game = createGame(DEFAULT_DECK, () => 0.1);
    game.player.stability = 18;
    game.enemy.stability = 22;
    ready(game);
    resolveRound(game, () => 0.5);
    expect(game.lastRoundEvents[0]).toEqual({ type: "initiative", side: "player" });

    const tied = createGame(DEFAULT_DECK, () => 0.5);
    ready(tied);
    resolveRound(tied, () => 0.1);
    expect(tied.lastRoundEvents[0]).toEqual({ type: "initiative", side: "player" });
  });

  it("закрытая карта, убранная до её вскрытия, не платит и не активируется", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const remover = instance("hook", "remover");
    const victim = instance("glass-cannon", "victim");
    game.player.hand = [remover];
    game.enemy.hand = [victim];
    game.player.stability = 20;
    game.enemy.stability = 20;
    queueCard(game, "player", remover.uid, 0);
    queueCard(game, "enemy", victim.uid, 0);
    // Hook targets the enemy slot to the left of slot 1: no slot exists, so use a dedicated opposite-target remover.
    const direct = { ...remover, id: "test-remove", target: "opposite" as const, action: "remove" as const, cost: 0 };
    game.player.committed[0] = { card: direct, targetSlot: 0, paid: 0 };
    ready(game);
    resolveRound(game, () => 0.5);
    expect(game.enemy.stability).toBe(23);
    expect(game.lastRoundEvents.some(event => event.type === "reveal" && event.card.uid === "victim")).toBe(false);
    expect(game.enemy.discard.some(card => card.uid === "victim")).toBe(true);
  });

  it("правило стола: занятые слоты снижают стойкость врага, пустые лечат владельца", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    game.player.board = [instance("token", "p1"), instance("token", "p2"), null, null];
    game.enemy.board = [instance("token", "e1"), null, null, null];
    game.player.stability = 20;
    game.enemy.stability = 20;
    ready(game);
    resolveRound(game, () => 0.5);
    expect(game.player.stability).toBe(20 + 2 - 1);
    expect(game.enemy.stability).toBe(20 + 3 - 2);
  });

  it("не позволяет оплатить карту, если стоимость обнуляет Стойкость", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    const card = { ...instance("glass-cannon", "expensive"), cost: 2 };
    game.player.hand = [card];
    game.player.stability = 2;
    game.enemy.stability = 30;
    queueCard(game, "player", card.uid, 0);
    ready(game);
    resolveRound(game, () => 0.5);
    expect(game.player.stability).toBe(6); // карта не платит; четыре пустых слота восстанавливают
    expect(game.player.discard.some(item => item.uid === "expensive")).toBe(true);
    expect(game.lastRoundEvents.some(event => event.type === "reveal" && event.card.uid === "expensive")).toBe(false);
  });

  it("штрафует усталостью по 2 Стойкости за каждую недостающую карту", () => {
    const game = createGame(DEFAULT_DECK, () => 0.5);
    game.player.hand = [];
    game.player.deck = [];
    game.enemy.hand = [];
    game.enemy.deck = [];
    game.player.board = [null, null, null, null];
    game.enemy.board = [null, null, null, null];
    ready(game);
    resolveRound(game, () => 0.5);
    expect(game.lastRoundEvents.filter(event => event.type === "fatigue" && event.side === "player")).toHaveLength(4);
    expect(game.player.stability).toBe(22); // +4 за пустое поле с капом 30, затем -8 усталости
  });
});
