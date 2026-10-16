import { CARDS, type CardDef } from "./cards.ts";

export type Side = "player" | "enemy";

export interface Card extends CardDef { uid: string; playedRound: number; targetSlot?: number; costDelta?: number }

export interface Player {
  stability: number;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  board: Array<Card | null>;
  committed: Card[];
  locked: boolean;
  boost: number;
  delayed: number;
  cursed: boolean;
  swapUsed: boolean;
}

export interface Settings { startStability: 15 | 20 | 30; maxPlays: 0 | 2; handLimit: number; deckSize: number }

export interface Game {
  round: number;
  player: Player;
  enemy: Player;
  settings: Settings;
  firstResolver: Side;
  winner: Side | "draw" | null;
  log: string[];
  playedByEnemy: Card[];
}

const MAX_STABILITY = 60;
const LOW_STABILITY = 8;
let uid = 1;

const clone = (d: CardDef): Card => ({ ...d, effect: { ...d.effect }, uid: String(uid++), playedRound: 0 });

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function draw(p: Player, count: number, settings: Settings, random: () => number = Math.random): void {
  for (let i = 0; i < count && p.hand.length < settings.handLimit; i++) {
    if (!p.deck.length && p.discard.length) p.deck = shuffle(p.discard.splice(0), random);
    if (!p.deck.length) break;
    p.hand.push(p.deck.pop()!);
  }
}

function newPlayer(settings: Settings, random: () => number): Player {
  return {
    stability: settings.startStability,
    hand: [],
    deck: shuffle(CARDS, random).slice(0, settings.deckSize).map(clone),
    discard: [],
    board: Array(6).fill(null),
    committed: [],
    locked: false,
    boost: 0,
    delayed: 0,
    cursed: false,
    swapUsed: false,
  };
}

/** Resolve "at game start" cards from the deck once, then refill the opening hand. */
export function applyOpeningEffects(game: Game, random: () => number = Math.random): void {
  const clamp=(v:number)=>Math.max(0,Math.min(MAX_STABILITY,v));
  for(const side of ["player","enemy"] as Side[]){
    const p=game[side], foe=game[side==="player"?"enemy":"player"];
    const opening=[...p.hand,...p.deck].filter(card=>card.timing==="start");
    if(!opening.length)continue;
    const ids=new Set(opening.map(card=>card.uid));
    p.hand=p.hand.filter(card=>!ids.has(card.uid));
    p.deck=p.deck.filter(card=>!ids.has(card.uid));
    for(const card of opening){
      const a=card.effect.amount;
      switch(card.effect.kind){
        case "damage":foe.stability=clamp(foe.stability-a);break;
        case "heal":p.stability=clamp(p.stability+a);break;
        case "transfer":{const moved=Math.min(a,foe.stability,MAX_STABILITY-p.stability);foe.stability=clamp(foe.stability-moved);p.stability=clamp(p.stability+moved);break;}
        case "draw":draw(p,a,game.settings,random);break;
        case "boost":p.boost+=a;break;
        case "delay":p.delayed+=a;break;
        case "hand-count":p.stability=clamp(p.stability+p.hand.length*a);break;
        case "enemy-hand-count":foe.stability=clamp(foe.stability-foe.hand.length*a);break;
      }
      game.log.push("Начало игры: «"+card.name+"» срабатывает.");
    }
    draw(p,Math.max(0,5-p.hand.length),game.settings,random);
  }
  const pd=game.player.stability===0,ed=game.enemy.stability===0;
  if(pd&&ed)game.winner="draw";else if(pd)game.winner="enemy";else if(ed)game.winner="player";
}

export function createGame(options: Partial<Settings> = {}, random: () => number = Math.random): Game {
  uid = 1;
  const settings: Settings = { startStability: 20, maxPlays: 0, handLimit: 6, deckSize: 30, ...options };
  const game: Game = {
    round: 1,
    player: newPlayer(settings, random),
    enemy: newPlayer(settings, random),
    settings,
    firstResolver: random() < 0.5 ? "player" : "enemy",
    winner: null,
    log: [],
    playedByEnemy: [],
  };
  draw(game.player, 5, settings, random);
  draw(game.enemy, 5, settings, random);
  return game;
}

