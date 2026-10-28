import { CARDS, CARD_BY_ID, DEFAULT_DECK, type CardDef, type Effect, type EffectTarget, type Side } from "./cards";
import { calculateCardPayment } from "./stability-payment";

export type Winner = Side | "draw" | null;
export interface CardInstance extends CardDef {
  uid: string;
  playedRound: number;
}
export interface PlannedCard {
  card: CardInstance;
  targetSlot: number;
  /** Actual Stability change caused by selecting this card; positive means spent. */
  stabilityDelta: number;
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
  handLimit: 4, slots: 4, maxPlays: 4, roundLimit: 7,
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
  const seen = new Set<string>();
  for (const id of ids) {
    if (!CARD_BY_ID.has(id) || seen.has(id) || result.length >= 12) continue;
    seen.add(id);
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
  if (p.committed.length >= game.settings.maxPlays) return { ok: false, message: "Все четыре слота уже выбраны." };
  if (p.committed.some(item => item.targetSlot === targetSlot)) return { ok: false, message: "Это место уже занято выбранной картой." };
  const handIndex = p.hand.findIndex(card => card.uid === cardUid);
  if (handIndex < 0) return { ok: false, message: "Карты больше нет в руке." };
  const card = p.hand[handIndex];
  const payment = calculateCardPayment(p.stability, card.cost, game.settings.maxStability);
  p.stability = payment.nextStability;
  p.hand.splice(handIndex, 1);
  p.committed.push({ card, targetSlot, stabilityDelta: payment.stabilityDelta });
  return { ok: true, message: "Карта выбрана. Стабильность списана." };
}
export function unqueueCard(game: GameState, side: Side, cardUid: string): boolean {
  const p = game[side];
  if (p.locked || game.winner) return false;
  const index = p.committed.findIndex(item => item.card.uid === cardUid);
  if (index < 0) return false;
  const [planned] = p.committed.splice(index, 1);
  p.stability = clamp(p.stability - planned.stabilityDelta, game.settings.maxStability);
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
  selfDamage: number;
  enemyHeal: number;
  targetedDestroy: { side: Side; slot: number } | null;
  targetedShift: { side: Side; from: number; to: number } | null;
}
function emptyOutcome(): Outcome {
  return { damage: 0, heal: 0, transfer: 0, draw: 0, remove: 0, returns: 0, boost: 0, delayed: 0, shield: 0, curse: false, selfDamage: 0, enemyHeal: 0, targetedDestroy: null, targetedShift: null };
}
function fieldCount(p: PlayerState): number {
  return p.board.reduce((n, card) => n + (card ? 1 : 0), 0);
}
function hasEffectCondition(effect: Effect, game: GameState, side: Side, slot: number): boolean {
  const p = game[side];
  const foe = game[other(side)];
  const ownCount = fieldCount(p);
  const enemyCount = fieldCount(foe);
  const condition = effect.condition;
  if (condition) {
    const threshold = condition.value ?? 0;
    const opposite = foe.board[slot];
    switch (condition.type) {
      case "IS_EDGE": if (slot !== 0 && slot !== game.settings.slots - 1) return false; break;
      case "IS_CENTER": if (slot === 0 || slot === game.settings.slots - 1) return false; break;
      case "OPPOSITE_EMPTY": if (opposite) return false; break;
      case "OPPOSITE_EXISTS": if (!opposite) return false; break;
      case "LEFT_EMPTY": if (slot > 0 && p.board[slot - 1]) return false; break;
      case "RIGHT_EMPTY": if (slot < game.settings.slots - 1 && p.board[slot + 1]) return false; break;
      case "OWN_HAND_MORE": if (p.hand.length <= threshold) return false; break;
      case "ENEMY_HAND_MORE": if (foe.hand.length <= threshold) return false; break;
      case "OWN_BOARD_LESS": if (ownCount >= threshold) return false; break;
      case "ENEMY_BOARD_LESS": if (enemyCount >= threshold) return false; break;
      case "OWN_DECK_LESS": if (p.deck.length >= threshold) return false; break;
      case "ENEMY_DECK_LESS": if (foe.deck.length >= threshold) return false; break;
      case "OWN_STABILITY_BELOW": if (p.stability >= threshold) return false; break;
      case "ENEMY_STABILITY_BELOW": if (foe.stability >= threshold) return false; break;
    }
  }
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
function accumulate(out: Outcome, game: GameState, side: Side, card: CardInstance, timing: "play" | "end", slot: number): void {
  if (card.timing !== timing) return;
  const p = game[side];
  const foe = game[other(side)];
  const e = card.effect;
  const amount = e.amount;
  if (!hasEffectCondition(e, game, side, slot)) return;
  if (e.action) {
    const target: EffectTarget = e.target ?? "opposite";
    const targetSide: Side = target === "self" || target === "adjacent" ? side : other(side);
    if (e.action === "damage") {
      if (target === "self") out.selfDamage += amount;
      else out.damage += amount;
    } else if (e.action === "heal") {
      if (target === "opposite") out.enemyHeal += amount;
      else out.heal += amount;
    } else if (e.action === "destroy") {
      let targetSlot = -1;
      if (target === "opposite" || target === "self") targetSlot = slot;
      else if (target === "adjacent") {
        const left = slot - 1;
        const right = slot + 1;
        targetSlot = left >= 0 && game[targetSide].board[left] ? left : right < game.settings.slots && game[targetSide].board[right] ? right : -1;
      } else {
        targetSlot = game[targetSide].board.findIndex(Boolean);
      }
      if (targetSlot >= 0) out.targetedDestroy = { side: targetSide, slot: targetSlot };
    } else if (e.action === "shift") {
      let from = -1;
      if (target === "opposite" || target === "self") from = slot;
      else if (target === "adjacent") {
        const left = slot - 1;
        const right = slot + 1;
        from = left >= 0 && game[targetSide].board[left] ? left : right < game.settings.slots && game[targetSide].board[right] ? right : -1;
      } else {
        from = game[targetSide].board.findIndex(Boolean);
      }
      if (from >= 0) {
        const direction = amount < 0 ? -1 : 1;
        const to = from + direction;
        if (to >= 0 && to < game.settings.slots && !game[targetSide].board[to]) out.targetedShift = { side: targetSide, from, to };
      }
    }
    return;
  }
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
      if (hasEffectCondition(e, game, side, slot)) out.damage += amount;
      break;
    case "if-enemy-stability-low":
      if (hasEffectCondition(e, game, side, slot)) out.damage += amount;
      break;
    case "if-own-stability-low":
      if (hasEffectCondition(e, game, side, slot)) out.heal += amount;
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
function beginNextRound(game: GameState): void {
  const delayed: Record<Side, number> = { player: 0, enemy: 0 };
  for (const side of sides) {
    const p = game[side];
    delayed[side] = p.pendingDamage;
    p.pendingDamage = 0;
    p.locked = false;
    p.swapUsed = false;
  }
  for (const side of sides) {
    if (delayed[side] > 0) {
      game[side].stability = clamp(game[side].stability - delayed[side], game.settings.maxStability);
      pushLog(game, (side === "player" ? "Ты теряешь" : "Соперник теряет") + " " + delayed[side] + " Стабильности от отложенного эффекта.");
    }
  }
  checkWinner(game);
  if (game.winner) return;
  game.round++;
  if (!game.winner) pushLog(game, "Раунд " + game.round + ": выбери карты для четырёх слотов.");
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
      pushLog(game, (side === "player" ? "Ты выставил" : "Соперник выставил") + " закрытую карту в слот " + (plan.targetSlot + 1) + ".");
    }
  }

  const shields: Record<Side, number> = { player: 0, enemy: 0 };
  const cursed: Record<Side, boolean> = { player: false, enemy: false };
  const applyEffect = (side: Side, card: CardInstance, timing: "play" | "end") => {
    if (game.winner || card.timing !== timing) return;
    const out = emptyOutcome();
    accumulate(out, game, side, card, timing, game[side].board.findIndex(item => item?.uid === card.uid));
    const p = game[side];
    const foeSide = other(side);
    const foe = game[foeSide];
    let damage = out.damage;
    if (damage > 0) {
      damage += p.nextBoost + out.boost;
      p.nextBoost = 0;
      const actual = Math.max(0, damage - shields[foeSide]);
      foe.stability = clamp(foe.stability - actual, game.settings.maxStability);
      if (actual > 0) pushLog(game, (side === "player" ? "Твоя карта" : "Карта соперника") + " снижает Стабильность " + (foeSide === "player" ? "тебе" : "сопернику") + " на " + actual + ".");
    } else {
      p.nextBoost += out.boost;
    }
    if (out.selfDamage > 0) {
      p.stability = clamp(p.stability - out.selfDamage, game.settings.maxStability);
      pushLog(game, (side === "player" ? "Твоя карта снижает твою" : "Карта соперника снижает его") + " Стабильность на " + out.selfDamage + ".");
    }
    if (out.enemyHeal > 0) {
      foe.stability = clamp(foe.stability + out.enemyHeal, game.settings.maxStability);
      pushLog(game, (side === "player" ? "Твоя карта восстанавливает сопернику " : "Карта соперника восстанавливает тебе ") + out.enemyHeal + " Стабильности.");
    }
    if (out.targetedDestroy) {
      const target = game[out.targetedDestroy.side];
      const victim = target.board[out.targetedDestroy.slot];
      if (victim) {
        target.board[out.targetedDestroy.slot] = null;
        target.discard.push(victim);
        pushLog(game, (side === "player" ? "Ты уничтожил" : "Соперник уничтожил") + " «" + victim.name + "» в слоте " + (out.targetedDestroy.slot + 1) + ".");
      }
    }
    if (out.targetedShift) {
      const target = game[out.targetedShift.side];
      const moving = target.board[out.targetedShift.from];
      if (moving && !target.board[out.targetedShift.to]) {
        target.board[out.targetedShift.to] = moving;
        target.board[out.targetedShift.from] = null;
        pushLog(game, "Карта «" + moving.name + "» перемещена из слота " + (out.targetedShift.from + 1) + " в слот " + (out.targetedShift.to + 1) + ".");
      }
    }
    shields[side] += out.shield;
    if (out.curse) cursed[side] = true;
    const healing = (cursed[foeSide] ? 0 : out.heal) + (cursed[foeSide] ? 0 : out.transfer);
    if (healing > 0) {
      p.stability = clamp(p.stability + healing, game.settings.maxStability);
      pushLog(game, (side === "player" ? "Ты восстанавливаешь" : "Соперник восстанавливает") + " " + healing + " Стабильности.");
    }
    if (out.delayed > 0) {
      foe.pendingDamage += out.delayed;
      pushLog(game, "Отложенный эффект: −" + out.delayed + " Стабильности в начале следующего раунда.");
    }
    if (out.remove > 0) {
      const outcomes: Record<Side, Outcome> = { player: emptyOutcome(), enemy: emptyOutcome() };
      outcomes[side].remove = out.remove;
      resolveRemovals(game, outcomes, oldUids);
    }
    if (out.returns > 0) {
      const outcomes: Record<Side, Outcome> = { player: emptyOutcome(), enemy: emptyOutcome() };
      outcomes[side].returns = out.returns;
      resolveReturns(game, outcomes);
    }
    if (out.draw > 0) {
      const count = draw(p, out.draw, game.settings, random);
      if (count) pushLog(game, (side === "player" ? "Ты добираешь" : "Соперник добирает") + " " + count + " карту.");
    }
  };

  // Priority is determined once, before reveal begins. Ties are decided randomly.
  const first: Side = game.player.stability === game.enemy.stability
    ? (random() < 0.5 ? "player" : "enemy")
    : (game.player.stability < game.enemy.stability ? "player" : "enemy");
  const order: Side[] = [first, other(first)];
  pushLog(game, (first === "player" ? "Ты" : "Соперник") + " раскрывает карты первым.");
  // Reveal slot 1, then 2, 3, 4. Within each slot, the priority side resolves first.
  for (let slot = 0; slot < game.settings.slots; slot++) {
    for (const side of order) {
      const card = newlyPlayed[side].find(item => game[side].board[slot]?.uid === item.uid);
      if (!card || game[side].board[slot]?.uid !== card.uid) continue;
      pushLog(game, "Слот " + (slot + 1) + ": раскрыта карта «" + card.name + "».");
      applyEffect(side, card, "play");
    }
  }

  // Persistent/end-of-turn effects also resolve by slot, in the same priority order.
  for (let slot = 0; slot < game.settings.slots; slot++) {
    for (const side of order) {
      const card = game[side].board[slot];
      if (card) applyEffect(side, card, "end");
    }
  }

  // End-of-turn board rule: occupied slots drain the opponent; empty slots restore their owner.
  const occupied: Record<Side, number> = {
    player: fieldCount(game.player),
    enemy: fieldCount(game.enemy),
  };
  const endDelta: Record<Side, number> = {
    player: (game.settings.slots - occupied.player) - occupied.enemy,
    enemy: (game.settings.slots - occupied.enemy) - occupied.player,
  };
  // Each empty own slot restores 1; each occupied enemy slot drains 1.
  game.player.stability = clamp(game.player.stability + endDelta.player, game.settings.maxStability);
  game.enemy.stability = clamp(game.enemy.stability + endDelta.enemy, game.settings.maxStability);
  if (occupied.player) pushLog(game, "Твои занятые слоты: соперник теряет " + occupied.player + " Стабильности.");
  if (occupied.enemy) pushLog(game, "Слоты соперника: ты теряешь " + occupied.enemy + " Стабильности.");
  for (const side of sides) {
    const p = game[side];
    const count = draw(p, game.settings.handLimit - p.hand.length, game.settings, random);
    if (count > 0) pushLog(game, (side === "player" ? "Ты добираешь до руки" : "Соперник добирает до руки") + ": +" + count + ".");
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
  beginNextRound(game);
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
    // queueCard is the single authority for payment rules, including partial payment
    // and free selection at 1 Stability. The AI may use the same legal options as a player.
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
