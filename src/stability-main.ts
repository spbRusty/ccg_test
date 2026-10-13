import { createGame, selectCard, removeOwn, commit, aiCommit, resolveRound, type Game, type Settings, type Card } from "./game/stability";
import "./../style.css";

const root = document.querySelector<HTMLDivElement>("#ui")!;
const menu = document.querySelector<HTMLElement>("#main-menu")!;
const base = ((import.meta as any).env.BASE_URL || "/") as string;
let settings: Settings = { startStability: 15, maxPlays: 0, handLimit: 6, deckSize: 30 };
let game: Game;
let busy = false;
let notice = "Выбери карты и закрой выбор.";
let selectedCard: string | null = null;

const esc = (value: string) => value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]!));
const artFor = (card: Card) => base + "cards/card-art-" + String(((Number(card.uid) || 1) - 1) % 3 + 1).padStart(2, "0") + ".avif";
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function art(card: Card, className = "card-art"): string {
  return '<img class="' + className + '" src="' + esc(artFor(card)) + '" data-art="' + esc(artFor(card)) + '" alt="" loading="eager" decoding="async">';
}
function handCard(card: Card): string {
  const chosen = selectedCard === card.uid ? " chosen" : "";
  return '<button type="button" class="hand-card' + chosen + '" data-id="' + esc(card.uid) + '" aria-label="' + esc(card.name) + '">' +
    '<span class="hand-art-wrap">' + art(card) + '<b class="cost">' + card.cost + '</b></span>' +
    '<span class="hand-copy"><strong>' + esc(card.name) + '</strong><span>' + esc(card.text) + '</span></span></button>';
}
function boardSlot(card: Card | null, own: boolean): string {
  if (!card) return '<div class="slot empty"><span class="slot-plus">＋</span><small>СВОБОДНО</small></div>';
  return '<button type="button" class="slot filled ' + (own ? "own" : "enemy") + '" data-card-id="' + esc(card.uid) + '" data-side="' + (own ? "player" : "enemy") + '" ' +
    (own ? 'data-r="' + esc(card.uid) + '"' : "disabled") + '>' +
    art(card, "slot-art") + '<span class="slot-copy"><strong>' + esc(card.name) + '</strong><small>' + esc(card.text) + '</small></span>' +
    '<b class="slot-cost">' + card.cost + '</b></button>';
}
function statusPanel(label: string, value: number, own: boolean, tail: string): string {
  const width = Math.max(0, Math.min(100, value / 60 * 100));
  return '<section class="status-panel ' + (own ? "own-status" : "enemy-status") + '">' +
    '<div class="status-top"><span class="status-dot"></span><span class="status-label">' + label + '</span><strong>' + value + '</strong><small>СТАБИЛЬНОСТЬ</small></div>' +
    '<div class="stability-track"><span style="width:' + width + '%"></span></div><div class="status-tail">' + tail + '</div></section>';
}

function triggerResolutionEffects(beforePlayer: number, beforeEnemy: number, played: Array<{ side: "player" | "enemy"; card: Card }>): void {
  const arena = root.querySelector<HTMLElement>(".center-column");
  if (!arena) return;
  const overlay = document.createElement("div");
  overlay.className = "resolution-effects";
  overlay.setAttribute("aria-hidden", "true");
  arena.appendChild(overlay);

  const deltaPlayer = game.player.stability - beforePlayer;
  const deltaEnemy = game.enemy.stability - beforeEnemy;
  const showNumber = (side: "player" | "enemy", delta: number) => {
    if (!delta) return;
    const status = root.querySelector<HTMLElement>(side === "player" ? ".own-status" : ".enemy-status");
    if (!status) return;
    const number = document.createElement("span");
    number.className = "floating-number " + (delta < 0 ? "damage-number" : "heal-number");
    number.textContent = (delta > 0 ? "+" : "−") + Math.abs(delta);
    status.appendChild(number);
    window.setTimeout(() => number.remove(), 1500);
  };
  showNumber("player", deltaPlayer);
  showNumber("enemy", deltaEnemy);

  if (deltaPlayer < 0 || deltaEnemy < 0) overlay.classList.add("impact");
  if (deltaPlayer > 0 || deltaEnemy > 0) overlay.classList.add("restore");

  played.forEach(({ side, card }, index) => {
    const slot = root.querySelector<HTMLElement>('.slot[data-card-id="' + CSS.escape(card.uid) + '"]');
    if (slot) {
      const kind = card.effect?.kind || "default";
      slot.classList.add("card-reveal", "effect-" + String(kind).replace(/[^a-z-]/gi, ""));
      window.setTimeout(() => slot.classList.remove("card-reveal"), 1100);
      const rect = slot.getBoundingClientRect();
      const arenaRect = arena.getBoundingClientRect();
      const burst = document.createElement("span");
      burst.className = "effect-burst " + (side === "player" ? "burst-player" : "burst-enemy");
      burst.style.left = (rect.left - arenaRect.left + rect.width / 2) + "px";
      burst.style.top = (rect.top - arenaRect.top + rect.height / 2) + "px";
      overlay.appendChild(burst);
      for (let i = 0; i < 9; i++) {
        const particle = document.createElement("i");
        particle.className = "effect-particle " + (side === "player" ? "particle-player" : "particle-enemy");
        const angle = (Math.PI * 2 * i / 9) + index * .4;
        const distance = 24 + (i % 3) * 13;
        particle.style.setProperty("--dx", (Math.cos(angle) * distance) + "px");
        particle.style.setProperty("--dy", (Math.sin(angle) * distance) + "px");
        burst.appendChild(particle);
      }
    }
  });
  window.setTimeout(() => overlay.remove(), 1300);
}

