import { CARDS, CARD_BY_ID, DEFAULT_DECK, type CardDef, type Effect, type Side } from "./cards";

export type Winner = Side | "draw" | null;
export interface CardInstance extends CardDef {
  uid: string;
  playedRound: number;
}
export interface PlannedCard {
  card: CardInstance;
  targetSlot: number;
  paid: number;
}
export interface PlayerState {
  stability: number;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  board: Array<CardInstance | null>;
  committed: PlannedCard[];
  locked: boolean;
  nextBoost: number;
  pendingDamage: number;
  swapUsed: boolean;
}
export interface GameSettings {
  startStability: number;
  maxStability: number;
  deckSize: number;
  startHand: number;
  handLimit: number;
  slots: number;
  maxPlays: number;
  roundLimit: number;
}
export interface GameState {
  round: number;
  player: PlayerState;
  enemy: PlayerState;
  settings: GameSettings;
  winner: Winner;
  log: string[];
  playedByEnemy: CardInstance[];
}
const DEFAULT_SETTINGS: GameSettings = {
  startStability: 30, maxStability: 60, deckSize: 12, startHand: 4,
  handLimit: 6, slots: 3, maxPlays: 2, roundLimit: 7,
};
let nextUid = 1;
const sides: Side[] = ["player", "enemy"];
const other = (side: Side): Side => side === "player" ? "enemy" : "player";
const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, n));
const cloneCard = (def: CardDef): CardInstance => ({
  ...def, effect: { ...def.effect }, uid: "c" + nextUid++, playedRound: 0,
});
function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pushLog(game: GameState, message: string): void {
  game.log.unshift(message);
  if (game.log.length > 16) game.log.length = 16;
}
function draw(player: PlayerState, count: number, settings: GameSettings, random: () => number): number {
  let drawn = 0;
  for (let i = 0; i < count && player.hand.length < settings.handLimit && player.deck.length; i++) {
    player.hand.push(player.deck.pop()!);
    drawn++;
  }
  return drawn;
}
function makePlayer(defs: CardDef[], settings: GameSettings, random: () => number): PlayerState {
  const deck = shuffle(defs.map(cloneCard), random);
  const player: PlayerState = {
    stability: settings.startStability,
    hand: [], deck, discard: [], board: Array(settings.slots).fill(null),
    committed: [], locked: false, nextBoost: 0, pendingDamage: 0, swapUsed: false,
  };
  draw(player, settings.startHand, settings, random);
  return player;
}
function sanitizeDeck(ids: string[]): string[] {
  const result: string[] = [];
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!CARD_BY_ID.has(id) || (counts.get(id) ?? 0) >= 2 || result.length >= 12) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    result.push(id);
  }
  if (result.length !== 12) return [...DEFAULT_DECK];
  return result;
}
export function createGame(deckIds: string[] = DEFAULT_DECK, random: () => number = Math.random): GameState {
  nextUid = 1;
  const settings = { ...DEFAULT_SETTINGS };
  const playerIds = sanitizeDeck(deckIds);
  const playerDefs = playerIds.map(id => CARD_BY_ID.get(id)!);
  const enemyDefs = shuffle(CARDS, random).slice(0, settings.deckSize);
  const game: GameState = {
    round: 1,
    player: makePlayer(playerDefs, settings, random),
    enemy: makePlayer(enemyDefs, settings, random),
    settings, winner: null, log: ["Раунд 1. Выбери карты и места на поле."], playedByEnemy: [],
  };
  return game;
}