export function selectCard(game: Game, side: Side, id: string): { ok: boolean; message: string } {
  const p = game[side];
  if (game.winner || p.locked) return { ok: false, message: "Выбор закрыт." };
  const committedIndex = p.committed.findIndex(c => c.uid === id);
  if (committedIndex >= 0) {
    const c = p.committed.splice(committedIndex, 1)[0];
    p.stability = Math.max(1, Math.min(MAX_STABILITY, p.stability - (c.costDelta ?? -c.cost)));
    delete c.costDelta;
    p.hand.push(c);
    return { ok: true, message: "Карта убрана из выбора." };
  }
  const handIndex = p.hand.findIndex(c => c.uid === id);
  if (handIndex < 0) return { ok: false, message: "Карты нет в руке." };
  const c = p.hand[handIndex];
  if (game.settings.maxPlays && p.committed.length >= game.settings.maxPlays) return { ok: false, message: "Лимит карт за раунд." };
  if (p.board.every(Boolean) || p.committed.length >= p.board.filter(card => card === null).length) return { ok: false, message: "Сначала освободи слот." };
  if (p.stability - c.cost < 1) return { ok: false, message: "Нельзя уйти ниже 1 Стабильности." };
  const beforeCost = p.stability;
  p.stability = Math.max(1, Math.min(MAX_STABILITY, p.stability - c.cost));
  c.costDelta = p.stability - beforeCost;
  p.hand.splice(handIndex, 1);
  p.committed.push(c);
  return { ok: true, message: "Карта выбрана закрыто; цена списана." };
}

export function removeOwn(game: Game, side: Side, id: string): void {
  const p = game[side];
  if (p.locked || game.winner) return;
  const i = p.board.findIndex(c => c?.uid === id);
  if (i >= 0) {
    p.discard.push(p.board[i]!);
    p.board[i] = null;
  }
}

export function commit(game: Game, side: Side): void {
  game[side].locked = true;
}

/** Free once-per-round cycle: discard one card and draw one. No Stability cost. */
export function swapCard(game: Game, side: Side, id: string, random: () => number = Math.random): { ok: boolean; message: string } {
  const p = game[side];
  if (game.winner || p.locked) return { ok: false, message: "Выбор закрыт." };
  if (p.swapUsed) return { ok: false, message: "Замена уже использована в этом раунде." };
  const i = p.hand.findIndex(c => c.uid === id);
  if (i < 0) return { ok: false, message: "Карты нет в руке." };
  const [card] = p.hand.splice(i, 1);
  p.discard.push(card);
  draw(p, 1, game.settings, random);
  p.swapUsed = true;
  return { ok: true, message: "Карта заменена." };
}

interface Hit { value: number; transfer: boolean }
interface Outcome {
  hits: Hit[];
  heal: number;
  transferTotal: number;
  draw: number;
  boost: number;
  delay: number;
  removals: number;
  returns: number;
  curse: boolean;
}

function emptyOutcome(): Outcome {
  return { hits: [], heal: 0, transferTotal: 0, draw: 0, boost: 0, delay: 0, removals: 0, returns: 0, curse: false };
}

/** Counts living cards on the board. Committed cards are already placed on the board
 *  before effects resolve, so `committed` must NOT be added again here. */
function fieldCount(p: Player, dead: Set<string>): number {
  let n = 0;
  for (const c of p.board) if (c && !dead.has(c.uid)) n++;
  return n;
}

/**
 * Resolves a single card effect into an Outcome. Effects read only the round-start
 * snapshot (field counts, alive cards), so neither side can "react" to the other's
 * resolved effects within the same round.
 */
function accumulate(out: Outcome, game: Game, side: Side, c: Card, timing: "play" | "end", boostLeft: { value: number }, dead: Set<string>): void {
  if (c.timing !== timing) return;
  const p = game[side];
  const foe = game[side === "player" ? "enemy" : "player"];
  const e = c.effect;
  let amount = e.amount;
  if (timing === "play" && boostLeft.value > 0) { amount += boostLeft.value; boostLeft.value = 0; }
  switch (e.kind) {
    case "damage": out.hits.push({ value: amount, transfer: false }); break;
    case "heal": out.heal += amount; break;
    case "own-heal": out.heal += fieldCount(p, dead) * amount; break;
    case "draw": out.draw += amount; break;
    case "remove": out.removals += amount; break;
    case "return": out.returns += amount; break;
    case "boost": out.boost += amount; break;
    case "delay": out.delay += amount; break;
    case "own-count": out.hits.push({ value: fieldCount(p, dead) * amount, transfer: false }); break;
    case "enemy-count": out.hits.push({ value: fieldCount(foe, dead) * amount, transfer: false }); break;
    case "transfer": out.hits.push({ value: amount, transfer: true }); out.transferTotal += amount; break;
    case "guard": break;
    case "curse": out.curse = true; break;
    case "payoff": out.hits.push({ value: amount * (p.stability < (e.min ?? LOW_STABILITY) ? 2 : 1), transfer: false }); break;
    case "total-count": out.hits.push({ value: (fieldCount(p, dead) + fieldCount(foe, dead)) * amount, transfer: false }); break;
    case "hand-count": out.heal += p.hand.length * amount; break;
    case "enemy-hand-count": out.hits.push({ value: foe.hand.length * amount, transfer: false }); break;
    case "if-own-more": if (fieldCount(p, dead) > fieldCount(foe, dead)) out.hits.push({ value: amount, transfer: false }); break;
    case "if-own-less": if (fieldCount(p, dead) < fieldCount(foe, dead)) out.hits.push({ value: amount, transfer: false }); break;
    case "enemy-played-more": if (foe.committed.length > (e.threshold ?? 1)) out.hits.push({ value: amount, transfer: false }); break;
    case "enemy-played-less": if (foe.committed.length < (e.threshold ?? 2)) out.hits.push({ value: amount, transfer: false }); break;
    case "own-played-more": if (p.committed.length > (e.threshold ?? 1)) out.hits.push({ value: amount, transfer: false }); break;
    case "own-played-less": if (p.committed.length < (e.threshold ?? 2)) out.hits.push({ value: amount, transfer: false }); break;
    case "if-enemy-stability-low": if (foe.stability <= (e.threshold ?? 10)) out.hits.push({ value: amount, transfer: false }); break;
    case "if-own-stability-low": if (p.stability <= (e.threshold ?? 10)) out.heal += amount; break;
  }
}