function paint(): void {
  if (!game) return;
  const p = game.player, q = game.enemy;
  const logItems = [...game.log].reverse().slice(-8);
  if (notice) logItems.push(notice);
  root.innerHTML =
    '<header class="topbar"><div class="brand-mark">S</div><div class="brand-copy"><strong>СТАБИЛЬНОСТЬ</strong><small>ДУЭЛЬ В ПУСТОШИ</small></div><div class="round-pill">РАУНД <b>' + game.round + '</b></div><div class="top-actions"><button id="menu-button" class="quiet-button">☰ МЕНЮ</button><button id="new-game" class="quiet-button">↻ НОВАЯ ДУЭЛЬ</button></div></header>' +
    '<div class="game-layout">' +
      '<aside class="side-panel left-panel"><div class="panel-heading"><span class="panel-kicker">СВОДКА</span><h2>Журнал боя</h2></div>' +
        '<div class="side-score"><span>РАУНД</span><strong>' + game.round + '</strong></div>' +
        '<div class="log-list">' + logItems.map((line, i) => '<p class="' + (i === logItems.length - 1 ? "log-current" : "") + '">' + esc(line) + '</p>').join("") + '</div>' +
        '<div class="side-rule"><span class="panel-kicker">ЦЕЛЬ</span><p>Обнули Стабильность чужого лагеря. Цена каждой карты списывается сразу при выборе.</p></div>' +
      '</aside>' +
      '<main class="center-column">' +
        '<div class="arena-heading"><div><span class="panel-kicker">ПРОТИВНИК</span><h2>Чужой лагерь</h2></div><span class="turn-state ' + (q.locked ? "locked" : "") + '">' + (q.locked ? "ХОД ЗАКРЫТ" : "ВЫБИРАЕТ") + '</span></div>' +
        statusPanel("ЧУЖОЙ ЛАГЕРЬ", q.stability, false, (q.locked ? "ВЫБОР ЗАКРЫТ" : "ГОТОВИТ ХОД") + ' <span>РУКА ' + q.hand.length + '/6</span>') +
        '<section class="board enemy-board" aria-label="Поле противника">' + q.board.map(c => boardSlot(c, false)).join("") + '</section>' +
        '<div class="rift-divider"><span></span><b>РАЗЛОМ</b><span></span><i>✦</i></div>' +
        '<section class="board player-board" aria-label="Твоё игровое поле">' + p.board.map(c => boardSlot(c, true)).join("") + '</section>' +
        statusPanel("ТВОЙ ЛАГЕРЬ", p.stability, true, (p.locked ? "ХОД ЗАКРЫТ" : "ТВОЙ ХОД") + ' <span>РУКА ' + p.hand.length + '/6</span>') +
        '<section class="hand-section"><div class="hand-heading"><div><span class="panel-kicker">ТВОЙ РЕСУРС</span><h2>Карты в руке</h2></div><span class="hand-count">' + p.hand.length + ' / 6</span></div>' +
          '<div class="hand-grid">' + p.hand.map(handCard).join("") + '</div>' +
          '<div class="committed-row">' + (p.committed.length ? '<span>ЗАКРЫТЫЙ ВЫБОР</span>' + p.committed.map(c => '<button class="committed-chip" data-id="' + esc(c.uid) + '">◈ ' + esc(c.name) + ' · ' + c.cost + 'с <b>×</b></button>').join("") : '<span class="committed-empty">Карты ещё не выбраны</span>') + '</div>' +
        '</section>' +
        '<footer class="game-actions"><p class="notice" role="status">' + esc(notice) + '</p><button id="valve" class="quiet-button" ' + (p.locked || p.stability < 3 || p.hand.length >= 6 || game.winner ? "disabled" : "") + '>КЛАПАН <b>−2</b></button><button id="lock" class="primary-button" ' + (p.locked || game.winner || busy ? "disabled" : "") + '>ЗАКРЫТЬ ВЫБОР <span>→</span></button></footer>' +
      '</main>' +
      '<aside class="side-panel right-panel"><div class="panel-heading"><span class="panel-kicker">АРСЕНАЛ</span><h2>Карточные архивы</h2></div>' +
        '<div class="archive-art archive-one"><img src="' + base + 'cards/card-art-01.avif" alt="" loading="eager"><span>01 / РАЗВЕДКА</span></div>' +
        '<div class="archive-art archive-two"><img src="' + base + 'cards/card-art-02.avif" alt="" loading="eager"><span>02 / ТЕХНОЛОГИИ</span></div>' +
        '<div class="archive-art archive-three"><img src="' + base + 'cards/card-art-03.avif" alt="" loading="eager"><span>03 / ВЫЖИВАНИЕ</span></div>' +
        '<div class="side-rule"><span class="panel-kicker">ТАКТИКА</span><p>Сильные карты стоят дороже. Оставляй запас Стабильности, чтобы не проиграть из-за собственной оплаты.</p></div>' +
      '</aside>' +
    '</div>' +
    (game.winner ? '<div class="result-overlay"><div class="result-card"><span class="panel-kicker">ДУЭЛЬ ЗАВЕРШЕНА</span><h2>' + (game.winner === "draw" ? "НИЧЬЯ" : game.winner === "player" ? "ЛАГЕРЬ УСТОЯЛ" : "ЛАГЕРЬ ПАЛ") + '</h2><p>' + (game.winner === "player" ? "Твой лагерь сохранил стабильность." : game.winner === "draw" ? "Оба лагеря потеряли устойчивость." : "Стабильность твоего лагеря обнулилась.") + '</p><button id="restart" class="primary-button">НОВАЯ ДУЭЛЬ →</button></div></div>' : "");
  root.querySelectorAll<HTMLImageElement>("img[data-art]").forEach(image => {
    image.addEventListener("error", () => {
      const source = image.dataset.art || "";
      if (!image.dataset.fallback && source.endsWith(".avif")) {
        image.dataset.fallback = "1";
        image.src = source.replace(/\.avif$/i, ".jpg");
      } else {
        image.classList.add("art-missing");
      }
    }, { once: true });
  });
  root.querySelectorAll<HTMLButtonElement>(".hand-card[data-id], .committed-chip[data-id]").forEach(button => {
    button.addEventListener("click", () => {
      if (busy || p.locked || game.winner) return;
      const result = selectCard(game, "player", button.dataset.id!);
      notice = result.message;
      selectedCard = null;
      paint();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-r]").forEach(button => button.addEventListener("click", () => {
    if (busy || p.locked || game.winner) return;
    removeOwn(game, "player", button.dataset.r!);
    notice = "Карта отправлена в сброс.";
    paint();
  }));
  root.querySelector<HTMLButtonElement>("#menu-button")!.onclick = () => menu.classList.remove("hidden");
  root.querySelector<HTMLButtonElement>("#new-game")!.onclick = start;
  root.querySelector<HTMLButtonElement>("#restart")?.addEventListener("click", start);
  root.querySelector<HTMLButtonElement>("#lock")!.onclick = () => {
    commit(game, "player");
    aiCommit(game);
    busy = true;
    notice = "Выбор закрыт. Карты вскрываются…";
    paint();
    const beforePlayer = game.player.stability;
    const beforeEnemy = game.enemy.stability;
    const played = [
      ...game.player.committed.map(card => ({ side: "player" as const, card })),
      ...game.enemy.committed.map(card => ({ side: "enemy" as const, card }))
    ];
    window.setTimeout(() => {
      resolveRound(game);
      busy = false;
      notice = game.winner ? "Дуэль завершена." : "Раунд завершён. Выбери следующий ход.";
      selectedCard = null;
      paint();
      triggerResolutionEffects(beforePlayer, beforeEnemy, played);
    }, 420);
  };
  root.querySelector<HTMLButtonElement>("#valve")!.onclick = () => {
    if (p.locked || p.stability < 3 || p.hand.length >= settings.handLimit || game.winner) return;
    p.stability -= 2;
    let card = p.deck.pop();
    if (!card && p.discard.length) { p.deck = shuffle(p.discard.splice(0)); card = p.deck.pop(); }
    if (card) { p.hand.push(card); notice = "Клапан: карта взята за 2 Стабильности."; }
    else { p.stability += 2; notice = "Колода и сброс пусты: оплата возвращена."; }
    paint();
  };
}
function start(): void {
  const stability = (document.querySelector<HTMLSelectElement>("#start-stability")?.value || "15") === "20" ? 20 : 15;
  const maxPlays = document.querySelector<HTMLInputElement>("#max-two")?.checked ? 2 : 0;
  settings = { startStability: stability as 15 | 20, maxPlays: maxPlays as 0 | 2, handLimit: 6, deckSize: 30 };
  game = createGame(settings);
  busy = false;
  selectedCard = null;
  notice = "Выбери карты и закрой выбор.";
  menu.classList.add("hidden");
  paint();
}
document.querySelector<HTMLButtonElement>("#start-game")!.addEventListener("click", start);
document.querySelector<HTMLButtonElement>("#rules-toggle")!.addEventListener("click", () => {
  const rules = document.querySelector<HTMLElement>("#menu-rules")!;
  rules.hidden = !rules.hidden;
});
start();
menu.classList.remove("hidden");