export function queueCard(game: GameState, side: Side, cardUid: string, targetSlot: number): { ok: boolean; message: string } {
  const p = game[side];
  if (game.winner || p.locked) return { ok: false, message: "Выбор уже закрыт." };
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= game.settings.slots) {
    return { ok: false, message: "Такого места на поле нет." };
  }
  if (p.committed.length >= game.settings.maxPlays) return { ok: false, message: "За раунд можно разыграть не больше двух карт." };
  if (p.committed.some(item => item.targetSlot === targetSlot)) return { ok: false, message: "Это место уже занято выбранной картой." };
  const handIndex = p.hand.findIndex(card => card.uid === cardUid);
  if (handIndex < 0) return { ok: false, message: "Карты больше нет в руке." };
  const card = p.hand[handIndex];
  if (p.stability - card.cost < 1) return { ok: false, message: "После оплаты должно остаться хотя бы 1 Стабильности." };
  p.stability -= card.cost;
  p.hand.splice(handIndex, 1);
  p.committed.push({ card, targetSlot, paid: card.cost });
  return { ok: true, message: "Карта выбрана. Стабильность списана." };
}
export function unqueueCard(game: GameState, side: Side, cardUid: string): boolean {
  const p = game[side];
  if (p.locked || game.winner) return false;
  const index = p.committed.findIndex(item => item.card.uid === cardUid);
  if (index < 0) return false;
  const [planned] = p.committed.splice(index, 1);
  p.stability = clamp(p.stability + planned.paid, game.settings.maxStability);
  p.hand.push(planned.card);
  return true;
}
export function swapCard(game: GameState, side: Side, cardUid: string, random: () => number = Math.random): { ok: boolean; message: string } {
  const p = game[side];
  if (p.locked || game.winner) return { ok: false, message: "Выбор уже закрыт." };
  if (p.swapUsed) return { ok: false, message: "Замена уже использована в этом раунде." };
  const index = p.hand.findIndex(card => card.uid === cardUid);
  if (index < 0) return { ok: false, message: "Карты нет в руке." };
  const [discarded] = p.hand.splice(index, 1);
  p.discard.push(discarded);
  if (p.deck.length && p.hand.length < game.settings.handLimit) p.hand.push(p.deck.pop()!);
  p.swapUsed = true;
  return { ok: true, message: "Карта сброшена, новая взята из колоды." };
}
export function lockPlayerAndResolve(game: GameState, random: () => number = Math.random): void {
  if (game.winner || game.player.locked) return;
  aiCommit(game, random);
  game.player.locked = true;
  resolveRound(game, random);
}