export function resolveRound(game: Game, random: () => number = Math.random): void {
  if (game.winner || !game.player.locked || !game.enemy.locked) return;
  const sides: Side[] = ["player", "enemy"];
  const other = (s: Side): Side => (s === "player" ? "enemy" : "player");

  // 1. Place committed cards on both boards (order has no gameplay effect now).
  for (const side of sides) {
    const p = game[side];
    for (const c of p.committed) {
      const preferred = c.targetSlot;
      const i = preferred !== undefined && p.board[preferred] === null ? preferred : p.board.findIndex(x => x === null);
      if (i < 0) { p.discard.push(c); continue; }
      delete c.targetSlot;
      c.playedRound = game.round;
      delete c.costDelta;
      p.board[i] = c;
      if (side === "enemy" && !game.playedByEnemy.some(item => item.uid === c.uid)) game.playedByEnemy.push(c);
    }
  }

  // 2. Play-phase effects (committed cards). Removals are chosen here, before end effects.
  const dead = new Set<string>();
  const boostLeft: Record<Side, { value: number }> = { player: { value: game.player.boost }, enemy: { value: game.enemy.boost } };
  const out: Record<Side, Outcome> = { player: emptyOutcome(), enemy: emptyOutcome() };
  for (const side of sides) {
    for (const c of game[side].committed) accumulate(out[side], game, side, c, "play", boostLeft[side], dead);
  }
  for (const side of sides) {
    const foe = game[other(side)];
    const removable = foe.board
      .map((c, i) => (c && c.playedRound < game.round ? i : -1))
      .filter(i => i >= 0);
    for (let k = 0; k < out[side].removals && removable.length > 0; k++) {
      const pick = removable.splice(Math.floor(random() * removable.length), 1)[0];
      const victim = foe.board[pick];
      if (victim) { dead.add(victim.uid); foe.discard.push(victim); foe.board[pick] = null; }
    }
  }

  // 3. End-phase effects (repeating board cards that survived removal + freshly played "end" cards).
  for (const side of sides) {
    const p = game[side];
    for (const c of p.committed) accumulate(out[side], game, side, c, "end", boostLeft[side], dead);
    for (const c of p.board) if (c && c.playedRound < game.round)
      accumulate(out[side], game, side, c, "end", boostLeft[side], dead);
    if (p.delayed > 0) { out[side].hits.push({ value: p.delayed, transfer: false }); p.delayed = 0; }
  }

  // 4. Guards: an old guard absorbs the first incoming hit (once). Transfers lose their self-heal if absorbed.
  const absorbedTransfer: Record<Side, number> = { player: 0, enemy: 0 };
  for (const target of sides) {
    const incoming = out[other(target)].hits;
    const incomingTotal = incoming.reduce((sum, h) => sum + h.value, 0);
    if (incomingTotal <= 0) continue;
    const guardIndex = game[target].board.findIndex(c => c?.effect.kind === "guard" && c.playedRound < game.round && c.timing === "end");
    if (guardIndex < 0) continue;
    const hit = incoming.find(h => h.value > 0);
    if (!hit) continue;
    if (hit.transfer) absorbedTransfer[other(target)] += hit.value;
    hit.value = 0;
    const guard = game[target].board[guardIndex]!;
    game[target].discard.push(guard);
    game[target].board[guardIndex] = null;
    game.log.push("Живая преграда поглотила удар.");
  }

  // 5. Apply all Stability changes simultaneously. Curse blocks the victim's healing this round.
  const clamp = (v: number) => Math.max(0, Math.min(MAX_STABILITY, v));
  const raw: Record<Side, number> = { player: 0, enemy: 0 };
  for (const side of sides) {
    const p = game[side];
    const incoming = out[other(side)].hits.reduce((sum, h) => sum + h.value, 0);
    const cursed = out[other(side)].curse;
    p.cursed = cursed;
    const heal = cursed ? 0 : Math.max(0, out[side].heal + out[side].transferTotal - absorbedTransfer[side]);
    raw[side] = p.stability - incoming + heal;
    p.stability = clamp(raw[side]);
    p.boost = out[side].boost;
    p.delayed = out[side].delay;
    p.committed = [];
  }
  for (const side of sides) {
    const p = game[side];
    for (let k = 0; k < out[side].draw; k++) draw(p, 1, game.settings, random);
    for (let k = 0; k < out[side].returns; k++) {
      if (p.hand.length >= game.settings.handLimit) break;
      const i = p.board.findIndex(c => c && !dead.has(c.uid) && c.playedRound < game.round);
      if (i < 0) break;
      const card = p.board[i]!;
      p.board[i] = null;
      card.playedRound = 0;
      p.hand.push(card);
    }
  }

  // 6. Winner check. A mutual wipeout is decided by overkill: whoever ends further from
  // zero (took the least excess damage) survives; only an exact tie is a true draw.
  const playerDown = game.player.stability === 0;
  const enemyDown = game.enemy.stability === 0;
  if (playerDown && enemyDown) {
    if (raw.player > raw.enemy) game.winner = "player";
    else if (raw.enemy > raw.player) game.winner = "enemy";
    else game.winner = "draw";
  } else if (playerDown) game.winner = "enemy";
  else if (enemyDown) game.winner = "player";
  if (game.winner) return;

  // 7. Next round upkeep.
  game.log.push("Раунд " + game.round + " завершён.");
  game.round++;
  for (const side of sides) {
    game[side].locked = false;
    game[side].swapUsed = false;
    game[side].cursed = false;
    draw(game[side], 1, game.settings, random);
  }
}

