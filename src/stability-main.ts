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
let archiveTab: "deck" | "enemy" = "deck";
let previewCard: Card | null = null;
let dragGhost: HTMLElement | null = null;
let dragCardId: string | null = null;
let dragOrigin: HTMLElement | null = null;
let dragStartX = 0, dragStartY = 0, dragMoved = false;

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
  return '<button type="button" draggable="false" class="hand-card' + chosen + '" data-id="' + esc(card.uid) + '" aria-label="' + esc(card.name) + '">' +
    '<span class="hand-art-wrap">' + art(card) + '<b class="cost">' + card.cost + '</b></span>' +
    '<span class="hand-copy"><strong>' + esc(card.name) + '</strong><span>' + esc(card.text) + '</span></span></button>';
}
function boardSlot(card: Card | null, own: boolean, index: number, pending = false): string {
  if (!card) return '<div class="slot empty ' + (own ? 'own-empty' : '') + '" data-slot-index="' + index + '"><span class="slot-plus">＋</span><small>СВОБОДНО</small></div>';
  return '<button type="button" draggable="false" class="slot filled ' + (own ? "own" : "enemy") + (pending ? " pending-slot" : "") + '" data-card-id="' + esc(card.uid) + '" data-side="' + (own ? "player" : "enemy") + '" data-slot-index="' + index + '" ' +
    (own && !pending ? 'data-r="' + esc(card.uid) + '"' : own ? "" : "disabled") + '>' +
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

function updateInspector(card: Card): void {
  const panel = root.querySelector<HTMLElement>("#card-inspector");
  if (!panel) return;
  panel.innerHTML = art(card, "inspector-art") + '<div class="inspector-copy"><strong>' + esc(card.name) + '</strong><span>ЦЕНА ' + card.cost + ' СТАБИЛЬНОСТИ</span><p>' + esc(card.text) + '</p></div>';
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
        '<section class="board enemy-board" aria-label="Поле противника">' + q.board.map((c, i) => boardSlot(c, false, i)).join("") + '</section>' +
        '<div class="rift-divider"><span></span><b>РАЗЛОМ</b><span></span><i>✦</i></div>' +
        '<section class="board player-board" aria-label="Твоё игровое поле">' + p.board.map((c, i) => { const pending = !c ? p.committed.find(item => item.targetSlot === i) : undefined; return boardSlot(c || pending || null, true, i, !!pending); }).join("") + '</section>' +
        statusPanel("ТВОЙ ЛАГЕРЬ", p.stability, true, (p.locked ? "ХОД ЗАКРЫТ" : "ТВОЙ ХОД") + ' <span>РУКА ' + p.hand.length + '/6</span>') +
        '<section class="hand-section"><div class="hand-heading"><div><span class="panel-kicker">ТВОЙ РЕСУРС</span><h2>Карты в руке</h2></div><span class="hand-count">' + p.hand.length + ' / 6</span></div>' +
          '<div class="hand-grid">' + p.hand.map(handCard).join("") + '</div>' +
          '<div class="committed-row">' + (p.committed.length ? '<span>ЗАКРЫТЫЙ ВЫБОР</span>' + p.committed.map(c => '<button class="committed-chip" data-id="' + esc(c.uid) + '">◈ ' + esc(c.name) + ' · ' + c.cost + 'с <b>×</b></button>').join("") : '<span class="committed-empty">Карты ещё не выбраны</span>') + '</div>' +
        '</section>' +
        '<footer class="game-actions"><p class="notice" role="status">' + esc(notice) + '</p><button id="valve" class="quiet-button" ' + (p.locked || p.stability < 3 || p.hand.length >= 6 || game.winner ? "disabled" : "") + '>КЛАПАН <b>−2</b></button><button id="lock" class="primary-button" ' + (p.locked || game.winner || busy ? "disabled" : "") + '>ЗАКРЫТЬ ВЫБОР <span>→</span></button></footer>' +
      '</main>' +
      '<aside class="side-panel right-panel"><div class="panel-heading"><span class="panel-kicker">КАРТЫ</span><h2>Арсенал</h2></div>' +
        '<div class="archive-tabs"><button type="button" class="' + (archiveTab === "deck" ? "active" : "") + '" data-archive-tab="deck">МОЯ КОЛОДА</button><button type="button" class="' + (archiveTab === "enemy" ? "active" : "") + '" data-archive-tab="enemy">КАРТЫ ПРОТИВНИКА</button></div>' +
        '<div class="archive-list">' + (archiveTab === "deck" ? [...p.hand, ...p.deck, ...p.committed].filter((card, index, all) => all.findIndex(item => item.uid === card.uid) === index).map(card => '<button type="button" class="archive-card" data-preview-id="' + esc(card.uid) + '">' + art(card, "archive-thumb") + '<span><strong>' + esc(card.name) + '</strong><small>' + esc(card.text) + '</small></span><b>' + card.cost + '</b></button>').join("") : game.playedByEnemy.map(card => '<button type="button" class="archive-card" data-preview-id="' + esc(card.uid) + '">' + art(card, "archive-thumb") + '<span><strong>' + esc(card.name) + '</strong><small>' + esc(card.text) + '</small></span><b>' + card.cost + '</b></button>').join("") || '<p class="archive-empty">Противник ещё не сыграл ни одной карты.</p>') + '</div>' +
        '<div class="card-inspector" id="card-inspector">' + (previewCard ? art(previewCard, "inspector-art") + '<div class="inspector-copy"><strong>' + esc(previewCard.name) + '</strong><span>ЦЕНА ' + previewCard.cost + ' СТАБИЛЬНОСТИ</span><p>' + esc(previewCard.text) + '</p></div>' : '<div class="inspector-placeholder">Наведи курсор на карту на поле, чтобы увидеть изображение и описание.</div>') + '</div>' +
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
      if (dragMoved) { dragMoved = false; return; }
      if (busy || p.locked || game.winner) return;
      const result = selectCard(game, "player", button.dataset.id!);
      notice = result.message;
      selectedCard = null;
      paint();
    });
  });
  root.querySelectorAll<HTMLElement>(".hand-card[data-id]").forEach(cardEl => {
    cardEl.addEventListener("pointerdown", event => {
      if (event.button !== 0 || busy || p.locked || game.winner) return;
      dragCardId = cardEl.dataset.id || null; dragOrigin = cardEl;
      dragStartX = event.clientX; dragStartY = event.clientY; dragMoved = false;
    });
  });
  document.addEventListener("pointermove", event => {
    if (!dragCardId || !dragOrigin) return;
    if (!dragGhost && Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 8) {
      dragMoved = true; dragGhost = dragOrigin.cloneNode(true) as HTMLElement;
      dragGhost.classList.add("drag-ghost"); document.body.appendChild(dragGhost);
    }
    if (dragGhost) {
      dragGhost.style.left = (event.clientX + 12) + "px"; dragGhost.style.top = (event.clientY + 12) + "px";
      root.querySelectorAll(".own-empty").forEach(slot => slot.classList.remove("drop-target"));
      document.elementFromPoint(event.clientX, event.clientY)?.closest(".own-empty")?.classList.add("drop-target");
    }
  });
  const finishDrag = (event: PointerEvent) => {
    if (!dragCardId || !dragOrigin) return;
    if (Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 8) {
      dragMoved = true;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".own-empty[data-slot-index]");
      const card = p.hand.find(item => item.uid === dragCardId);
      if (target && card && !busy && !p.locked && !game.winner) {
        const slotIndex = Number(target.dataset.slotIndex);
        const result = selectCard(game, "player", dragCardId);
        if (result.ok) {
          const committed = p.committed.find(item => item.uid === dragCardId);
          if (committed) committed.targetSlot = slotIndex;
          notice = result.message; selectedCard = null;
          paint();
          const landed = root.querySelector<HTMLElement>('.slot[data-card-id="' + CSS.escape(dragCardId) + '"]');
          landed?.animate([{ transform: "scale(.78) translateY(-10px)", filter: "brightness(2)" }, { transform: "scale(1.06)", filter: "brightness(1.35)" }, { transform: "scale(1)", filter: "brightness(1)" }], { duration: 330, easing: "cubic-bezier(.15,.8,.2,1)" });
        } else {
          notice = result.message; paint();
        }
      } else {
        dragOrigin.animate([{ transform: "translate(0,0) scale(1)" }, { transform: "translate(0,-8px) scale(1.04)" }, { transform: "translate(0,0) scale(1)" }], { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
      window.setTimeout(() => { dragMoved = false; }, 100);
    }
    dragGhost?.remove(); dragGhost = null;
    root.querySelectorAll(".drop-target").forEach(slot => slot.classList.remove("drop-target"));
    dragCardId = null; dragOrigin = null;
  };
  document.addEventListener("pointerup", finishDrag);
  root.querySelectorAll<HTMLElement>(".slot[data-card-id]").forEach(slot => {
    const update = () => {
      const id = slot.dataset.cardId;
      const card = id ? [...p.board, ...q.board, ...p.committed].find(item => item?.uid === id) : null;
      if (card) { previewCard = card; updateInspector(card); }
    };
    slot.addEventListener("mouseenter", update); slot.addEventListener("focus", update);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-archive-tab]").forEach(button => button.addEventListener("click", () => {
    archiveTab = button.dataset.archiveTab === "enemy" ? "enemy" : "deck"; paint();
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-preview-id]").forEach(button => {
    const update = () => {
      const id = button.dataset.previewId!;
      previewCard = [...p.hand, ...p.deck, ...p.committed, ...p.board.filter((x): x is Card => !!x), ...q.board.filter((x): x is Card => !!x), ...game.playedByEnemy].find(card => card.uid === id) || null;
      if (previewCard) updateInspector(previewCard);
    };
    button.addEventListener("mouseenter", update); button.addEventListener("focus", update);
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