interface Outcome {
  damage: number;
  heal: number;
  transfer: number;
  draw: number;
  remove: number;
  returns: number;
  boost: number;
  delayed: number;
  shield: number;
  curse: boolean;
}
function emptyOutcome(): Outcome {
  return { damage: 0, heal: 0, transfer: 0, draw: 0, remove: 0, returns: 0, boost: 0, delayed: 0, shield: 0, curse: false };
}
function fieldCount(p: PlayerState): number {
  return p.board.reduce((n, card) => n + (card ? 1 : 0), 0);
}
function hasEffectCondition(effect: Effect, game: GameState, side: Side): boolean {
  const p = game[side];
  const foe = game[other(side)];
  const ownCount = fieldCount(p);
  const enemyCount = fieldCount(foe);
  switch (effect.kind) {
    case "if-own-more": return ownCount > enemyCount;
    case "if-own-less": return ownCount < enemyCount;
    case "enemy-played-more": return foe.committed.length > (effect.threshold ?? 1);
    case "enemy-played-less": return foe.committed.length <= (effect.threshold ?? 1);
    case "own-played-more": return p.committed.length > (effect.threshold ?? 1);
    case "own-played-less": return p.committed.length <= (effect.threshold ?? 1);
    case "if-enemy-stability-low": return foe.stability <= (effect.threshold ?? 10);
    case "if-own-stability-low": return p.stability <= (effect.threshold ?? 10);
    default: return true;
  }
}
function accumulate(out: Outcome, game: GameState, side: Side, card: CardInstance, timing: "play" | "end"): void {
  if (card.timing !== timing) return;
  const p = game[side];
  const foe = game[other(side)];
  const e = card.effect;
  const amount = e.amount;
  switch (e.kind) {
    case "damage": out.damage += amount; break;
    case "heal": out.heal += amount; break;
    case "transfer": out.damage += amount; out.transfer += amount; break;
    case "draw": out.draw += amount; break;
    case "remove": out.remove += amount; break;
    case "return": out.returns += amount; break;
    case "boost": out.boost += amount; break;
    case "delay": out.delayed += amount; break;
    case "guard": out.shield += amount; break;
    case "curse": out.curse = true; break;
    case "own-count": out.damage += fieldCount(p) * amount; break;
    case "enemy-count": out.damage += fieldCount(foe) * amount; break;
    case "own-heal": out.heal += fieldCount(p) * amount; break;
    case "payoff": out.damage += amount * (p.stability <= (e.min ?? 10) ? 2 : 1); break;
    case "total-count": out.damage += (fieldCount(p) + fieldCount(foe)) * amount; break;
    case "hand-count": out.heal += p.hand.length * amount; break;
    case "enemy-hand-count": out.damage += foe.hand.length * amount; break;
    case "if-own-more":
    case "if-own-less":
    case "enemy-played-more":
    case "enemy-played-less":
    case "own-played-more":
    case "own-played-less":
      if (hasEffectCondition(e, game, side)) out.damage += amount;
      break;
    case "if-enemy-stability-low":
      if (hasEffectCondition(e, game, side)) out.damage += amount;
      break;
    case "if-own-stability-low":
      if (hasEffectCondition(e, game, side)) out.heal += amount;
      break;
  }
}
function resolveRemovals(game: GameState, outcomes: Record<Side, Outcome>, oldUids: Record<Side, Set<string>>): void {
  for (const side of sides) {
    const targetSide = other(side);
    const target = game[targetSide];
    const candidates = target.board
      .map((card, slot) => ({ card, slot }))
      .filter((item): item is { card: CardInstance; slot: number } => !!item.card && oldUids[targetSide].has(item.card.uid));
    candidates.sort((a, b) => cardBoardValue(b.card) - cardBoardValue(a.card));
    for (let n = 0; n < outcomes[side].remove && candidates.length; n++) {
      const victim = candidates.shift()!;
      target.board[victim.slot] = null;
      target.discard.push(victim.card);
      pushLog(game, (side === "player" ? "Ты" : "Соперник") + " убрал карту «" + victim.card.name + "».");
    }
  }
}
function resolveReturns(game: GameState, outcomes: Record<Side, Outcome>): void {
  for (const side of sides) {
    const p = game[side];
    for (let n = 0; n < outcomes[side].returns && p.hand.length < game.settings.handLimit; n++) {
      const slot = p.board.findIndex(card => card !== null && card.playedRound < game.round);
      if (slot < 0) break;
      const card = p.board[slot]!;
      p.board[slot] = null;
      card.playedRound = 0;
      p.hand.push(card);
      pushLog(game, (side === "player" ? "Ты" : "Соперник") + " вернул «" + card.name + "» в руку.");
    }
  }
}
function checkWinner(game: GameState): void {
  const pDown = game.player.stability <= 0;
  const eDown = game.enemy.stability <= 0;
  if (pDown && eDown) game.winner = "draw";
  else if (pDown) game.winner = "enemy";
  else if (eDown) game.winner = "player";
}
function beginNextRound(game: GameState, random: () => number): void {
  game.round++;
  const afterFatigue: Record<Side, number> = { player: 0, enemy: 0 };
  for (const side of sides) {
    const p = game[side];
    p.locked = false;
    p.swapUsed = false;
    afterFatigue[side] = p.pendingDamage;
    p.pendingDamage = 0;
  }
  for (const side of sides) game[side].stability = clamp(game[side].stability - afterFatigue[side], game.settings.maxStability);
  for (const side of sides) {
    if (afterFatigue[side] > 0) pushLog(game, (side === "player" ? "Ты теряешь" : "Соперник теряет") + " " + afterFatigue[side] + " Стабильности от отложенного эффекта.");
  }
  checkWinner(game);
  if (game.winner) return;
  for (const side of sides) {
    const p = game[side];
    if (p.deck.length) draw(p, 1, game.settings, random);
    else {
      p.stability = clamp(p.stability - 2, game.settings.maxStability);
      pushLog(game, (side === "player" ? "У тебя" : "У соперника") + " закончилась колода: −2 Стабильности.");
    }
  }
  checkWinner(game);
  if (!game.winner) pushLog(game, "Раунд " + game.round + ": выбери до двух карт.");
}
export function resolveRound(game: GameState, random: () => number = Math.random): void {
  if (game.winner || !game.player.locked || !game.enemy.locked) return;
  const oldUids: Record<Side, Set<string>> = {
    player: new Set(game.player.board.flatMap(card => card ? [card.uid] : [])),
    enemy: new Set(game.enemy.board.flatMap(card => card ? [card.uid] : [])),
  };
  const newlyPlayed: Record<Side, CardInstance[]> = { player: [], enemy: [] };
  for (const side of sides) {
    const p = game[side];
    for (const plan of p.committed) {
      const previous = p.board[plan.targetSlot];
      if (previous) {
        p.discard.push(previous);
        pushLog(game, (side === "player" ? "Ты заменил" : "Соперник заменил") + " «" + previous.name + "».");
      }
      plan.card.playedRound = game.round;
      p.board[plan.targetSlot] = plan.card;
      newlyPlayed[side].push(plan.card);
      if (side === "enemy") game.playedByEnemy.unshift(plan.card);
      pushLog(game, (side === "player" ? "Ты разыграл" : "Соперник разыграл") + " «" + plan.card.name + "».");
    }
  }
  const out: Record<Side, Outcome> = { player: emptyOutcome(), enemy: emptyOutcome() };
  for (const side of sides) {
    for (const card of newlyPlayed[side]) accumulate(out[side], game, side, card, "play");
  }
  resolveRemovals(game, out, oldUids);
  resolveReturns(game, out);
  for (const side of sides) {
    for (const card of game[side].board) if (card) accumulate(out[side], game, side, card, "end");
  }
  // Calculate both sides' boosts before applying either side's Stability change.
  // This preserves truly simultaneous resolution (no first-side advantage).
  for (const side of sides) {
    const p = game[side];
    if (out[side].damage > 0) {
      out[side].damage += p.nextBoost + out[side].boost;
      p.nextBoost = 0;
    } else {
      p.nextBoost += out[side].boost;
    }
  }
  for (const side of sides) {
    const p = game[side];
    const foeOut = out[other(side)];
    // The defending side's own shield reduces its incoming Stability loss.
    const incoming = Math.max(0, foeOut.damage - out[side].shield);
    const healing = foeOut.curse ? 0 : out[side].heal + out[side].transfer;
    p.stability = clamp(p.stability - incoming + healing, game.settings.maxStability);
    p.pendingDamage += foeOut.delayed;
    if (foeOut.damage > 0) pushLog(game, (side === "player" ? "Ты теряешь" : "Соперник теряет") + " " + incoming + " Стабильности.");
    if (healing > 0) pushLog(game, (side === "player" ? "Ты восстанавливаешь" : "Соперник восстанавливает") + " " + healing + " Стабильности.");
  }
  for (const side of sides) {
    const p = game[side];
    draw(p, out[side].draw, game.settings, random);
    p.committed = [];
    p.locked = false;
  }
  game.playedByEnemy.length = Math.min(game.playedByEnemy.length, 20);
  checkWinner(game);
  if (game.winner) {
    pushLog(game, game.winner === "draw" ? "Ничья: обе шкалы Стабильности обнулились." : game.winner === "player" ? "Победа! Стабильность соперника обнулилась." : "Поражение. Твоя Стабильность обнулилась.");
    return;
  }
  if (game.round >= game.settings.roundLimit) {
    if (game.player.stability > game.enemy.stability) game.winner = "player";
    else if (game.enemy.stability > game.player.stability) game.winner = "enemy";
    else game.winner = "draw";
    pushLog(game, game.winner === "draw" ? "Ничья по Стабильности после 7 раундов." : "После 7 раундов больше Стабильности у " + (game.winner === "player" ? "тебя." : "соперника."));
    return;
  }
  beginNextRound(game, random);
}
function cardBoardValue(card: CardInstance): number {
  const a = card.effect.amount;
  const kind = card.effect.kind;
  const base: Record<string, number> = {
    damage: a * 1.6, heal: a * 1.1, transfer: a * 2.4, draw: a * 1.3,
    remove: a * 2.8, return: a * 1.1, boost: a * 1.0, delay: a * 1.5,
    guard: a * 1.2, curse: 3.5, "own-count": a * 2.2, "enemy-count": a * 2.2,
    "own-heal": a * 1.8, payoff: a * 1.8, "total-count": a * 1.8,
    "hand-count": a * 1.1, "enemy-hand-count": a * 1.7, "if-own-more": a * 1.5,
    "if-own-less": a * 1.5, "enemy-played-more": a * 1.5, "enemy-played-less": a * 1.5,
    "own-played-more": a * 1.5, "own-played-less": a * 1.5,
    "if-enemy-stability-low": a * 1.8, "if-own-stability-low": a * 1.4,
  };
  return (base[kind] ?? a) * (card.timing === "end" ? 2.1 : 1) - card.cost * 0.4;
}
export function rateCard(card: CardDef): number {
  return cardBoardValue({ ...card, effect: { ...card.effect }, uid: "rating", playedRound: 0 });
}
export function aiCommit(game: GameState, random: () => number = Math.random): void {
  const p = game.enemy;
  if (p.locked || game.winner) return;
  const candidates = [...p.hand].sort((a, b) => rateCard(b) - rateCard(a));
  for (const card of candidates) {
    if (p.committed.length >= game.settings.maxPlays) break;
    if (p.stability - card.cost < 1) continue;
    let used = new Set(p.committed.map(item => item.targetSlot));
    let slot = p.board.findIndex((item, index) => item === null && !used.has(index));
    if (slot < 0) {
      const options = p.board
        .map((old, index) => ({ old, index }))
        .filter(item => !used.has(item.index))
        .sort((a, b) => cardBoardValue(a.old!) - cardBoardValue(b.old!));
      if (!options.length) break;
      const weakest = options[0];
      if (rateCard(card) < cardBoardValue(weakest.old!) * 0.85 && p.stability > 12) continue;
      slot = weakest.index;
    }
    if (random() < 0.08 && p.stability > 12) continue;
    queueCard(game, "enemy", card.uid, slot);
  }
  p.locked = true;
}