function cardValue(c: Card): number {
  const e = c.effect;
  const a = e.amount;
  const rep = c.timing === "end" ? 3 : 1;
  let v: number;
  switch (e.kind) {
    case "damage": v = a * rep; break;
    case "own-count": case "enemy-count": v = a * rep * 2; break;
    case "transfer": v = a * rep * 2; break;
    case "heal": v = a * rep * 0.9; break;
    case "own-heal": v = a * rep * 1.6; break;
    case "draw": v = a * 2.2; break;
    case "remove": v = a * 4; break;
    case "return": v = a * 1.6; break;
    case "boost": v = a * 1.6; break;
    case "delay": v = a * 0.7; break;
    case "guard": v = 3.2; break;
    case "curse": v = 3.5; break;
    case "payoff": v = a * 1.6; break;
    case "total-count": case "hand-count": case "enemy-hand-count": v = a * 5; break;
    case "if-own-more": case "if-own-less": case "enemy-played-more": case "enemy-played-less": case "own-played-more": case "own-played-less": v = a * 2; break;
    case "if-enemy-stability-low": case "if-own-stability-low": v = a * 1.8; break;
  }
  return v - c.cost * 0.7;
}

export function aiCommit(game: Game, random: () => number = Math.random): void {
  const p = game.enemy;
  if (p.locked || game.winner) return;
  const cards = p.hand.filter(c => p.stability - c.cost >= 1).sort((a, b) => cardValue(b) - cardValue(a));
  let count = 0;
  for (const c of cards) {
    if (count >= (game.settings.maxPlays || 6)) break;
    const reserve = p.stability <= LOW_STABILITY ? 1 : Math.max(3, Math.min(6, Math.floor(p.stability * 0.35)));
    if (p.stability - c.cost < reserve) continue;
    if (random() < 0.25) continue;
    if (p.committed.length >= p.board.filter(item => item === null).length) {
      const weakest = p.board.filter((item): item is Card => item !== null).sort((a, b) => cardValue(a) - cardValue(b))[0];
      if (!weakest || cardValue(c) <= cardValue(weakest)) break;
      removeOwn(game, "enemy", weakest.uid);
    }
    const result = selectCard(game, "enemy", c.uid);
    if (result.ok) count++;
  }
  p.locked = true;
}
