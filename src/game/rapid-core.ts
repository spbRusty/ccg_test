import { CARDS, CARD_BY_ID, DEFAULT_DECK, type CardDef, type CardAction, type CardTarget, type Side } from "./cards";

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
  /** Slots locked by an effect, keyed by slot index and cleared at round end. */
  lockedSlots: Set<number>;
  /** Slots that become locked at the start of the next round. */
  nextLockedSlots: Set<number>;
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
export type RoundEvent =
  | { type: "initiative"; side: Side }
  | { type: "reveal"; side: Side; slot: number; card: CardInstance; paid: number }
  | { type: "action"; side: Side; slot: number; card: CardInstance; action: CardAction; targetSlots: number[]; affectedSide: Side; affectedSlots: number[] }
  | { type: "table_volley"; occupied: Record<Side, number>; empty: Record<Side, number>; occupiedSlots: Record<Side, number[]>; emptySlots: Record<Side, number[]>; delta: Record<Side, number> }
  | { type: "fatigue"; side: Side; amount: number }
  | { type: "draw"; side: Side; amount: number }
  | { type: "winner"; winner: Winner };
export interface GameState {
  round: number;
  player: PlayerState;
  enemy: PlayerState;
  settings: GameSettings;
  winner: Winner;
  log: string[];
  playedByEnemy: CardInstance[];
  lastRoundEvents: RoundEvent[];
}
const DEFAULT_SETTINGS: GameSettings = {
  startStability: 30, maxStability: 30, deckSize: 14, startHand: 4,
  handLimit: 4, slots: 4, maxPlays: 2, roundLimit: 20,
};
let nextUid = 1;
const sides: Side[] = ["player", "enemy"];
const other = (side: Side): Side => side === "player" ? "enemy" : "player";
const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, n));
const cloneCard = (def: CardDef): CardInstance => ({ ...def, uid: "c" + nextUid++, playedRound: 0 });
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
  if (game.log.length > 20) game.log.length = 20;
}
function drawToFour(game: GameState, side: Side): void {
  const p = game[side];
  while (p.hand.length < game.settings.handLimit) {
    const card = p.deck.pop();
    if (!card) {
      p.stability = clamp(p.stability - 2, game.settings.maxStability);
      game.lastRoundEvents.push({ type: "fatigue", side, amount: 2 });
      pushLog(game, (side === "player" ? "Ты теряешь" : "Соперник теряет") + " 2 Стойкости из-за усталости.");
      if (p.stability === 0) break;
      continue;
    }
    p.hand.push(card);
    game.lastRoundEvents.push({ type: "draw", side, amount: 1 });
  }
}
function makePlayer(defs: CardDef[], settings: GameSettings, random: () => number): PlayerState {
  const deck = shuffle(defs.map(cloneCard), random);
  const p: PlayerState = {
    stability: settings.startStability, hand: [], deck, discard: [],
    board: Array<CardInstance | null>(settings.slots).fill(null), committed: [], locked: false, lockedSlots: new Set<number>(), nextLockedSlots: new Set<number>(),
  };
  for (let i = 0; i < settings.startHand && p.deck.length; i++) p.hand.push(p.deck.pop()!);
  return p;
}
function sanitizeDeck(ids: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const card = CARD_BY_ID.get(id);
    if (!card || card.token || seen.has(id) || result.length >= 14) continue;
    seen.add(id);
    result.push(id);
  }
  return result.length === 14 ? result : [...DEFAULT_DECK];
}
export function createGame(deckIds: string[] = DEFAULT_DECK, random: () => number = Math.random): GameState {
  nextUid = 1;
  const settings = { ...DEFAULT_SETTINGS };
  const playerIds = sanitizeDeck(deckIds);
  const playerDefs = playerIds.map(id => CARD_BY_ID.get(id)!).filter(Boolean);
  const enemyDefs = shuffle(CARDS.filter(card => !card.token), random).slice(0, settings.deckSize);
  return {
    round: 1, player: makePlayer(playerDefs, settings, random), enemy: makePlayer(enemyDefs, settings, random),
    settings, winner: null, log: ["Раунд 1. Выбери до двух карт и места на поле."], playedByEnemy: [], lastRoundEvents: [],
  };
}
export function queueCard(game: GameState, side: Side, cardUid: string, targetSlot: number): { ok: boolean; message: string } {
  const p = game[side];
  if (game.winner || p.locked) return { ok: false, message: "Выбор уже закрыт." };
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= game.settings.slots) return { ok: false, message: "Такого места на поле нет." };
  if (p.committed.length >= game.settings.maxPlays) return { ok: false, message: "Можно выбрать не больше двух карт." };
  if (p.committed.some(plan => plan.targetSlot === targetSlot)) return { ok: false, message: "Этот слот уже выбран." };
  if (p.lockedSlots.has(targetSlot)) return { ok: false, message: "Этот слот заблокирован." };
  const index = p.hand.findIndex(card => card.uid === cardUid);
  if (index < 0) return { ok: false, message: "Карты больше нет в руке." };
  const card = p.hand[index];
  p.hand.splice(index, 1);
  p.committed.push({ card, targetSlot, paid: 0 });
  return { ok: true, message: "Карта выбрана закрытой." };
}
export function unqueueCard(game: GameState, side: Side, cardUid: string): boolean {
  const p = game[side];
  if (p.locked || game.winner) return false;
  const index = p.committed.findIndex(plan => plan.card.uid === cardUid);
  if (index < 0) return false;
  const [plan] = p.committed.splice(index, 1);
  p.hand.push(plan.card);
  return true;
}
export function lockPlayerAndResolve(game: GameState, random: () => number = Math.random): void {
  if (game.winner || game.player.locked) return;
  aiCommit(game, random);
  game.player.locked = true;
  resolveRound(game, random);
}
function targetSlots(slot: number, target: CardTarget, max: number): number[] {
  switch (target) {
    case "opposite": return [slot];
    case "left": return slot > 0 ? [slot - 1] : [];
    case "right": return slot < max - 1 ? [slot + 1] : [];
    case "adjacent": return [slot - 1, slot + 1].filter(i => i >= 0 && i < max);
    case "edge": return [0, max - 1];
    case "all": return Array.from({ length: max }, (_, i) => i);
  }
}
function resolveAction(game: GameState, side: Side, card: CardInstance, slot: number, random: () => number): void {
  const source = game[side];
  const foeSide = other(side);
  const foe = game[foeSide];
  const affectedSide: Side = card.action === "spawn_token" ? side : foeSide;
  const slots = targetSlots(slot, card.target, game.settings.slots);
  const affectedSlots: number[] = [];
  // Keep the event stream in execution order. The arrays are populated below
  // and retained by reference so the event has the completed affected-slot list.
  game.lastRoundEvents.push({ type: "action", side, slot, card, action: card.action, targetSlots: slots, affectedSide, affectedSlots });
  if (card.action === "remove") {
    for (const targetSlot of slots) {
      const hiddenIndex = foe.committed.findIndex(plan => plan.targetSlot === targetSlot);
      if (hiddenIndex >= 0) {
        const [hidden] = foe.committed.splice(hiddenIndex, 1);
        foe.discard.push(hidden.card);
        affectedSlots.push(targetSlot);
        game.log.unshift("Закрытая карта «" + hidden.card.name + "» уничтожена до вскрытия.");
        continue;
      }
      const victim = foe.board[targetSlot];
      if (!victim) continue;
      foe.board[targetSlot] = null;
      foe.discard.push(victim);
      affectedSlots.push(targetSlot);
      game.log.unshift((side === "player" ? "Ты убрал" : "Соперник убрал") + " «" + victim.name + "».");
      if (victim.trigger === "on_destroy") resolveAction(game, foeSide, victim, targetSlot, random);
    }
  } else if (card.action === "bounce") {
    for (const targetSlot of slots) {
      const victim = foe.board[targetSlot];
      if (!victim) continue;
      const owner = foe;
      owner.board[targetSlot] = null;
      if (owner.hand.length < game.settings.handLimit) owner.hand.push(victim);
      else owner.discard.push(victim);
      affectedSlots.push(targetSlot);
    }
  } else if (card.action === "shift") {
    const targetBoard = foe.board;
    const candidates = card.target === "left" ? [slot - 1] : card.target === "right" ? [slot + 1] : slots;
    const from = candidates.find(i => i >= 0 && i < game.settings.slots && targetBoard[i]);
    if (from !== undefined) {
      const directions = card.target === "left" ? [-1] : card.target === "right" ? [1] : [-1, 1];
      const to = directions.map(d => from + d).find(i => i >= 0 && i < game.settings.slots && !targetBoard[i] && !foe.lockedSlots.has(i));
      if (to !== undefined) {
        const moved = targetBoard[from]!;
        targetBoard[to] = moved;
        targetBoard[from] = null;
        affectedSlots.push(from, to);
      }
    }
  } else if (card.action === "lock") {
    const lockOwner = foe;
    for (const targetSlot of slots) {
      if (card.trigger === "on_round_end") lockOwner.nextLockedSlots.add(targetSlot);
      else lockOwner.lockedSlots.add(targetSlot);
      affectedSlots.push(targetSlot);
    }
  } else if (card.action === "spawn_token") {
    const targetBoard = source.board;
    const token = CARD_BY_ID.get("token");
    if (token) {
      const candidates = card.target === "left"
        ? [slot - 1]
        : card.target === "right"
          ? [slot + 1]
          : card.target === "adjacent"
            ? [slot - 1, slot + 1]
            : card.target === "edge"
              ? slot === 0 ? [1] : slot === game.settings.slots - 1 ? [game.settings.slots - 2] : []
              : slots;
      const free = candidates.find(i => i >= 0 && i < game.settings.slots && !targetBoard[i] && !source.lockedSlots.has(i));
      if (free !== undefined) {
        targetBoard[free] = { ...token, uid: "token-" + nextUid++, playedRound: game.round };
        affectedSlots.push(free);
      }
    }
  }
}
export function resolveRound(game: GameState, random: () => number = Math.random): void {
  if (game.winner || !game.player.locked || !game.enemy.locked) return;
  game.lastRoundEvents = [];
  const first: Side = game.player.stability === game.enemy.stability ? (random() < 0.5 ? "player" : "enemy") : game.player.stability < game.enemy.stability ? "player" : "enemy";
  const order: Side[] = [first, other(first)];
  game.lastRoundEvents.push({ type: "initiative", side: first });
  pushLog(game, (first === "player" ? "Ты" : "Соперник") + " ходит первым.");
  // Place all planned cards face down first. Existing cards are replaced only when reveal reaches the slot.
  for (const side of sides) {
    for (const plan of game[side].committed) {
      plan.paid = 0;
      plan.card.playedRound = game.round;
    }
  }
  const revealed = new Set<string>();
  for (let slot = 0; slot < game.settings.slots; slot++) {
    for (const side of order) {
      const p = game[side];
      const plan = p.committed.find(item => item.targetSlot === slot);
      if (!plan || revealed.has(plan.card.uid)) continue;
      // If an earlier action removed this face-down card from hand/board, it never pays or triggers.
      const planIndex = p.committed.findIndex(item => item.card.uid === plan.card.uid);
      if (planIndex < 0 || !p.hand.every(card => card.uid !== plan.card.uid)) continue;
      if (p.lockedSlots.has(slot)) {
        p.committed.splice(planIndex, 1);
        p.discard.push(plan.card);
        pushLog(game, "Слот " + (slot + 1) + " заблокирован: «" + plan.card.name + "» не раскрывается.");
        continue;
      }
      const cost = plan.card.cost;
      if (cost < 0 && p.stability + cost <= 0) {
        p.committed.splice(planIndex, 1);
        p.discard.push(plan.card);
        pushLog(game, "Недостаточно Стойкости: «" + plan.card.name + "» сгорает.");
        continue;
      }
      const old = p.board[slot];
      if (old) p.discard.push(old);
      p.board[slot] = null;
      p.stability = clamp(p.stability + cost, game.settings.maxStability);
      plan.paid = cost;
      p.board[slot] = plan.card;
      revealed.add(plan.card.uid);
      game.lastRoundEvents.push({ type: "reveal", side, slot, card: plan.card, paid: cost });
      pushLog(game, "Слот " + (slot + 1) + ": раскрыта «" + plan.card.name + "».");
      if (plan.card.trigger === "on_reveal") resolveAction(game, side, plan.card, slot, random);
      // If a just-resolved action removed the revealed card, it no longer occupies its slot.
      if (game.winner) break;
    }
  }
  // Trigger cards already on the board at end of round, ordered by slot and initiative.
  for (let slot = 0; slot < game.settings.slots; slot++) {
    for (const side of order) {
      const card = game[side].board[slot];
      if (card?.trigger === "on_round_end" && !game[side].lockedSlots.has(slot)) resolveAction(game, side, card, slot, random);
    }
  }
  const occupiedSlots: Record<Side, number[]> = {
    player: game.player.board.flatMap((card, slot) => card && !game.player.lockedSlots.has(slot) ? [slot] : []),
    enemy: game.enemy.board.flatMap((card, slot) => card && !game.enemy.lockedSlots.has(slot) ? [slot] : []),
  };
  const emptySlots: Record<Side, number[]> = {
    player: Array.from({ length: game.settings.slots }, (_, slot) => slot).filter(slot => !game.player.board[slot] && !game.player.lockedSlots.has(slot)),
    enemy: Array.from({ length: game.settings.slots }, (_, slot) => slot).filter(slot => !game.enemy.board[slot] && !game.enemy.lockedSlots.has(slot)),
  };
  const occupied: Record<Side, number> = { player: occupiedSlots.player.length, enemy: occupiedSlots.enemy.length };
  const empty: Record<Side, number> = { player: emptySlots.player.length, enemy: emptySlots.enemy.length };
  // Apply each field rule as its own operation: healing is capped at 30 before
  // the opponent's occupied slots reduce Stability. Combining them into one
  // net delta incorrectly preserves healing that should be lost at the cap.
  const beforeVolley = { player: game.player.stability, enemy: game.enemy.stability };
  game.player.stability = clamp(game.player.stability + empty.player, game.settings.maxStability);
  game.enemy.stability = clamp(game.enemy.stability + empty.enemy, game.settings.maxStability);
  game.player.stability = clamp(game.player.stability - occupied.enemy, game.settings.maxStability);
  game.enemy.stability = clamp(game.enemy.stability - occupied.player, game.settings.maxStability);
  const delta: Record<Side, number> = {
    player: game.player.stability - beforeVolley.player,
    enemy: game.enemy.stability - beforeVolley.enemy,
  };
  game.lastRoundEvents.push({ type: "table_volley", occupied, empty, occupiedSlots, emptySlots, delta });
  for (const side of sides) {
    const p = game[side];
    p.lockedSlots.clear();
    for (const slot of p.nextLockedSlots) p.lockedSlots.add(slot);
    p.nextLockedSlots.clear();
  }
  for (const side of sides) {
    const p = game[side];
    for (const plan of p.committed) {
      if (!revealed.has(plan.card.uid)) p.discard.push(plan.card);
    }
    p.committed = [];
    p.locked = false;
  }
  // Current-round locks affect this volley; end-of-round locks transfer into the next round.
  checkWinner(game);
  if (!game.winner) {
    for (const side of sides) drawToFour(game, side);
    checkWinner(game);
  }
  if (game.winner) {
    game.lastRoundEvents.push({ type: "winner", winner: game.winner });
    pushLog(game, game.winner === "draw" ? "Ничья." : game.winner === "player" ? "Победа." : "Поражение.");
    return;
  }
  if (game.round >= game.settings.roundLimit) {
    game.winner = game.player.stability === game.enemy.stability ? "draw" : game.player.stability > game.enemy.stability ? "player" : "enemy";
    game.lastRoundEvents.push({ type: "winner", winner: game.winner });
    return;
  }
  game.round++;
  game.playedByEnemy = [...game.playedByEnemy, ...game.enemy.board.filter((card): card is CardInstance => card !== null)].slice(-30);
  pushLog(game, "Раунд " + game.round + ": выбери до двух карт.");
}
function checkWinner(game: GameState): void {
  const pDown = game.player.stability <= 0;
  const eDown = game.enemy.stability <= 0;
  if (pDown && eDown) game.winner = "draw";
  else if (pDown) game.winner = "enemy";
  else if (eDown) game.winner = "player";
}
export function rateCard(card: CardDef): number {
  const actionValue: Record<CardAction, number> = { remove: 5, bounce: 3.5, shift: 2.5, lock: 3, spawn_token: 2 };
  return actionValue[card.action] + card.cost * 0.8 + (card.trigger === "on_reveal" ? 0.5 : 0);
}
export function aiCommit(game: GameState, random: () => number = Math.random): void {
  const p = game.enemy;
  if (p.locked || game.winner) return;
  const candidates = [...p.hand].sort((a, b) => rateCard(b) - rateCard(a));
  for (const card of candidates) {
    if (p.committed.length >= game.settings.maxPlays) break;
    const used = new Set(p.committed.map(plan => plan.targetSlot));
    const free = p.board.findIndex((old, slot) => !used.has(slot) && !p.lockedSlots.has(slot));
    let slot = free >= 0 ? free : p.board.findIndex((old, index) => !used.has(index) && !p.lockedSlots.has(index));
    if (slot < 0) break;
    if (random() < 0.12 && p.committed.length > 0) continue;
    queueCard(game, "enemy", card.uid, slot);
  }
  p.locked = true;
}
