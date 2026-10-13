import * as ex from "excalibur";
import { CARD_TYPES } from "./cards/card-data";
import type { CardDefinition } from "./cards/types";
import "./../style.css";

type Side = "player" | "enemy";
type UnitCard = {
  id: number;
  source: CardDefinition;
  name: string;
  cost: number;
  attack: number;
  maxHealth: number;
  health: number;
  color: string;
  effect: string;
  effectAmount: number;
};
type Fighter = { hp: number; maxMana: number; mana: number; deck: UnitCard[]; hand: UnitCard[]; board: Array<UnitCard | null>; discard: UnitCard[] };

const W = 600;
const H = 900;
const LANE_X = [120, 300, 480];
const CARD_W = 142;
const CARD_H = 154;
const CARD_POOL = Object.values(CARD_TYPES);
const PALETTE = ["#57d7c9", "#70a7ff", "#c18cff", "#f1b65e", "#f27691", "#9bc86e"];
const FONT = "Arial, sans-serif";

let nextId = 1;
let player: Fighter;
let enemy: Fighter;
let active: Side = "player";
let selectedId: number | null = null;
let gameOver = false;
let round = 0;
let statusText = "Выбери карту, затем нажми на свободную линию.";
let actors: ex.Actor[] = [];
let engine: ex.Engine;

