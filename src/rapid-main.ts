import { CARDS, CARD_BY_ID, DEFAULT_DECK, type CardDef, type Side } from "./game/cards";
import { createGame, queueCard, unqueueCard, lockPlayerAndResolve, type CardInstance, type GameState } from "./game/rapid-core";
import "./rapid.css";
import { mountBattleScene, type BattleSceneHandle } from "./battle-scene";
import { gsap } from "gsap";

let battleScene: BattleSceneHandle | null = null;
let animationRound = 0;
let roundAnimationRunning = false;

const app = document.querySelector<HTMLDivElement>("#app")!;
const base = ((import.meta as any).env.BASE_URL || "/") as string;
type Language = "ru" | "en";
type Page = "home" | "battle" | "decks" | "settings";
let language: Language = (localStorage.getItem("stability-language") as Language) || "ru";
let page: Page = "home";
let game: GameState | null = null;
let chosenCardUid: string | null = null;
let deckIds = readDeck();
let collectionQuery = "";
let collectionFaction = "all";
let archiveTab: "deck" | "enemy" = "deck";
let soundVolume = Number(localStorage.getItem("stability-sound-volume") ?? "0.55");
let musicVolume = Number(localStorage.getItem("stability-music-volume") ?? "0.12");
let audio: AudioContext | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let notice = "";
let suppressNextClick = false;
let activeCardDrag: { pointerId: number; uid: string; source: HTMLElement; sourceRect: DOMRect; startX: number; startY: number; x: number; y: number; ghost: HTMLElement | null; slot: HTMLElement | null; moved: boolean } | null = null;
const I18N: Record<string, [string, string]> = {
  title: ["СТАБИЛЬНОСТЬ", "STABILITY"], subtitle: ["КАРТОЧНАЯ ДУЭЛЬ", "CARD DUEL"],
  single: ["Играть", "Play"], pvp: ["PvP · скоро", "PvP · soon"], decks: ["Коллекция и колоды", "Collection & decks"],
  settings: ["Настройки", "Settings"], back: ["Назад", "Back"], start: ["Начать дуэль", "Start duel"],
  cards: ["Карты", "Cards"], deck: ["Колода", "Deck"], collection: ["Коллекция", "Collection"],
  rules: ["30 Стабильности · 14 карт · 4 места · рука 4 · до 20 раундов", "30 Stability · 14 cards · 4 slots · hand of 4 · up to 20 rounds"],
  hand: ["ТВОЯ РУКА", "YOUR HAND"], enemy: ["СОПЕРНИК", "OPPONENT"], player: ["ТВОЙ ЛАГЕРЬ", "YOUR CAMP"],
  reveal: ["Зафиксировать ход", "Lock in turn"], pass: ["Можно пропустить ход", "You may pass this turn"],
  selected: ["Выбрана", "Selected"], selectHint: ["Выбери карту в руке, затем нажми место на поле.", "Select a card, then tap a field slot."],
  round: ["РАУНД", "ROUND"], stability: ["СТАБИЛЬНОСТЬ", "STABILITY"], left: ["ОСТАЛОСЬ", "LEFT"],
  log: ["ХРОНИКА", "MATCH LOG"], arsenal: ["АРХИВ", "ARCHIVE"], remaining: ["Колода", "Deck"], enemyPlayed: ["Карты соперника", "Opponent cards"],
  win: ["ПОБЕДА!", "YOU WIN!"], lose: ["ПОРАЖЕНИЕ", "DEFEAT"], draw: ["НИЧЬЯ", "DRAW"],
  playAgain: ["Ещё матч", "Play again"], mainMenu: ["В меню", "Main menu"], confirm: ["Готово", "Done"],
  deckCount: ["Карт в колоде", "Cards in deck"], maxCopies: ["14 разных карт, без повторов", "14 unique cards, no duplicates"],
  addCards: ["Добавь карты из коллекции ниже. Должно быть ровно 14.", "Add cards from the collection below. Exactly 14 are required."],
  autoDeck: ["Стартовая колода", "Starter deck"], save: ["Сохранить колоду", "Save deck"], search: ["Поиск карт", "Search cards"],
  allFactions: ["Все отряды", "All squads"], sound: ["Звуковые эффекты", "Sound effects"], music: ["Музыка", "Music"],
  language: ["Язык", "Language"], volumeOff: ["выкл.", "off"], capped: ["Раундов", "Rounds"],
  remove: ["Убрать из колоды", "Remove from deck"], noCards: ["Пока нет карт", "No cards yet"],
  help: ["Потрать Стабильность на розыгрыш. Эффекты карт меняют только шкалу Стабильности, а не здоровье юнитов.", "Spend Stability to play cards. Card effects change Stability only; there are no unit health stats."],
};
const t = (key: string): string => (I18N[key] ? I18N[key][language === "ru" ? 0 : 1] : key);
function readDeck(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem("stability-deck") || "null");
    if (Array.isArray(stored)) {
      const clean: string[] = [];
      const seen = new Set<string>();
      for (const id of stored) {
        if (typeof id !== "string" || !CARD_BY_ID.has(id) || seen.has(id) || clean.length >= 14) continue;
        seen.add(id);
        clean.push(id);
      }
      if (clean.length === 14) return clean;
    }
  } catch {}
  return [...DEFAULT_DECK];
}
function saveDeck(): void { localStorage.setItem("stability-deck", JSON.stringify(deckIds)); }
function esc(value: unknown): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function englishName(card: CardDef): string {
  const known: Record<string, string> = {
    raid: "Dawn Raid", ambush: "Quiet Ambush", sniper: "Veggie Sniper", blackout: "Blackout", dog: "Frost Hound",
    convoy: "Armored Convoy", charge: "Delayed Charge", saboteur: "Saboteur", cleaner: "Scrap Cleaner", hunger: "Watch Hunger",
    payoff: "Last Bullet", pressure: "Red Line", scavenger: "Scrap Collector", map: "Old Road Map", reserves: "Spare Backpack",
    stowaway: "Stowaway", rattletrap: "Rattletrap", "dust-tax": "Dust Debt", "lone-wolf": "Lone Wolf", "street-deal": "Street Deal",
    signalman: "Signalman", "scrap-king": "Scrap King", "rust-darts": "Rust Darts", smuggler: "Smuggler", medic: "Field Medic",
    ration: "Dry Rations", hope: "Last Hope", camp: "Camp Keeper", battery: "Old Battery", quiet: "Quiet Hour",
    kitchen: "Field Kitchen", watch: "Long Watch", mediator: "Mediator", "second-wind": "Second Wind",
    "field-doctor": "Outlands Doctor", "emergency-blood": "Blood Reserve", barrier: "Living Barrier",
    "living-barrier": "Wall of Parts", signal: "Alarm Signal", overcharge: "Overcharge", coolant: "Coolant Loop",
    static: "Radio Static", jammer: "Jammer", "fault-line": "Tactical Fault", "counter-spark": "Counter Pulse",
    "mirror-trap": "Mirror Trap", "red-switch": "Red Switch", "tesla-coil": "Tesla Coil", tower: "Watchtower",
    sleeper: "Sleeper Agent", breaker: "Breaker", billboard: "Rusty Billboard", "raider-banner": "Raider Banner",
    silence: "Dead Silence", bell: "Alarm Bell", siren: "Rooftop Siren", sentry: "Last Sentry",
    "pressure-valve": "Pressure Valve", "hungry-swarm": "Hungry Swarm", "old-gun": "Old Cannon",
    "field-kitchen": "Grand Field Kitchen", "warm-camp": "Warm Camp", "quiet-hours": "Quiet Hours", purifier: "Hope Filter",
    oasis: "Concrete Oasis", "medic-cart": "Medical Cart", "spark-gen": "Spark Generator", "mutual-aid": "Mutual Aid",
    "emergency-ration": "Emergency Rations", "battery-farm": "Battery Farm", lifeline: "Lifeline",
    "hope-garden": "Garden of Hope", "numbers-game": "Strength in Numbers", "high-ground": "High Ground",
    "full-house": "Full House", "empty-seats": "Empty Seats", majority: "Majority Rules", "no-backup": "No Backup",
    jury: "The Jury", "crowd-control": "Crowd Control", flank: "Flanking Move", "lone-signal": "Lone Signal",
    "field-marshal": "Field Marshal", "open-lanes": "Open Lanes", closer: "Closer", executioner: "Executioner",
    "last-stand": "Last Stand", "dead-drop": "Dead Drop", underdog: "Underdog", "king-hill": "King of the Hill",
    "early-bird": "Early Bird", counterpunch: "Counterpunch", "rush-hour": "Rush Hour", "single-strike": "Single Strike",
    "broken-line": "Broken Line", "calm-focus": "Cool Head", curse: "Dry Law", blackmail: "Blackmailer", recall: "Recall",
    "trash-compactor": "Scrap Compactor", interceptor: "Interceptor", butcher: "Mechanic Butcher", "mute-button": "Mute Button",
    barter: "Fair Trade", anchor: "Anchor", overgrowth: "Warm Greenhouse", "night-market": "Night Market",
    "stolen-battery": "Stolen Battery", "last-bullet": "Last Shot", sunrise: "Sunrise", redline: "Redline",
    "engine-heart": "Engine Heart", community: "Common Fire", "delayed-bomb": "Time Bomb", megaphone: "Megaphone",
    "riot-shield": "Street Sign Shield", "crowd-favorite": "Crowd Favorite", "sixth-sense": "Sixth Sense",
    "final-word": "Final Word", phoenix: "Tin Can Phoenix",
  };
  return known[card.id] || card.id.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function englishFaction(faction: string): string {
  const names: Record<string, string> = {
    "Рейдеры": "Raiders", "Сборщики": "Scavengers", "Медики": "Medics", "Технари": "Techs",
    "Дозор": "Watch", "Караван": "Caravan", "Легенды": "Legends",
  };
  return names[faction] || faction;
}
function cardName(card: CardDef): string { return language === "ru" ? card.name : englishName(card); }
function cardText(card: CardDef): string {
  if (language === "ru") return card.text;
  const phase = card.trigger === "on_round_end" ? "At the end of the round, " : card.trigger === "on_destroy" ? "When destroyed, " : "On reveal, ";
  const target = card.target === "opposite" ? "the opposing slot" : card.target === "left" ? "the left adjacent slot" : card.target === "right" ? "the right adjacent slot" : card.target === "adjacent" ? "adjacent slots" : card.target === "edge" ? "an edge slot" : card.target === "self" ? "your own card" : "all slots";
  const actions: Record<CardDef["action"], string> = {
    remove: "remove a card from " + target + ".",
    bounce: "return a card from " + target + " to its owner's hand.",
    shift: "move a card from " + target + " to a neighboring empty slot.",
    lock: "lock " + target + " for the round.",
    spawn_token: "create a zero-cost Shard token in " + target + ".",
  };
  return phase + actions[card.action];
}
function factionClass(card: CardDef): string {
  const map: Record<string, string> = {
    "Рейдеры": "f-raiders", "Сборщики": "f-scavengers", "Медики": "f-medics",
    "Технари": "f-tech", "Дозор": "f-watch", "Караван": "f-caravan", "Легенды": "f-legends",
  };
  return map[card.faction] || "f-raiders";
}
function factionName(card: CardDef): string { return language === "ru" ? card.faction : englishFaction(card.faction); }
function timingName(card: CardDef): string {
  if (language === "ru") return card.trigger === "on_round_end" ? "КАЖДЫЙ РАУНД" : "ПРИ РАСКРЫТИИ";
  return card.trigger === "on_round_end" ? "ROUND END" : card.trigger === "on_destroy" ? "ON DESTROY" : "ON REVEAL";
}
function artPath(card: CardDef): string { return base + "cards/card-art-0" + card.art + ".avif"; }
function renderCard(card: CardDef, zone: string, extraClass = "", copyIndex = -1, uid = ""): string {
  const copyCount = zone === "collection" ? deckIds.filter(id => id === card.id).length : 0;
  const name = cardName(card);
  const title = cardText(card);
  const isDraggable = "";
  const uidAttr = uid ? " data-uid=\"" + esc(uid) + "\"" : "";
  const copyAttr = copyIndex >= 0 ? " data-copy-index=\"" + copyIndex + "\"" : "";
  const revealCover = zone === "board" && animationRound > 0 && (card as CardInstance).playedRound === animationRound ? "<span class=\"card-back-cover\" aria-hidden=\"true\"><i>S!</i></span>" : "";
  const text = "<button class=\"game-card " + factionClass(card) + " " + extraClass + (revealCover ? " round-reveal-card" : "") + "\" data-card-id=\"" + esc(card.id) + "\" data-zone=\"" + zone + "\"" + uidAttr + copyAttr + isDraggable + " title=\"" + esc(title) + "\" aria-label=\"" + esc(name + ". " + title) + "\">" + revealCover +
    "<span class=\"cost-badge\">" + card.cost + "</span><span class=\"rarity-mark\">" + (card.rarity === "Эпическая" ? "✦" : card.rarity === "Редкая" ? "◆" : "•") + "</span>" +
    "<span class=\"card-art\"><img src=\"" + esc(artPath(card)) + "\" alt=\"\" loading=\"lazy\"><span class=\"art-splash\"></span><span class=\"art-word\">" + esc(factionName(card).slice(0, 3).toUpperCase()) + "</span></span>" +
    "<span class=\"card-content\"><span class=\"card-name\">" + esc(name) + "</span><span class=\"card-description\">" + esc(title) + "</span><span class=\"card-bottom\"><span class=\"timing-chip\">" + timingName(card) + "</span><span class=\"faction-label\">" + esc(factionName(card)) + "</span></span></span>" +
    (zone === "collection" ? "<span class=\"copy-counter\">" + copyCount + "/2</span>" : "") +
    "</button>";
  return text;
}
function imageFallbacks(): void {
  app.querySelectorAll<HTMLImageElement>(".card-art img").forEach(img => {
    img.onerror = () => {
      if (!img.dataset.fallback) {
        img.dataset.fallback = "1";
        img.src = img.src.replace(/\.avif(?:$|\?)/, ".jpg");
      } else {
        img.closest(".card-art")?.classList.add("art-missing");
      }
    };
  });
}
function fieldSlot(p: GameState["player"], side: Side, index: number): string {
  const pending = side === "player" ? p.committed.find(item => item.targetSlot === index) : undefined;
  if (pending) {
    return "<div class=\"field-slot pending-slot\" data-slot=\"" + index + "\" data-side=\"player\">" +
      "<span class=\"slot-state\">" + (language === "ru" ? "НА РАСКРЫТИЕ" : "LOCKED IN") + "</span>" +
      renderCard(pending.card, "queue", "field-card pending-card", -1, pending.card.uid) +
      "<button class=\"cancel-queued\" data-action=\"unqueue\" data-uid=\"" + esc(pending.card.uid) + "\" aria-label=\"Cancel\">×</button></div>";
  }
  const card = p.board[index];
  if (card) {
    return "<div class=\"field-slot occupied-slot" + (card.playedRound === animationRound && animationRound > 0 ? " just-played" : "") + "\"" +
      " data-slot=\"" + index + "\" data-side=\"" + side + "\">" +
      "<span class=\"slot-number\">" + (index + 1) + "</span>" +
      renderCard(card, "board", "field-card", -1, card.uid) +
      (card.trigger === "on_round_end" ? "<span class=\"active-ribbon\">" + (language === "ru" ? "РАБОТАЕТ" : "ACTIVE") + "</span>" : "") +
      "</div>";
  }
  return "<button class=\"field-slot empty-slot" + (chosenCardUid && side === "player" ? " slot-ready" : "") + "\"" +
    (side === "player" ? " data-slot=\"" + index + "\" data-side=\"player\"" : "") + ">" +
    "<span class=\"slot-plus\">+</span><span class=\"slot-empty-label\">" + (language === "ru" ? "МЕСТО " : "SLOT ") + (index + 1) + "</span></button>";
}
function renderBoard(p: GameState["player"], side: Side): string {
  return "<div class=\"field-row " + (side === "player" ? "your-field" : "enemy-field") + "\" aria-label=\"" + (side === "player" ? t("player") : t("enemy")) + "\">" +
    p.board.map((_, index) => fieldSlot(p, side, index)).join("") + "</div>";
}
function playerBadge(p: GameState["player"], side: Side): string {
  const own = side === "player";
  return "<div class=\"player-badge " + (own ? "badge-self" : "badge-enemy") + "\"><span class=\"badge-avatar\">" + (own ? "Я" : "AI") + "</span>" +
    "<span class=\"badge-copy\"><b>" + (own ? t("player") : t("enemy")) + "</b><small>" + (own ? ((p.deck.length + p.hand.length + p.board.filter(Boolean).length + p.discard.length + p.committed.length) + "/14") : ((p.deck.length + p.hand.length + p.board.filter(Boolean).length + p.discard.length + p.committed.length) + "/14")) + " " + (language === "ru" ? "КАРТ" : "CARDS") + "</small></span>" +
    "<span class=\"stability-mini\">" + p.stability + "</span></div>";
}
function renderLog(): string {
  if (!game) return "";
  return "<aside class=\"log-panel side-rail\"><div class=\"rail-heading\"><span class=\"eyebrow\">" + t("log") + "</span><span class=\"log-live-dot\"></span></div><div class=\"log-list\">" +
    game.log.map((line, index) => "<p class=\"" + (index === 0 ? "log-new" : "") + "\">" + esc(line) + "</p>").join("") + "</div><div class=\"log-footer\">" + (language === "ru" ? "ХОДЫ РАСКРЫВАЮТСЯ ОДНОВРЕМЕННО" : "TURNS REVEAL TOGETHER") + "</div></aside>";
}
function renderArchive(): string {
  if (!game) return "";
  const p = archiveTab === "deck" ? game.player.deck.slice().reverse() : game.playedByEnemy;
  const heading = archiveTab === "deck" ? t("remaining") : t("enemyPlayed");
  return "<aside class=\"archive-panel side-rail\"><div class=\"rail-heading\"><span class=\"eyebrow\">" + t("arsenal") + "</span><span class=\"archive-count\">" + (archiveTab === "deck" ? game.player.deck.length : game.playedByEnemy.length) + "</span></div>" +
    "<div class=\"archive-tabs\"><button data-action=\"archive-tab\" data-tab=\"deck\" class=\"" + (archiveTab === "deck" ? "active" : "") + "\">" + t("remaining") + "</button><button data-action=\"archive-tab\" data-tab=\"enemy\" class=\"" + (archiveTab === "enemy" ? "active" : "") + "\">" + t("enemyPlayed") + "</button></div>" +
    "<div class=\"archive-subtitle\">" + heading + "</div><div class=\"archive-list\">" +
    (p.length ? p.map(card => "<button class=\"archive-card\" data-action=\"preview\" data-card-id=\"" + esc(card.id) + "\"><span class=\"archive-art " + factionClass(card) + "\"><img src=\"" + esc(artPath(card)) + "\" alt=\"\" loading=\"lazy\"></span><span class=\"archive-card-copy\"><b>" + esc(cardName(card)) + "</b><small>" + esc(cardText(card)) + "</small></span><span class=\"archive-cost\">" + card.cost + "</span></button>").join("") :
      "<div class=\"archive-empty\">" + (language === "ru" ? "Здесь пока пусто" : "Nothing here yet") + "</div>") +
    "</div><p class=\"archive-note\">" + t("help") + "</p></aside>";
}
function renderHand(): string {
  if (!game) return "";
  const p = game.player;
  return "<section class=\"hand-panel\"><div class=\"hand-heading\"><div><span class=\"eyebrow\">" + t("hand") + "</span><h2>" + (language === "ru" ? "Твой следующий ход" : "Your next move") + "</h2></div><div class=\"hand-counter\"><b>" + p.hand.length + "</b><span>/ 4</span><small>" + (language === "ru" ? "КАРТ" : "CARDS") + "</small></div></div>" +
    "<div class=\"hand-cards\">" + p.hand.map(card => renderCard(card, "hand", (chosenCardUid === card.uid ? "selected-card" : ""), -1, card.uid)).join("") +
    (p.hand.length === 0 ? "<div class=\"empty-hand\">" + (language === "ru" ? "Карты закончились" : "No cards in hand") + "</div>" : "") + "</div>" +
    "<div class=\"hand-hint\">" + (chosenCardUid ? t("selected") + ": " + esc(cardName(game.player.hand.find(c => c.uid === chosenCardUid)!)) + " · " + t("selectHint") : t("selectHint")) + "</div></section>";
}
function renderResult(): string {
  if (!game || !game.winner) return "";
  const status = game.winner === "draw" ? t("draw") : game.winner === "player" ? t("win") : t("lose");
  const className = game.winner === "draw" ? "result-draw" : game.winner === "player" ? "result-win" : "result-lose";
  const message = game.round >= game.settings.roundLimit && game.player.stability > 0 && game.enemy.stability > 0 ?
    (language === "ru" ? "Итог по оставшейся Стабильности" : "Result by remaining Stability") :
    (language === "ru" ? "Шкала Стабильности определила победителя." : "Stability decided the winner.");
  return "<div class=\"result-scrim\"><section class=\"result-card " + className + "\"><span class=\"result-burst\">✦</span><span class=\"eyebrow\">" + (language === "ru" ? "МАТЧ ЗАВЕРШЁН" : "MATCH COMPLETE") + "</span><h2>" + status + "</h2><p>" + esc(message) + "</p>" +
    "<div class=\"result-scores\"><div><small>" + t("player") + "</small><b>" + game.player.stability + "</b></div><div><small>" + t("enemy") + "</small><b>" + game.enemy.stability + "</b></div></div>" +
    "<div class=\"result-actions\"><button class=\"button button-hot\" data-action=\"again\">" + t("playAgain") + "</button><button class=\"button button-light\" data-action=\"home\">" + t("mainMenu") + "</button></div></section></div>";
}
function renderBattle(): string {
  if (!game) return "";
  const p = game.player;
  const e = game.enemy;
  const choices = p.committed.length;
  return "<main class=\"battle-screen\"><header class=\"game-topbar\"><button class=\"brand-lockup\" data-action=\"home\"><span class=\"brand-icon\">S!</span><span><b>" + t("title") + "</b><small>" + t("subtitle") + "</small></span></button>" +
    "<div class=\"turn-pill\"><span>" + t("round") + "</span><b>" + game.round + "<i>/7</i></b></div><div class=\"top-hint\">" + (language === "ru" ? "КОРОТКАЯ ДУЭЛЬ · ОДНОВРЕМЕННЫЕ ХОДЫ" : "QUICK DUEL · SIMULTANEOUS TURNS") + "</div>" +
    "<button class=\"icon-button\" data-action=\"settings\" aria-label=\"" + t("settings") + "\">⚙</button></header>" +
    "<div class=\"battle-columns\">" + renderLog() +
    "<section class=\"arena\"><div class=\"battle-scene-layer\" aria-hidden=\"true\"></div><div class=\"round-fx-layer\" aria-hidden=\"true\"></div><div class=\"arena-topline\"><span class=\"arena-sticker\">" + (language === "ru" ? "ЗОНА СТОЛКНОВЕНИЯ" : "CLASH ZONE") + "</span><span class=\"arena-note\">" + t("rules") + "</span></div>" +
    "<div class=\"side-row opponent-row\">" + renderBoard(e, "enemy") + "</div>" +
    "<div class=\"stability-strip\"><span class=\"stability-number stability-enemy\"><small>" + (language === "ru" ? "ВРАГ" : "ENEMY") + "</small><b>" + e.stability + "</b></span><div class=\"stability-center\"><span class=\"bolt\">↯</span><b>" + t("stability") + "</b><small>" + (language === "ru" ? "ЦЕНА И ЖИЗНЬ" : "COST & LIFE") + "</small></div><span class=\"stability-number stability-player\"><small>" + (language === "ru" ? "ТЫ" : "YOU") + "</small><b>" + p.stability + "</b></span></div>" +
    "<div class=\"side-row player-row\">" + renderBoard(p, "player") + "</div>" +
    renderHand() +
    "<div class=\"turn-actions\"><div class=\"queued-status\"><span class=\"queued-dot\"></span><span>" + (language === "ru" ? "ВЫБРАНО" : "QUEUED") + "</span><b>" + choices + "/4</b><small>" + (language === "ru" ? "карт" : "cards") + "</small></div>" +
    "<span class=\"notice-line\">" + esc(notice || (language === "ru" ? "Цена списывается при выборе; отмена вернёт её." : "Cost is paid on selection; cancel to refund it.")) + "</span>" +
    "<button class=\"button button-hot commit-button\" data-action=\"commit\">" + t("reveal") + "<span>↗</span></button></div></section>" +
    renderArchive() + "</div>" + renderResult() + "</main>";
}
function renderHome(): string {
  return "<main class=\"menu-screen home-screen\"><div class=\"home-sunburst\"></div><div class=\"home-topline\"><span class=\"mini-brand\">S!</span><span class=\"eyebrow\">" + (language === "ru" ? "КОЛЛЕКЦИОННАЯ КАРТОЧНАЯ ИГРА" : "COLLECTIBLE CARD GAME") + "</span><button class=\"icon-button home-setting\" data-action=\"settings\">⚙</button></div>" +
    "<section class=\"hero-block\"><div class=\"hero-kicker\"><span>✦</span> " + (language === "ru" ? "ПОСТАПОКАЛИПСИС НА ЛАДОНИ" : "POST-APOCALYPSE IN YOUR HAND") + "</div><h1>" + t("title") + "<span>!</span></h1><p>" + (language === "ru" ? "Собери отряд. Рискни Стабильностью. Перехитри соперника." : "Build a squad. Risk your Stability. Outplay your rival.") + "</p><div class=\"hero-stats\"><span><b>31</b><small>" + (language === "ru" ? "КАРТ" : "CARDS") + "</small></span><span><b>12</b><small>" + (language === "ru" ? "В КОЛОДЕ" : "IN DECK") + "</small></span><span><b>3–5</b><small>" + (language === "ru" ? "МИНУТЫ" : "MINUTES") + "</small></span></div></section>" +
    "<nav class=\"menu-actions\"><button class=\"menu-button menu-primary\" data-action=\"start\"><span class=\"menu-number\">01</span><span><b>" + t("single") + "</b><small>" + (language === "ru" ? "Сразись с ИИ" : "Challenge the AI") + "</small></span><i>↗</i></button>" +
    "<button class=\"menu-button\" data-action=\"pvp\"><span class=\"menu-number\">02</span><span><b>" + t("pvp") + "</b><small>" + (language === "ru" ? "Сетевой режим готовится" : "Online play is in development") + "</small></span><i>⌁</i></button>" +
    "<button class=\"menu-button\" data-action=\"decks\"><span class=\"menu-number\">03</span><span><b>" + t("decks") + "</b><small>" + (language === "ru" ? "Собери свою колоду" : "Build your own deck") + "</small></span><i>▦</i></button></nav>" +
    "<footer class=\"home-footer\"><span>STABILITY / FIELD TEST 0.3</span><span>" + (language === "ru" ? "ТАКТИКА ВАЖНЕЕ СИЛЫ" : "TACTICS OVER POWER") + "</span></footer></main>";
}
function renderDecks(): string {
  const shown = CARDS.filter(card => {
    const q = collectionQuery.trim().toLocaleLowerCase();
    const hay = (card.name + " " + card.id + " " + card.text + " " + card.faction).toLocaleLowerCase();
    return (!q || hay.includes(q) || englishName(card).toLowerCase().includes(q)) && (collectionFaction === "all" || card.faction === collectionFaction);
  });
  const totalDeckCost = deckIds.reduce((sum, id) => sum + (CARD_BY_ID.get(id)?.cost || 0), 0);
  const deckSlots = Array.from({ length: 12 }, (_, index) => {
    const id = deckIds[index];
    if (!id) return "<div class=\"deck-empty-slot\"><span>+</span><small>" + (language === "ru" ? "ПУСТО" : "EMPTY") + "</small></div>";
    const card = CARD_BY_ID.get(id)!;
    return renderCard(card, "deck", "deck-slot-card", index) + "<span class=\"deck-remove-hint\">" + (language === "ru" ? "× убрать" : "× remove") + "</span>";
  }).join("");
  return "<main class=\"menu-screen collection-screen\"><header class=\"page-topbar\"><button class=\"brand-lockup\" data-action=\"home\"><span class=\"brand-icon\">S!</span><span><b>" + t("title") + "</b><small>" + t("subtitle") + "</small></span></button><div class=\"page-actions\"><button class=\"button button-light\" data-action=\"settings\">⚙ " + t("settings") + "</button><button class=\"button button-light\" data-action=\"home\">" + t("back") + "</button></div></header>" +
    "<section class=\"page-intro\"><div><span class=\"eyebrow\">" + t("collection") + " / 31</span><h1>" + t("decks") + "</h1><p>" + t("addCards") + "</p></div><div class=\"collection-stats\"><b>31</b><span>" + (language === "ru" ? "УНИКАЛЬНЫХ КАРТ" : "UNIQUE CARDS") + "</span></div></section>" +
    "<section class=\"deck-editor\"><div class=\"deck-editor-heading\"><div><span class=\"eyebrow\">" + t("deck") + " 01</span><h2>" + (language === "ru" ? "Колода вылазки" : "Expedition deck") + "</h2><p>" + t("maxCopies") + "</p></div><div class=\"deck-progress\"><b>" + deckIds.length + "<small>/12</small></b><span class=\"deck-progress-track\"><i style=\"width:" + (deckIds.length / 14 * 100) + "%\"></i></span><small>" + (language === "ru" ? "СРЕДНЯЯ ЦЕНА" : "AVG COST") + " " + (deckIds.length ? (totalDeckCost / deckIds.length).toFixed(1) : "—") + "</small></div></div>" +
    "<div class=\"deck-slots\">" + deckSlots + "</div><div class=\"deck-tools\"><span class=\"deck-status\">" + (deckIds.length === 14 ? (language === "ru" ? "КОЛОДА ГОТОВА" : "DECK READY") : (language === "ru" ? "НУЖНО ЕЩЁ " + (14 - deckIds.length) : "ADD " + (12 - deckIds.length) + " MORE")) + "</span><button class=\"button button-light\" data-action=\"auto-deck\">" + t("autoDeck") + "</button><button class=\"button button-hot\" data-action=\"save-deck\" " + (deckIds.length !== 14 ? "disabled" : "") + ">" + t("save") + " ✓</button></div></section>" +
    "<section class=\"collection-section\"><div class=\"collection-heading\"><div><span class=\"eyebrow\">" + t("cards") + " / 120</span><h2>" + t("collection") + "</h2></div><div class=\"collection-filters\"><input id=\"collection-search\" type=\"search\" placeholder=\"" + t("search") + "\" value=\"" + esc(collectionQuery) + "\"><button class=\"button button-light\" data-action=\"find\">" + (language === "ru" ? "Найти" : "Find") + "</button><select id=\"collection-faction\" aria-label=\"" + t("allFactions") + "\"><option value=\"all\">" + t("allFactions") + "</option>" +
    Array.from(new Set(CARDS.map(card => card.faction))).map(faction => "<option value=\"" + esc(faction) + "\"" + (collectionFaction === faction ? " selected" : "") + ">" + esc(language === "ru" ? faction : englishFaction(faction)) + "</option>").join("") + "</select></div></div>" +
    "<div class=\"collection-grid\">" + shown.map(card => "<div class=\"collection-cell\">" + renderCard(card, "collection", "collection-card") + "<span class=\"collection-card-note\">" + (language === "ru" ? card.rarity : card.rarity === "Эпическая" ? "Epic" : card.rarity === "Редкая" ? "Rare" : "Common") + "</span></div>").join("") + "</div><p class=\"collection-footer\">" + (language === "ru" ? "Показано " + shown.length + " из 31 карты. Нажми на карту, чтобы добавить её в колоду." : "Showing " + shown.length + " of 31 cards. Select a card to add it to your deck.") + "</p></section></main>";
}
function renderSettings(): string {
  return "<main class=\"menu-screen settings-screen\"><header class=\"page-topbar\"><button class=\"brand-lockup\" data-action=\"home\"><span class=\"brand-icon\">S!</span><span><b>" + t("title") + "</b><small>" + t("subtitle") + "</small></span></button><button class=\"button button-light\" data-action=\"back\">" + t("back") + "</button></header><section class=\"settings-content\"><span class=\"eyebrow\">" + (language === "ru" ? "ПОД СЕБЯ" : "MAKE IT YOURS") + "</span><h1>" + t("settings") + "</h1>" +
    "<label class=\"setting-row\"><span><b>" + t("language") + "</b><small>" + (language === "ru" ? "Язык интерфейса и карт" : "Interface and card language") + "</small></span><div class=\"segmented-control\"><button data-action=\"lang\" data-lang=\"ru\" class=\"" + (language === "ru" ? "active" : "") + "\">РУС</button><button data-action=\"lang\" data-lang=\"en\" class=\"" + (language === "en" ? "active" : "") + "\">ENG</button></div></label>" +
    "<label class=\"setting-row\"><span><b>" + t("sound") + "</b><small>" + (language === "ru" ? "Розыгрыш и раскрытие карт" : "Card play and reveal") + "</small></span><input data-action=\"volume\" data-kind=\"sound\" type=\"range\" min=\"0\" max=\"1\" step=\"0.05\" value=\"" + soundVolume + "\"><output>" + Math.round(soundVolume * 100) + "%</output></label>" +
    "<label class=\"setting-row\"><span><b>" + t("music") + "</b><small>" + (language === "ru" ? "Лёгкая мелодия в меню и матче" : "A light melody in menus and matches") + "</small></span><input data-action=\"volume\" data-kind=\"music\" type=\"range\" min=\"0\" max=\"0.3\" step=\"0.01\" value=\"" + musicVolume + "\"><output>" + Math.round(musicVolume / 0.3 * 100) + "%</output></label>" +
    "<div class=\"settings-rule\"><span>30</span><div><b>" + (language === "ru" ? "Начальная Стабильность" : "Starting Stability") + "</b><small>" + (language === "ru" ? "Одна шкала — и цена карт, и условие победы." : "One scale: both card cost and win condition.") + "</small></div></div>" +
    "<button class=\"button button-hot settings-done\" data-action=\"back\">" + t("confirm") + " ✓</button></section></main>";
}
/**
 * Один размер карты на весь стол: и поле, и рука.
 * Считаем по двум ограничениям — ширина колонки и высота стола —
 * и записываем в --card-w, из которой CSS берёт 2:3 для всех карт.
 */
function fitTable(): void {
  if (page !== "battle") return;
  const arena = document.querySelector<HTMLElement>(".arena");
  const column = arena?.parentElement;
  if (!arena || !column) return;
  const style = getComputedStyle(arena);
  const px = (value: string): number => Number.parseFloat(value) || 0;
  const gap = px(style.rowGap);
  const padX = px(style.paddingLeft) + px(style.paddingRight);
  const padY = px(style.paddingTop) + px(style.paddingBottom);
  const chrome = [".arena-topline", ".stability-strip", ".turn-actions", ".hand-heading", ".hand-hint"]
    .reduce((sum, selector) => sum + (arena.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0), 0);
  const gaps = gap * 7;
  const byWidth = (column.clientWidth - padX - 6 - 3 * gap) / 4;
  const byHeight = (arena.clientHeight - padY - 6 - chrome - gaps) / 4.5;
  const width = Math.max(52, Math.min(byWidth, byHeight, 200));
  document.documentElement.style.setProperty("--card-w", width.toFixed(1) + "px");
}

function render(): void {
  battleScene?.destroy();
  battleScene = null;
  document.body.classList.toggle("battle-mode", page === "battle");
  app.innerHTML = page === "battle" ? renderBattle() : page === "decks" ? renderDecks() : page === "settings" ? renderSettings() : renderHome();
  imageFallbacks();
  if (page === "battle") {
    const sceneRoot = app.querySelector<HTMLElement>(".battle-scene-layer");
    if (sceneRoot) battleScene = mountBattleScene(sceneRoot);
    requestAnimationFrame(fitTable);
  }
  if (page === "battle" && game?.winner) document.body.classList.add("match-finished");
  else document.body.classList.remove("match-finished");
}
function showNotice(message: string): void { notice = message; }
function startMatch(): void {
  game = createGame([...deckIds]);
  page = "battle";
  chosenCardUid = null;
  archiveTab = "deck";
  notice = language === "ru" ? "Нажми карту, затем выбери место на поле." : "Tap a card, then choose a field slot.";
  sfx("start");
  startMusic();
  render();
}
function finishQueuedAction(uid: string, slot: number): boolean {
  if (!game) return false;
  const result = queueCard(game, "player", uid, slot);
  showNotice(result.message);
  if (result.ok) {
    chosenCardUid = null;
    sfx("play");
  }
  render();
  return result.ok;
}
type RoundVisualSnapshot = {
  round: number;
  before: {
    player: { stability: number; board: Array<CardInstance | null>; hand: CardInstance[]; deck: number; plans: Array<{ card: CardInstance; targetSlot: number; paid: number }> };
    enemy: { stability: number; board: Array<CardInstance | null>; hand: CardInstance[]; deck: number; plans: Array<{ card: CardInstance; targetSlot: number; paid: number }> };
  };
  after: {
    player: { stability: number; board: Array<CardInstance | null>; hand: CardInstance[]; deck: number };
    enemy: { stability: number; board: Array<CardInstance | null>; hand: CardInstance[]; deck: number };
  };
  first: Side;
  winner: GameState["winner"];
};

function animateRound(snapshot: RoundVisualSnapshot): void {
  const arena = app.querySelector<HTMLElement>(".arena");
  const layer = app.querySelector<HTMLElement>(".round-fx-layer");
  if (!arena || !layer) {
    roundAnimationRunning = false;
    app.classList.remove("round-resolving");
    animationRound = 0;
    return;
  }
  layer.innerHTML = "";
  const timeline = gsap.timeline({
    defaults: { overwrite: "auto" },
    onComplete: () => {
      layer.innerHTML = "";
      roundAnimationRunning = false;
      app.classList.remove("round-resolving");
      animationRound = 0;
      app.querySelectorAll(".just-played").forEach(el => el.classList.remove("just-played"));
    },
  });
  const stage = (label: string, tone: string) => {
    layer.querySelectorAll(".round-stage").forEach(node => node.remove());
    const chip = document.createElement("div");
    chip.className = "round-stage round-stage-" + tone;
    chip.textContent = label;
    layer.append(chip);
    gsap.fromTo(chip, { opacity: 0, y: -12, scale: 0.88, xPercent: -50 }, { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "back.out(1.7)" });
    gsap.delayedCall(1.05, () => { if (chip.isConnected) gsap.to(chip, { opacity: 0, y: -8, duration: 0.2, onComplete: () => chip.remove() }); });
  };
  const label = (ru: string, en: string) => language === "ru" ? ru : en;
  const numberFx = (side: Side, value: number, kind: "damage" | "heal" | "cost", slot?: number, sourceSide: Side = side) => {
    const strip = app.querySelector<HTMLElement>(".stability-strip");
    const target = strip?.querySelector<HTMLElement>(side === "enemy" ? ".stability-enemy" : ".stability-player");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const arenaRect = arena.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "round-number-fx round-number-" + kind + (kind === "cost" && value > 0 ? " round-number-positive" : "");
    el.textContent = (value > 0 ? "+" : "") + value;
    const source = slot === undefined ? null : app.querySelector<HTMLElement>(".field-row." + (sourceSide === "player" ? "your-field" : "enemy-field") + ' [data-slot="' + slot + '"]');
    const sourceRect = source?.getBoundingClientRect();
    el.style.left = ((sourceRect ? sourceRect.left + sourceRect.width / 2 : rect.left + rect.width / 2) - arenaRect.left) + "px";
    el.style.top = ((sourceRect ? sourceRect.top + sourceRect.height / 2 : rect.top + rect.height / 2) - arenaRect.top) + "px";
    layer.append(el);
    gsap.fromTo(el, { opacity: 0, scale: 0.55, x: 0, y: 0 }, {
      opacity: 1, scale: 1.1, x: rect.left + rect.width / 2 - (sourceRect ? sourceRect.left + sourceRect.width / 2 : rect.left + rect.width / 2),
      y: rect.top + rect.height / 2 - (sourceRect ? sourceRect.top + sourceRect.height / 2 : rect.top + rect.height / 2),
      duration: 0.42, ease: "power2.out", onComplete: () => gsap.to(el, { opacity: 0, scale: 0.8, duration: 0.18, onComplete: () => el.remove() }),
    });
  };

  const firstName = snapshot.first === "player" ? label("ТЫ ВСКРЫВАЕШЬСЯ ПЕРВЫМ", "YOU REVEAL FIRST") : label("СОПЕРНИК ВСКРЫВАЕТСЯ ПЕРВЫМ", "OPPONENT REVEALS FIRST");
  stage(firstName, "initiative");
  timeline.add(() => {
    const sideRow = app.querySelector<HTMLElement>(snapshot.first === "player" ? ".player-row" : ".opponent-row");
    sideRow?.classList.add("initiative-flash");
    battleScene?.pulseStability(snapshot.first);
    sfx("initiative");
    window.setTimeout(() => sideRow?.classList.remove("initiative-flash"), 380);
  }, 0.02);

  const orderedSides: Side[] = [snapshot.first, snapshot.first === "player" ? "enemy" : "player"];
  for (let slot = 0; slot < 4; slot++) {
    for (const side of orderedSides) {
      const card = snapshot.after[side].board[slot];
      const was = snapshot.before[side].board[slot];
      if (!card || card.playedRound !== snapshot.round || was?.uid === card.uid) continue;
      const selector = ".field-row." + (side === "player" ? "your-field" : "enemy-field") + ' [data-slot="' + slot + '"]';
      const slotEl = app.querySelector<HTMLElement>(selector);
      const cardEl = slotEl?.querySelector<HTMLElement>(".round-reveal-card");
      timeline.add(() => {
        stage(label("СЛОТ " + (slot + 1) + " · " + (side === "player" ? "ТВОЯ КАРТА" : "КАРТА СОПЕРНИКА"), "SLOT " + (slot + 1) + " · " + (side === "player" ? "YOUR CARD" : "OPPONENT CARD")), "reveal");
        battleScene?.pulseSlot(side, slot);
        if (slotEl) gsap.fromTo(slotEl, { filter: "brightness(1)" }, { filter: "brightness(1.65)", duration: 0.12, yoyo: true, repeat: 1 });
        if (cardEl) {
          const cover = cardEl.querySelector<HTMLElement>(".card-back-cover");
          // A visible two-step flip: narrow the whole card, remove the back, then reveal the face.
          gsap.killTweensOf(cardEl);
          gsap.fromTo(cardEl, { scale: 0.94, y: -5, rotate: -1.5 }, { scale: 1, y: 0, rotate: 0, duration: 0.28, ease: "power2.out" });
          if (cover) {
            gsap.killTweensOf(cover);
            gsap.set(cover, { opacity: 1, scaleX: 1, transformOrigin: "50% 50%" });
            gsap.to(cardEl, {
              scaleX: 0.04, duration: 0.3, delay: 0.05, ease: "power2.in",
              onComplete: () => {
                cover.remove();
                gsap.fromTo(cardEl, { scaleX: 0.04 }, { scaleX: 1, duration: 0.34, ease: "power2.out" });
              },
            });
          }
        }
        const planned = side === "player" ? snapshot.before.player.plans.find(plan => plan.card.uid === card.uid) : undefined;
        const cost = planned?.paid ?? card.cost;
        if (cost !== 0) {
          numberFx(side, cost > 0 ? -cost : Math.abs(cost), "cost", slot);
          sfx("cost");
        } else sfx("reveal");
      });
      timeline.to({}, { duration: 0.82 });
    }
  }

  const newlyRevealed: Array<{ side: Side; slot: number; card: CardInstance }> = [];
  for (const side of ["player", "enemy"] as const) {
    for (let slot = 0; slot < 4; slot++) {
      const card = snapshot.after[side].board[slot];
      const oldCard = snapshot.before[side].board[slot];
      if (card && card.playedRound === snapshot.round && oldCard?.uid !== card.uid) {
        newlyRevealed.push({ side, slot, card });
      }
    }
  }

  timeline.add(() => {
    stage(label("ЭФФЕКТЫ КАРТ", "CARD EFFECTS"), "effect");
    app.querySelectorAll<HTMLElement>(".round-reveal-card").forEach(cardEl => {
      gsap.fromTo(cardEl, { y: 0, scale: 1 }, { y: -7, scale: 1.035, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.out" });
    });
  }, "+=0.1");

  for (const item of newlyRevealed) {
    timeline.add(() => {
      const sideName = item.side === "player" ? label("ТВОЯ КАРТА", "YOUR CARD") : label("КАРТА СОПЕРНИКА", "OPPONENT CARD");
      const cardNameText = cardName(item.card);
      const effectText = cardText(item.card);
      stage(sideName + " · " + cardNameText, "effect");
      const slotEl = app.querySelector<HTMLElement>(".field-row." + (item.side === "player" ? "your-field" : "enemy-field") + ' [data-slot="' + item.slot + '"]');
      const cardEl = slotEl?.querySelector<HTMLElement>(".game-card");
      if (slotEl) {
        slotEl.classList.add("card-effect-active");
        window.setTimeout(() => slotEl.classList.remove("card-effect-active"), 760);
      }
      if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        const arenaRect = arena.getBoundingClientRect();
        const callout = document.createElement("div");
        callout.className = "round-effect-callout";
        callout.innerHTML = "<b>" + esc(cardNameText) + "</b><span>" + esc(effectText) + "</span>";
        callout.style.left = Math.max(8, Math.min(arenaRect.width - 248, rect.left + rect.width / 2 - arenaRect.left - 124)) + "px";
        callout.style.top = Math.max(8, rect.top - arenaRect.top - 8) + "px";
        layer.append(callout);
        gsap.fromTo(callout, { opacity: 0, y: 14, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.18, ease: "power2.out" });
        gsap.to(callout, { opacity: 0, y: -6, delay: 0.58, duration: 0.16, onComplete: () => callout.remove() });
        gsap.fromTo(cardEl, { filter: "brightness(1)" }, { filter: "brightness(1.55)", duration: 0.16, yoyo: true, repeat: 1 });
      }
      sfx("reveal");
    });
    timeline.to({}, { duration: 0.78 });
  }

  timeline.add(() => {
    for (const side of ["player", "enemy"] as const) {
      for (let slot = 0; slot < 4; slot++) {
        const oldCard = snapshot.before[side].board[slot];
        const newCard = snapshot.after[side].board[slot];
        const slotEl = app.querySelector<HTMLElement>(".field-row." + (side === "player" ? "your-field" : "enemy-field") + ' [data-slot="' + slot + '"]');
        if (oldCard) {
          const movedTo = snapshot.after[side].board.findIndex(card => card?.uid === oldCard.uid);
          const bounced = snapshot.after[side].hand.some(card => card.uid === oldCard.uid);
          if (movedTo >= 0 && movedTo !== slot) {
            const movedEl = app.querySelector<HTMLElement>(".field-row." + (side === "player" ? "your-field" : "enemy-field") + ' [data-slot="' + movedTo + '"] .game-card');
            if (movedEl) {
              movedEl.classList.add("card-shift-fx");
              gsap.fromTo(movedEl, { x: side === "player" ? -26 : 26, rotate: side === "player" ? -4 : 4, filter: "blur(2px)" }, { x: 0, rotate: 0, filter: "blur(0px)", duration: 0.28, ease: "power3.out", onComplete: () => movedEl.classList.remove("card-shift-fx") });
            }
            const trail = document.createElement("span");
            trail.className = "card-shift-trail";
            slotEl?.append(trail);
            if (trail) gsap.fromTo(trail, { opacity: 0.8, scaleX: 0.1 }, { opacity: 0, scaleX: 1.6, duration: 0.28, onComplete: () => trail.remove() });
          } else if (bounced) {
            const handCard = app.querySelector<HTMLElement>('.hand-cards [data-uid="' + oldCard.uid + '"]');
            if (handCard) gsap.fromTo(handCard, { opacity: 0.1, scale: 0.18, y: -80, rotate: 12 }, { opacity: 1, scale: 1, y: 0, rotate: 0, duration: 0.42, ease: "back.out(1.8)" });
          } else if (movedTo < 0 && !bounced) {
            const target = slotEl;
            if (target) {
              const burst = document.createElement("span");
              burst.className = "card-dissolve-fx";
              target.append(burst);
              gsap.fromTo(burst, { opacity: 0.1, scale: 0.35, rotate: -18 }, { opacity: 0.95, scale: 1.4, rotate: 25, duration: 0.24, onComplete: () => gsap.to(burst, { opacity: 0, scale: 1.8, duration: 0.2, onComplete: () => burst.remove() }) });
              gsap.fromTo(target, { x: -3 }, { x: 3, duration: 0.06, repeat: 3, yoyo: true, onComplete: () => gsap.set(target, { x: 0 }) });
              sfx("destroy");
            }
          }
        }
        if (newCard && oldCard && newCard.uid !== oldCard.uid) {
          if (slotEl) gsap.fromTo(slotEl, { scale: 0.96 }, { scale: 1, duration: 0.32, ease: "elastic.out(1, 0.35)" });
        }
      }
    }
  }, "+=0.15");

  timeline.to({}, { duration: 0.62 });
  timeline.add(() => {
    stage(label("ИТОГ ЭФФЕКТОВ", "EFFECTS RESULT"), "volley");
    const playerDelta = snapshot.after.player.stability - snapshot.before.player.stability;
    const enemyDelta = snapshot.after.enemy.stability - snapshot.before.enemy.stability;
    if (playerDelta !== 0) {
      numberFx("player", playerDelta, playerDelta > 0 ? "heal" : "damage");
      battleScene?.pulseStability("player");
    }
    if (enemyDelta !== 0) {
      numberFx("enemy", enemyDelta, enemyDelta > 0 ? "heal" : "damage");
      battleScene?.pulseStability("enemy");
    }
    if (playerDelta < 0 || enemyDelta < 0) sfx("impact");
    if (playerDelta > 0 || enemyDelta > 0) sfx("heal");
    const strip = app.querySelector<HTMLElement>(".stability-strip");
    if (strip) gsap.fromTo(strip, { scale: 1 }, { scale: 1.025, duration: 0.12, yoyo: true, repeat: 1, onComplete: () => gsap.set(strip, { scale: 1 }) });
  }, "+=0.1");
  timeline.to({}, { duration: 0.8 });

  timeline.add(() => {
    stage(label("ДОБОР ДО 4 КАРТ", "DRAW TO 4"), "draw");
    for (const side of ["player", "enemy"] as const) {
      const oldUids = new Set(snapshot.before[side].hand.map(card => card.uid));
      const fresh = snapshot.after[side].hand.filter(card => !oldUids.has(card.uid));
      if (side === "player") {
        const hand = app.querySelector<HTMLElement>(".hand-cards");
        fresh.forEach((card, index) => {
          const el = hand?.querySelector<HTMLElement>('[data-uid="' + card.uid + '"]');
          if (el) gsap.fromTo(el, { opacity: 0, y: -24, rotate: -5 }, { opacity: 1, y: 0, rotate: 0, duration: 0.34, delay: index * 0.055, ease: "back.out(1.8)" });
        });
      }
    }
    if (snapshot.after.player.deck < snapshot.before.player.deck) sfx("draw");
  }, "+=0.05");
  timeline.to({}, { duration: 0.42 });
  if (snapshot.winner) timeline.add(() => sfx(snapshot.winner === "player" ? "win" : snapshot.winner === "draw" ? "draw" : "lose"));
}

function action(name: string, target: HTMLElement | null): void {
  if (name === "home") { page = "home"; chosenCardUid = null; stopMusic(); render(); return; }
  if (name === "start" || name === "again") { startMatch(); return; }
  if (name === "pvp") { showNotice(language === "ru" ? "Сетевой режим появится позже." : "Online play is coming later."); sfx("tap"); return; }
  if (name === "decks") { page = "decks"; collectionQuery = ""; render(); return; }
  if (name === "settings") { page = "settings"; render(); return; }
  if (name === "back") { page = game && !game.winner && page === "settings" ? "battle" : "home"; render(); return; }
  if (name === "lang") {
    language = target?.dataset.lang === "en" ? "en" : "ru";
    localStorage.setItem("stability-language", language);
    render(); return;
  }
  if (name === "archive-tab") { archiveTab = target?.dataset.tab === "enemy" ? "enemy" : "deck"; render(); return; }
  if (name === "commit") {
    if (!game || game.winner || roundAnimationRunning) return;
    const resolvedRound = game.round;
    const before = {
      player: { stability: game.player.stability, board: [...game.player.board], hand: [...game.player.hand], deck: game.player.deck.length, plans: [...game.player.committed] },
      enemy: { stability: game.enemy.stability, board: [...game.enemy.board], hand: [...game.enemy.hand], deck: game.enemy.deck.length, plans: [] as typeof game.player.committed },
    };
    animationRound = resolvedRound;
    chosenCardUid = null;
    lockPlayerAndResolve(game);
    const after = {
      player: { stability: game.player.stability, board: [...game.player.board], hand: [...game.player.hand], deck: game.player.deck.length },
      enemy: { stability: game.enemy.stability, board: [...game.enemy.board], hand: [...game.enemy.hand], deck: game.enemy.deck.length },
    };
    const initiativeLine = game.log.find(line => line.includes("раскрывает карты первым"));
    const first: Side = initiativeLine?.startsWith("Ты") ? "player" : "enemy";
    const roundEvents = { round: resolvedRound, before, after, first, winner: game.winner };
    if (game.winner) sfx(game.winner === "player" ? "win" : game.winner === "draw" ? "draw" : "lose");
    render();
    roundAnimationRunning = true;
    app.classList.add("round-resolving");
    requestAnimationFrame(() => animateRound(roundEvents));
    return;
  }
  if (name === "unqueue") {
    if (game && target?.dataset.uid) {
      unqueueCard(game, "player", target.dataset.uid);
      chosenCardUid = null;
      showNotice(language === "ru" ? "Карта снята с выбора, цена возвращена." : "Card unqueued; Stability refunded.");
      sfx("tap"); render();
    }
    return;
  }
  if (name === "auto-deck") {
    deckIds = [...DEFAULT_DECK]; saveDeck(); showNotice(language === "ru" ? "Стартовая колода восстановлена." : "Starter deck restored."); render(); return;
  }
  if (name === "save-deck") {
    if (deckIds.length !== 14) return;
    saveDeck(); showNotice(language === "ru" ? "Колода сохранена." : "Deck saved."); sfx("win"); render(); return;
  }
  if (name === "find") {
    const input = app.querySelector<HTMLInputElement>("#collection-search");
    collectionQuery = input?.value || "";
    render(); return;
  }
  if (name === "preview") {
    const id = target?.dataset.cardId;
    const card = id ? CARD_BY_ID.get(id) : undefined;
    if (card) { showNotice(cardName(card) + " — " + cardText(card)); render(); }
    return;
  }
}
app.addEventListener("click", event => {
  if (suppressNextClick) { suppressNextClick = false; event.preventDefault(); return; }
  const el = event.target instanceof HTMLElement ? event.target : null;
  if (!el) return;
  const actionEl = el.closest<HTMLElement>("[data-action]");
  if (actionEl) { action(actionEl.dataset.action || "", actionEl); return; }
  if (page === "decks") {
    const cardEl = el.closest<HTMLElement>("[data-card-id][data-zone]");
    if (!cardEl) return;
    const id = cardEl.dataset.cardId || "";
    const zone = cardEl.dataset.zone;
    if (zone === "deck") {
      const index = Number(cardEl.dataset.copyIndex);
      if (Number.isInteger(index) && index >= 0 && index < deckIds.length) deckIds.splice(index, 1);
      saveDeck(); render(); return;
    }
    if (zone === "collection") {
      const count = deckIds.filter(value => value === id).length;
      if (deckIds.length >= 14) { showNotice(language === "ru" ? "Колода уже содержит 14 карт. Убери одну из верхнего ряда." : "Deck already has 14 cards. Remove one from the top row."); return; }
      if (count >= 1) { showNotice(language === "ru" ? "Эта карта уже есть в колоде." : "This card is already in the deck."); return; }
      if (CARD_BY_ID.has(id) && !CARD_BY_ID.get(id)?.token) deckIds.push(id);
      saveDeck(); render(); return;
    }
  }
  if (page !== "battle" || !game || game.winner) return;
  const cardEl = el.closest<HTMLElement>("[data-card-id][data-zone]");
  if (cardEl) {
    const zone = cardEl.dataset.zone;
    const uid = cardEl.dataset.uid || "";
    const slotEl = cardEl.closest<HTMLElement>("[data-slot]");
    if (zone === "queue") {
      if (uid) action("unqueue", cardEl);
      return;
    }
    if (zone === "hand") {
      const found = game.player.hand.find(card => card.uid === uid);
      if (!found) return;
      chosenCardUid = chosenCardUid === uid ? null : uid;
      showNotice(chosenCardUid ? (language === "ru" ? "Теперь выбери место на своём поле." : "Now choose a slot on your field.") : (language === "ru" ? "Выбор карты отменён." : "Card selection cancelled."));
      sfx("tap"); render(); return;
    }
    if (zone === "board" && slotEl && chosenCardUid) {
      finishQueuedAction(chosenCardUid, Number(slotEl.dataset.slot)); return;
    }
    if (zone === "board" && !chosenCardUid) {
      const card = CARD_BY_ID.get(cardEl.dataset.cardId || "");
      if (card) { showNotice(cardName(card) + ": " + cardText(card)); render(); }
      return;
    }
  }
  const slotEl = el.closest<HTMLElement>("[data-slot][data-side=\"player\"]");
  if (slotEl && chosenCardUid) {
    finishQueuedAction(chosenCardUid, Number(slotEl.dataset.slot)); return;
  }
});
function removeDragGhost(ghost: HTMLElement | null, delay = 230): void {
  if (!ghost) return;
  const remove = () => {
    ghost.removeEventListener("transitionend", remove);
    ghost.remove();
  };
  ghost.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, delay);
}
function animateDragGhostBack(drag: NonNullable<typeof activeCardDrag>): void {
  const ghost = drag.ghost;
  if (!ghost) return;
  ghost.style.transition = "transform 190ms cubic-bezier(.2,.8,.2,1), opacity 190ms ease";
  ghost.style.transform = "translate3d(0,0,0) rotate(0deg) scale(.96)";
  ghost.style.opacity = "0";
  removeDragGhost(ghost, 230);
}
function updateDragSlot(drag: NonNullable<typeof activeCardDrag>): void {
  document.querySelectorAll<HTMLElement>(".field-slot.drop-target").forEach(slot => slot.classList.remove("drop-target"));
  const hit = document.elementFromPoint(drag.x, drag.y);
  const slot = hit instanceof HTMLElement ? hit.closest<HTMLElement>(".field-slot[data-slot][data-side=\"player\"]") : null;
  drag.slot = slot;
  drag.slot?.classList.add("drop-target");
}
app.addEventListener("pointerdown", event => {
  // Clear any orphaned drag visual before a new interaction starts.
  document.querySelectorAll<HTMLElement>(".drag-ghost-card").forEach(ghost => ghost.remove());
  if (!(event instanceof PointerEvent) || event.button !== 0 || page !== "battle" || !game || game.winner) return;
  const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('button.game-card[data-zone="hand"][data-uid]') : null;
  if (!target || !target.closest(".hand-cards")) return;
  const uid = target.dataset.uid;
  if (!uid || !game.player.hand.some(card => card.uid === uid)) return;
  const rect = target.getBoundingClientRect();
  try { target.setPointerCapture(event.pointerId); } catch {}
  activeCardDrag = {
    pointerId: event.pointerId, uid, source: target, sourceRect: rect,
    startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
    ghost: null, slot: null, moved: false
  };
});
window.addEventListener("pointermove", event => {
  const drag = activeCardDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.x = event.clientX;
  drag.y = event.clientY;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) > 7) {
    drag.moved = true;
    drag.source.classList.add("dragging-card");
    const ghost = drag.source.cloneNode(true) as HTMLElement;
    ghost.classList.remove("dragging-card", "selected-card");
    ghost.classList.add("drag-ghost-card");
    ghost.removeAttribute("draggable");
    ghost.style.width = drag.sourceRect.width + "px";
    ghost.style.height = drag.sourceRect.height + "px";
    ghost.style.left = drag.sourceRect.left + "px";
    ghost.style.top = drag.sourceRect.top + "px";
    ghost.style.margin = "0";
    ghost.style.transition = "none";
    ghost.style.transform = "translate3d(0,0,0) rotate(0deg) scale(1)";
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    chosenCardUid = drag.uid;
    sfx("grab");
  }
  if (!drag.moved || !drag.ghost) return;
  event.preventDefault();
  const tilt = Math.max(-7, Math.min(7, dx * 0.045));
  drag.ghost.style.transform = "translate3d(" + dx + "px," + dy + "px,0) rotate(" + tilt + "deg) scale(1.035)";
  updateDragSlot(drag);
});
document.addEventListener("pointerup", event => {
  const drag = activeCardDrag;
  // A drag preview must never survive mouse release, even if the drag state was lost.
  document.querySelectorAll<HTMLElement>(".drag-ghost-card").forEach(ghost => ghost.remove());
  document.querySelectorAll<HTMLElement>(".dragging-card").forEach(card => card.classList.remove("dragging-card"));
  if (!drag || event.pointerId !== drag.pointerId) {
    activeCardDrag = null;
    return;
  }
  activeCardDrag = null;
  drag.x = event.clientX;
  drag.y = event.clientY;
  if (!drag.moved || !drag.ghost) {
    drag.source.classList.remove("dragging-card");
    return;
  }
  event.preventDefault();
  suppressNextClick = true;
  window.setTimeout(() => { suppressNextClick = false; }, 350);
  updateDragSlot(drag);
  document.querySelectorAll<HTMLElement>(".field-slot.drop-target").forEach(slot => slot.classList.remove("drop-target"));
  const slot = drag.slot;
  const targetRect = slot?.getBoundingClientRect();
  const accepted = !!slot && !slot.classList.contains("pending-slot") && finishQueuedAction(drag.uid, Number(slot.dataset.slot));
  if (accepted && targetRect && drag.ghost) {
    const sx = targetRect.width / Math.max(1, drag.sourceRect.width);
    const tx = targetRect.left - drag.sourceRect.left;
    const ty = targetRect.top - drag.sourceRect.top;
    drag.ghost.style.transition = "transform 190ms cubic-bezier(.18,.82,.25,1.12), opacity 190ms ease";
    drag.ghost.style.transform = "translate3d(" + tx + "px," + ty + "px,0) rotate(0deg) scale(" + sx + ")";
    removeDragGhost(drag.ghost, 230);
    sfx("drop");
  } else {
    chosenCardUid = null;
    if (!slot) showNotice(language === "ru" ? "Карта возвращена в руку: выбери место на своём поле." : "Card returned to hand. Drop it on your field.");
    render();
    sfx("invalid");
    animateDragGhostBack(drag);
  }
  drag.source.classList.remove("dragging-card");
}, true);
window.addEventListener("pointercancel", event => {
  const drag = activeCardDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  activeCardDrag = null;
  document.querySelectorAll<HTMLElement>(".field-slot.drop-target").forEach(slot => slot.classList.remove("drop-target"));
  if (drag.moved && drag.ghost) animateDragGhostBack(drag);
  drag.source.classList.remove("dragging-card");
});
window.addEventListener("blur", () => {
  const drag = activeCardDrag;
  activeCardDrag = null;
  document.querySelectorAll<HTMLElement>(".field-slot.drop-target").forEach(slot => slot.classList.remove("drop-target"));
  document.querySelectorAll<HTMLElement>(".drag-ghost-card").forEach(ghost => ghost.remove());
  document.querySelectorAll<HTMLElement>(".dragging-card").forEach(card => card.classList.remove("dragging-card"));
  if (drag?.source) drag.source.classList.remove("dragging-card");
});
app.addEventListener("change", event => {
  const el = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement ? event.target : null;
  if (!el) return;
  if (el.id === "collection-faction") { collectionFaction = el.value; render(); }
});
app.addEventListener("input", event => {
  const el = event.target instanceof HTMLInputElement ? event.target : null;
  if (!el || el.dataset.action !== "volume") return;
  const value = Number(el.value);
  if (el.dataset.kind === "sound") {
    soundVolume = value; localStorage.setItem("stability-sound-volume", String(value));
  } else {
    musicVolume = value; localStorage.setItem("stability-music-volume", String(value));
    if (musicVolume <= 0) stopMusic(); else startMusic();
  }
  const out = el.parentElement?.querySelector("output");
  if (out) out.textContent = Math.round(value * (el.dataset.kind === "music" ? 100 / 0.3 : 100)) + "%";
});
function getAudio(): AudioContext | null {
  try {
    if (!audio) audio = new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch { return null; }
}
function tone(frequency: number, duration: number, volume: number, type: OscillatorType = "triangle"): void {
  if (volume <= 0) return;
  const ctx = getAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(Math.max(0.0001, volume), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + duration);
}
function sfx(kind: string): void {
  const v = soundVolume * 0.14;
  if (kind === "grab") { tone(250, 0.045, v * 0.55, "triangle"); }
  else if (kind === "drop") { tone(165, 0.075, v * 0.9, "triangle"); window.setTimeout(() => tone(310, 0.075, v * 0.55, "sine"), 45); }
  else if (kind === "invalid") { tone(210, 0.09, v * 0.6, "sine"); window.setTimeout(() => tone(155, 0.11, v * 0.4, "sine"), 55); }
  else if (kind === "play" || kind === "reveal") { tone(kind === "play" ? 420 : 660, 0.13, v); window.setTimeout(() => tone(kind === "play" ? 590 : 880, 0.16, v * 0.72), 65); }
  else if (kind === "win") { tone(523, 0.18, v); window.setTimeout(() => tone(659, 0.18, v), 100); window.setTimeout(() => tone(784, 0.28, v), 210); }
  else if (kind === "lose") { tone(330, 0.22, v * 0.8, "sine"); window.setTimeout(() => tone(247, 0.34, v * 0.8, "sine"), 140); }
  else if (kind === "draw") { tone(440, 0.18, v * 0.8); }
  else if (kind === "start") { tone(330, 0.12, v); window.setTimeout(() => tone(440, 0.12, v), 60); }
  else if (kind === "initiative") { tone(510, 0.10, v * 0.7, "sine"); window.setTimeout(() => tone(820, 0.19, v, "triangle"), 70); }
  else if (kind === "cost") { tone(180, 0.10, v * 0.8, "sawtooth"); }
  else if (kind === "impact") { tone(105, 0.12, v, "triangle"); window.setTimeout(() => tone(72, 0.15, v * 0.65, "sine"), 55); }
  else if (kind === "heal") { tone(620, 0.12, v * 0.65, "sine"); window.setTimeout(() => tone(880, 0.19, v * 0.55, "sine"), 65); }
  else if (kind === "destroy") { tone(145, 0.13, v * 0.75, "sawtooth"); window.setTimeout(() => tone(82, 0.18, v * 0.5, "triangle"), 75); }
  else if (kind === "draw") { tone(560, 0.07, v * 0.55, "sine"); window.setTimeout(() => tone(740, 0.10, v * 0.45, "sine"), 45); }
  else tone(390, 0.06, v * 0.45);
}
function startMusic(): void {
  if (musicVolume <= 0 || musicTimer !== null) return;
  const notes = [392, 494, 587, 494, 440, 523, 659, 523, 392, 494, 587, 698, 659, 587, 494, 440];
  musicTimer = window.setInterval(() => {
    if (page === "home" || page === "battle" || page === "decks") {
      const note = notes[musicStep % notes.length];
      tone(note, 0.28, musicVolume * 0.055, "sine");
      if (musicStep % 4 === 0) tone(note / 2, 0.34, musicVolume * 0.025, "triangle");
      musicStep++;
    }
  }, 520);
}
function stopMusic(): void {
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = null;
}
window.addEventListener("pagehide", stopMusic);
window.addEventListener("resize", fitTable);
window.addEventListener("orientationchange", () => requestAnimationFrame(fitTable));
if (document.fonts?.ready) void document.fonts.ready.then(fitTable);
render();