function makeCard(source: CardDefinition): UnitCard {
  const id = nextId++;
  const cost = 1 + ((id * 7 + source.cost) % 5);
  const attack = 1 + ((id * 3 + source.variant) % Math.max(2, cost + 2));
  const maxHealth = Math.max(2, cost * 2 + 2 - attack + ((id + source.variant) % 3));
  const effects: Record<string, string> = {
    gain: "Восстановление", steal: "Урон герою", swap: "Перезарядка", discount: "Импульс",
    slow: "Ослабление", copy: "Эхо", cancel: "Разрушение", delayed: "Отложенный урон",
    conditional: "Усиление", percent: "Разряд", fieldGain: "Синергия", fieldDrain: "Охота",
    fieldTax: "Подавление", mill: "Истощение", hijack: "Перехват", accumulate: "Заряд",
    discharge: "Разряд", transferCharge: "Передача", massDestroy: "Зачистка", return: "Возврат",
    move: "Манёвр", evolve: "Эволюция", combo: "Комбо", shield: "Щит", overheat: "Перегрев",
    massPlay: "Подкрепление", trap: "Ловушка", ruleChange: "Аномалия", random: "Хаос",
    duplicate: "Копирование", sacrifice: "Жертва"
  };
  return {
    id, source, name: source.name, cost, attack, maxHealth, health: maxHealth,
    color: source.color || PALETTE[id % PALETTE.length],
    effect: effects[source.type] || "Аномалия",
    effectAmount: 1 + ((id + source.amount) % 3)
  };
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function newFighter(): Fighter {
  const deck = shuffle(CARD_POOL).slice(0, 30).map(makeCard);
  return { hp: 25, maxMana: 0, mana: 0, deck, hand: [], board: [null, null, null], discard: [] };
}

function draw(f: Fighter, count = 1): void {
  for (let i = 0; i < count && f.hand.length < 7 && f.deck.length; i++) f.hand.push(f.deck.pop()!);
}

function resetGame(): void {
  nextId = 1;
  player = newFighter();
  enemy = newFighter();
  draw(player, 4);
  draw(enemy, 4);
  active = "player";
  selectedId = null;
  gameOver = false;
  round = 1;
  player.maxMana = enemy.maxMana = 1;
  player.mana = enemy.mana = 1;
  statusText = "Твой ход. Сыграй карту и выбери линию.";
  render();
}

function addActor(actor: ex.Actor): ex.Actor {
  actors.push(actor);
  engine.add(actor);
  return actor;
}

function textActor(text: string, x: number, y: number, size: number, color = "#edf4ff", bold = false, width?: number): ex.Actor {
  const actor = new ex.Actor({ pos: ex.vec(x, y), anchor: ex.vec(0.5, 0.5) });
  actor.graphics.use(new ex.Text({
    text,
    font: new ex.Font({ family: FONT, size, bold, color, textAlign: ex.TextAlign.Center, baseAlign: ex.BaseAlign.Middle })
  }));
  addActor(actor);
  return actor;
}

function rect(x: number, y: number, w: number, h: number, color: string, radius = 12, stroke = "#334257", lineWidth = 1): ex.Actor {
  const actor = new ex.Actor({ pos: ex.vec(x, y), width: w, height: h, anchor: ex.vec(0.5, 0.5) });
  actor.graphics.use(new ex.Rectangle({ width: w, height: h, color: ex.Color.fromHex(color), strokeColor: ex.Color.fromHex(stroke), lineWidth, radius }));
  addActor(actor);
  return actor;
}

function clickableRect(x: number, y: number, w: number, h: number, color: string, onClick: () => void, stroke = "#536780"): ex.Actor {
  const actor = rect(x, y, w, h, color, 12, stroke, 2);
  actor.pointer.useGraphicsBounds = true;
  actor.on("pointerdown", (event) => {
    event.cancel();
    onClick();
  });
  return actor;
}

function cardFace(card: UnitCard, x: number, y: number, width: number, height: number, small = false): void {
  const chosen = selectedId === card.id;
  rect(x, y, width, height, chosen ? "#253e55" : "#121d2b", 10, chosen ? "#f3c96b" : card.color, chosen ? 3 : 2);
  rect(x, y - height * .28, width - 12, height * .36, card.color, 7, card.color, 1);
  textActor(card.name.length > 17 ? card.name.slice(0, 16) + "…" : card.name, x, y - height * .37, small ? 10 : 12, "#08111d", true);
  textActor(card.effect, x, y - height * .10, small ? 9 : 11, "#d8e4f4", true);
  textActor(String(card.cost), x - width * .36, y - height * .42, small ? 12 : 15, "#ffe08a", true);
  textActor(card.attack + " ATK", x - width * .22, y + height * .35, small ? 10 : 12, "#ff9b9b", true);
  textActor(card.health + "/" + card.maxHealth, x + width * .22, y + height * .35, small ? 10 : 12, "#a6f3cb", true);
}

function unitFace(card: UnitCard, x: number, y: number, side: Side): void {
  const bg = side === "player" ? "#142b36" : "#351e2a";
  rect(x, y, 130, 88, bg, 10, card.color, 2);
  rect(x, y - 18, 118, 28, card.color, 6, card.color);
  textActor(card.name.length > 15 ? card.name.slice(0, 14) + "…" : card.name, x, y - 18, 11, "#0b1420", true);
  textActor(card.attack + " ATK", x - 28, y + 22, 12, "#ffadad", true);
  textActor(card.health + " HP", x + 29, y + 22, 12, "#b0f6cf", true);
}

function render(): void {
  for (const actor of actors) actor.kill();
  actors = [];
  rect(W / 2, H / 2, W, H, "#0a101a", 0, "#0a101a", 0);
  textActor("ВРЕМЕННОЙ РАЗЛОМ", W / 2, 27, 18, "#f0ca76", true);
  textActor("РАУНД " + round, W / 2, 51, 11, "#91a6bd", true);

  // Opponent status
  rect(W / 2, 103, 550, 64, "#111c2a", 12, "#27394d");
  textActor("ПРОТИВНИК", 95, 88, 11, "#ef9aa7", true);
  textActor("♥ " + enemy.hp, 85, 116, 22, "#ff8c9d", true);
  textActor("МАНА " + enemy.mana + "/" + enemy.maxMana, 205, 115, 13, "#f3ca79", true);
  textActor("В руке: " + enemy.hand.length, 390, 115, 12, "#a9bbd0");
  textActor("Колода: " + enemy.deck.length, 500, 115, 12, "#8295ad");

  // Enemy field and lanes
  for (let i = 0; i < 3; i++) {
    rect(LANE_X[i], 245, 166, 130, "#101a27", 14, "#27384c");
    textActor("ЛИНИЯ " + (i + 1), LANE_X[i], 197, 10, "#72869e", true);
    if (enemy.board[i]) unitFace(enemy.board[i]!, LANE_X[i], 245, "enemy");
  }
  rect(W / 2, 327, 550, 22, "#192a3b", 8, "#263b51");
  textActor("ЗОНА СРАЖЕНИЯ", W / 2, 327, 10, "#91a9c2", true);

  // Player field
  for (let i = 0; i < 3; i++) {
    const slot = clickableRect(LANE_X[i], 420, 166, 130, player.board[i] ? "#10212a" : "#101a27", () => playSelected(i), player.board[i] ? "#3d7d7b" : "#35465b");
    if (player.board[i]) unitFace(player.board[i]!, LANE_X[i], 420, "player");
    else {
      textActor("＋", LANE_X[i], 405, 28, "#526982");
      textActor("Нажми для", LANE_X[i], 430, 10, "#6e839a");
      textActor("призыва", LANE_X[i], 443, 10, "#6e839a");
    }
  }

  // Player status
  rect(W / 2, 513, 550, 58, "#111c2a", 12, "#27394d");
  textActor("ТЫ", 63, 500, 11, "#8ee3d0", true);
  textActor("♥ " + player.hp, 83, 527, 22, "#8de6d1", true);
  textActor("МАНА " + player.mana + "/" + player.maxMana, 215, 527, 13, "#f3ca79", true);
  textActor("Колода: " + player.deck.length, 385, 527, 12, "#8295ad");
  textActor("Сброс: " + player.discard.length, 500, 527, 12, "#8295ad");

  // Hand and action row
  textActor("ТВОЯ РУКА", 88, 568, 12, "#a8bad0", true);
  textActor(statusText.length > 52 ? statusText.slice(0, 51) + "…" : statusText, W / 2, 589, 11, "#d5e0ed");
  const hand = player.hand;
  const count = Math.max(1, hand.length);
  const gap = Math.min(151, 552 / count);
  const start = W / 2 - gap * (count - 1) / 2;
  hand.forEach((card, i) => {
    const x = start + gap * i;
    const y = 690;
    const actor = clickableRect(x, y, Math.min(CARD_W, gap - 5), CARD_H, selectedId === card.id ? "#243d54" : "#111b29", () => {
      if (active !== "player" || gameOver) return;
      selectedId = selectedId === card.id ? null : card.id;
      statusText = selectedId === null ? "Карта не выбрана." : "Выбрана: " + card.name + ". Нажми на свободную линию.";
      render();
    }, selectedId === card.id ? "#f0c76f" : card.color);
    cardFace(card, x, y, Math.min(CARD_W, gap - 5), CARD_H, true);
  });

  const end = clickableRect(172, 824, 210, 48, active === "player" && !gameOver ? "#285b59" : "#202a37", endTurn, "#3f9187");
  textActor("ЗАВЕРШИТЬ ХОД", 172, 824, 13, "#dffcf4", true);
  clickableRect(418, 824, 210, 48, "#202a37", resetGame, "#526780");
  textActor("НОВАЯ ИГРА", 418, 824, 13, "#dbe7f4", true);

  if (gameOver) {
    rect(W / 2, H / 2, 450, 150, "#101a27", 20, "#f0c76f", 3);
    textActor(player.hp > 0 ? "ПОБЕДА" : "ПОРАЖЕНИЕ", W / 2, H / 2 - 24, 30, "#f0c76f", true);
    textActor("Нажми «Новая игра»", W / 2, H / 2 + 24, 15, "#dbe7f4");
  }
}

function activeFighter(): Fighter { return active === "player" ? player : enemy; }
function otherFighter(): Fighter { return active === "player" ? enemy : player; }

function applyBattlecry(card: UnitCard, owner: Side): void {
  const own = owner === "player" ? player : enemy;
  const foe = owner === "player" ? enemy : player;
  const n = card.effectAmount;
  switch (card.source.type) {
    case "gain": own.hp = Math.min(30, own.hp + n + 1); break;
    case "steal": case "percent": case "fieldDrain": foe.hp = Math.max(0, foe.hp - n - 1); own.hp = Math.min(30, own.hp + 1); break;
    case "shield": case "evolve": card.health = Math.min(card.maxHealth + 3, card.health + n); card.maxHealth = Math.max(card.maxHealth, card.health); break;
    case "massDestroy": case "cancel": {
      const targets = foe.board.map((unit, i) => unit ? i : -1).filter(i => i >= 0);
      if (targets.length) foe.discard.push(foe.board[targets[Math.floor(Math.random() * targets.length)]]!);
      if (targets.length) foe.board[targets[Math.floor(Math.random() * targets.length)]] = null;
      break;
    }
    case "fieldGain": case "combo": own.hp = Math.min(30, own.hp + own.board.filter(Boolean).length); break;
    case "discount": own.mana = Math.min(own.maxMana, own.mana + 1); break;
    case "slow": case "fieldTax": foe.mana = Math.max(0, foe.mana - 1); break;
    case "massPlay": draw(own, 1); break;
    case "return": {
      const i = own.board.findIndex(Boolean);
      if (i >= 0 && own.hand.length < 7) own.hand.push(own.board[i]!);
      if (i >= 0) own.board[i] = null;
      break;
    }
    default: break;
  }
}

function playSelected(lane: number): void {
  if (active !== "player" || gameOver) return;
  if (player.board[lane]) {
    statusText = "Эта линия занята. Выбери свободную.";
    render();
    return;
  }
  const index = player.hand.findIndex(c => c.id === selectedId);
  if (index < 0) {
    statusText = "Сначала выбери карту в руке.";
    render();
    return;
  }
  const card = player.hand[index];
  if (card.cost > player.mana) {
    statusText = "Не хватает маны: нужно " + card.cost + ", доступно " + player.mana + ".";
    render();
    return;
  }
  player.mana -= card.cost;
  player.hand.splice(index, 1);
  player.board[lane] = card;
  applyBattlecry(card, "player");
  selectedId = null;
  statusText = card.name + " выходит на линию " + (lane + 1) + ".";
  checkGameOver();
  render();
}

function attackPhase(attacker: Fighter, defender: Fighter): void {
  for (let i = 0; i < 3; i++) {
    const unit = attacker.board[i];
    if (!unit) continue;
    const target = defender.board[i];
    if (target) {
      target.health -= unit.attack;
      if (target.health <= 0) {
        defender.discard.push(target);
        defender.board[i] = null;
      }
    } else {
      defender.hp -= unit.attack;
    }
  }
}

function endTurn(): void {
  if (active !== "player" || gameOver) return;
  attackPhase(player, enemy);
  checkGameOver();
  if (gameOver) { render(); return; }
  active = "enemy";
  statusText = "Противник выбирает ход…";
  render();
  window.setTimeout(enemyTurn, 550);
}

function enemyTurn(): void {
  if (gameOver) return;
  enemy.maxMana = Math.min(10, enemy.maxMana + 1);
  enemy.mana = enemy.maxMana;
  draw(enemy);
  let safety = 0;
  while (safety++ < 10) {
    const lane = enemy.board.findIndex(unit => !unit);
    const playable = enemy.hand.filter(card => card.cost <= enemy.mana).sort((a, b) => (b.attack + b.health - b.cost) - (a.attack + a.health - a.cost));
    if (lane < 0 || !playable.length) break;
    const card = playable[0];
    enemy.hand.splice(enemy.hand.findIndex(c => c.id === card.id), 1);
    enemy.mana -= card.cost;
    enemy.board[lane] = card;
    applyBattlecry(card, "enemy");
  }
  attackPhase(enemy, player);
  checkGameOver();
  if (gameOver) { render(); return; }
  active = "player";
  round++;
  player.maxMana = Math.min(10, player.maxMana + 1);
  player.mana = player.maxMana;
  draw(player);
  selectedId = null;
  statusText = "Твой ход. Мана восстановлена; карты атакуют по линиям в конце хода.";
  render();
}

function checkGameOver(): void {
  if (player.hp <= 0 || enemy.hp <= 0) {
    gameOver = true;
    active = "player";
    statusText = player.hp > 0 ? "Победа." : "Поражение.";
  }
}

engine = new ex.Engine({
  canvasElementId: "game",
  width: W,
  height: H,
  displayMode: ex.DisplayMode.FitScreen,
  backgroundColor: ex.Color.fromHex("#0a101a"),
  antialiasing: true
});

engine.start().then(() => {
  document.body.classList.add("ready");
  resetGame();
});
