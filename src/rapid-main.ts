import { CARDS, CARD_BY_ID, DEFAULT_DECK, type CardDef, type Side } from "./game/cards";
import { createGame, queueCard, unqueueCard, lockPlayerAndResolve, type CardInstance, type GameState } from "./game/rapid-core";
import "./rapid.css";
import { mountBattleScene, type BattleSceneHandle } from "./battle-scene";

let battleScene: BattleSceneHandle | null = null;

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
  rules: ["30 Стабильности · 12 карт · 4 места · рука 4 · до 7 раундов", "30 Stability · 12 cards · 4 slots · hand 4 · up to 7 rounds"],
  hand: ["ТВОЯ РУКА", "YOUR HAND"], enemy: ["СОПЕРНИК", "OPPONENT"], player: ["ТВОЙ ЛАГЕРЬ", "YOUR CAMP"],
  reveal: ["Зафиксировать ход", "Lock in turn"], pass: ["Можно пропустить ход", "You may pass this turn"],
  selected: ["Выбрана", "Selected"], selectHint: ["Выбери карту в руке, затем нажми место на поле.", "Select a card, then tap a field slot."],
  round: ["РАУНД", "ROUND"], stability: ["СТАБИЛЬНОСТЬ", "STABILITY"], left: ["ОСТАЛОСЬ", "LEFT"],
  log: ["ХРОНИКА", "MATCH LOG"], arsenal: ["АРХИВ", "ARCHIVE"], remaining: ["Колода", "Deck"], enemyPlayed: ["Карты соперника", "Opponent cards"],
  win: ["ПОБЕДА!", "YOU WIN!"], lose: ["ПОРАЖЕНИЕ", "DEFEAT"], draw: ["НИЧЬЯ", "DRAW"],
  playAgain: ["Ещё матч", "Play again"], mainMenu: ["В меню", "Main menu"], confirm: ["Готово", "Done"],
  deckCount: ["Карт в колоде", "Cards in deck"], maxCopies: ["Не больше 2 копий одной карты", "Max 2 copies of a card"],
  addCards: ["Добавь карты из коллекции ниже. Должно быть ровно 12.", "Add cards from the collection below. Exactly 12 are required."],
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
      const counts = new Map<string, number>();
      for (const id of stored) {
        if (typeof id !== "string" || !CARD_BY_ID.has(id) || (counts.get(id) || 0) >= 2 || clean.length >= 12) continue;
        counts.set(id, (counts.get(id) || 0) + 1);
        clean.push(id);
      }
      if (clean.length === 12) return clean;
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
  const e = card.effect;
  const n = e.amount;
  const phase = card.timing === "end" ? "At the end of each round, " : "On reveal, ";
  switch (e.kind) {
    case "damage": return phase + "the enemy loses " + n + " Stability.";
    case "heal": return phase + "restore " + n + " Stability.";
    case "transfer": return phase + "transfer " + n + " Stability from the enemy to you.";
    case "draw": return phase + "draw up to " + n + " card(s).";
    case "remove": return phase + "remove up to " + n + " old enemy card(s).";
    case "return": return phase + "return an old card from your field to your hand.";
    case "boost": return "Your next Stability-damage effect is increased by " + n + ".";
    case "delay": return "At the start of the next round, the enemy loses " + n + " Stability.";
    case "own-count": return phase + "the enemy loses " + n + " Stability per card on your field.";
    case "enemy-count": return phase + "the enemy loses " + n + " Stability per card on their field.";
    case "own-heal": return phase + "restore " + n + " Stability per card on your field.";
    case "guard": return phase + "reduce incoming Stability loss this round by " + n + ".";
    case "curse": return "The enemy cannot restore Stability this round.";
    case "payoff": return phase + "the enemy loses " + n + " Stability, doubled when you have " + (e.min ?? 10) + " or less.";
    case "total-count": return phase + "the enemy loses " + n + " Stability per card on both fields.";
    case "hand-count": return phase + "restore " + n + " Stability per card in your hand.";
    case "enemy-hand-count": return phase + "the enemy loses " + n + " Stability per card in their hand.";
    case "if-own-more": return phase + "if you have more field cards, the enemy loses " + n + " Stability.";
    case "if-own-less": return phase + "if you have fewer field cards, the enemy loses " + n + " Stability.";
    case "enemy-played-more": return phase + "if the enemy played at least two cards, they lose " + n + " Stability.";
    case "enemy-played-less": return phase + "if the enemy played one card or fewer, they lose " + n + " Stability.";
    case "own-played-more": return phase + "if you played two cards, the enemy loses " + n + " Stability.";
    case "own-played-less": return phase + "if you played one card or fewer, the enemy loses " + n + " Stability.";
    case "if-enemy-stability-low": return phase + "if the enemy has " + (e.threshold ?? 10) + " Stability or less, they lose " + n + ".";
    case "if-own-stability-low": return phase + "if you have " + (e.threshold ?? 10) + " Stability or less, restore " + n + ".";
    default: return card.text;
  }
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
  if (language === "ru") return card.timing === "end" ? "КАЖДЫЙ РАУНД" : "ПРИ РАСКРЫТИИ";
  return card.timing === "end" ? "EACH ROUND" : "ON REVEAL";
}
function artPath(card: CardDef): string { return base + "cards/card-art-0" + card.art + ".avif"; }
function renderCard(card: CardDef, zone: string, extraClass = "", copyIndex = -1, uid = ""): string {
  const copyCount = zone === "collection" ? deckIds.filter(id => id === card.id).length : 0;
  const name = cardName(card);
  const title = cardText(card);
  const isDraggable = "";
  const uidAttr = uid ? " data-uid=\"" + esc(uid) + "\"" : "";
  const copyAttr = copyIndex >= 0 ? " data-copy-index=\"" + copyIndex + "\"" : "";
  const text = "<button class=\"game-card " + factionClass(card) + " " + extraClass + "\" data-card-id=\"" + esc(card.id) + "\" data-zone=\"" + zone + "\"" + uidAttr + copyAttr + isDraggable + " title=\"" + esc(title) + "\" aria-label=\"" + esc(name + ". " + title) + "\">" +
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
    return "<div class=\"field-slot occupied-slot" + (card.playedRound === (game?.round ?? -1) ? " just-played" : "") + "\"" +
      (side === "player" ? " data-slot=\"" + index + "\" data-side=\"player\"" : "") + ">" +
      "<span class=\"slot-number\">" + (index + 1) + "</span>" +
      renderCard(card, "board", "field-card", -1, card.uid) +
      (card.timing === "end" ? "<span class=\"active-ribbon\">" + (language === "ru" ? "РАБОТАЕТ" : "ACTIVE") + "</span>" : "") +
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
    "<span class=\"badge-copy\"><b>" + (own ? t("player") : t("enemy")) + "</b><small>" + (own ? ((p.deck.length + p.hand.length + p.board.filter(Boolean).length + p.discard.length + p.committed.length) + "/12") : ((p.deck.length + p.hand.length + p.board.filter(Boolean).length + p.discard.length + p.committed.length) + "/12")) + " " + (language === "ru" ? "КАРТ" : "CARDS") + "</small></span>" +
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
    "<section class=\"arena\"><div class=\"battle-scene-layer\" aria-hidden=\"true\"></div><div class=\"arena-topline\"><span class=\"arena-sticker\">" + (language === "ru" ? "ЗОНА СТОЛКНОВЕНИЯ" : "CLASH ZONE") + "</span><span class=\"arena-note\">" + t("rules") + "</span></div>" +
    "<div class=\"side-row opponent-row\">" + renderBoard(e, "enemy") + "</div>" +
    "<div class=\"stability-strip\"><span class=\"stability-number stability-enemy\"><small>" + (language === "ru" ? "ВРАГ" : "ENEMY") + "</small><b>" + e.stability + "</b></span><div class=\"stability-center\"><span class=\"bolt\">↯</span><b>" + t("stability") + "</b><small>" + (language === "ru" ? "ЦЕНА И ЖИЗНЬ" : "COST & LIFE") + "</small></div><span class=\"stability-number stability-player\"><small>" + (language === "ru" ? "ТЫ" : "YOU") + "</small><b>" + p.stability + "</b></span></div>" +
    "<div class=\"side-row player-row\">" + renderBoard(p, "player") + "</div>" +
    renderHand() +
    "<div class=\"turn-actions\"><div class=\"queued-status\"><span class=\"queued-dot\"></span><span>" + (language === "ru" ? "ВЫБРАНО" : "QUEUED") + "</span><b>" + choices + "/2</b><small>" + (language === "ru" ? "карт" : "cards") + "</small></div>" +
    "<span class=\"notice-line\">" + esc(notice || (language === "ru" ? "Цена списывается при выборе; отмена вернёт её." : "Cost is paid on selection; cancel to refund it.")) + "</span>" +
    "<button class=\"button button-hot commit-button\" data-action=\"commit\">" + t("reveal") + "<span>↗</span></button></div></section>" +
    renderArchive() + "</div>" + renderResult() + "</main>";
}
function renderHome(): string {
  return "<main class=\"menu-screen home-screen\"><div class=\"home-sunburst\"></div><div class=\"home-topline\"><span class=\"mini-brand\">S!</span><span class=\"eyebrow\">" + (language === "ru" ? "КОЛЛЕКЦИОННАЯ КАРТОЧНАЯ ИГРА" : "COLLECTIBLE CARD GAME") + "</span><button class=\"icon-button home-setting\" data-action=\"settings\">⚙</button></div>" +
    "<section class=\"hero-block\"><div class=\"hero-kicker\"><span>✦</span> " + (language === "ru" ? "ПОСТАПОКАЛИПСИС НА ЛАДОНИ" : "POST-APOCALYPSE IN YOUR HAND") + "</div><h1>" + t("title") + "<span>!</span></h1><p>" + (language === "ru" ? "Собери отряд. Рискни Стабильностью. Перехитри соперника." : "Build a squad. Risk your Stability. Outplay your rival.") + "</p><div class=\"hero-stats\"><span><b>120</b><small>" + (language === "ru" ? "КАРТ" : "CARDS") + "</small></span><span><b>12</b><small>" + (language === "ru" ? "В КОЛОДЕ" : "IN DECK") + "</small></span><span><b>3–5</b><small>" + (language === "ru" ? "МИНУТЫ" : "MINUTES") + "</small></span></div></section>" +
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
    "<section class=\"page-intro\"><div><span class=\"eyebrow\">" + t("collection") + " / 120</span><h1>" + t("decks") + "</h1><p>" + t("addCards") + "</p></div><div class=\"collection-stats\"><b>120</b><span>" + (language === "ru" ? "УНИКАЛЬНЫХ КАРТ" : "UNIQUE CARDS") + "</span></div></section>" +
    "<section class=\"deck-editor\"><div class=\"deck-editor-heading\"><div><span class=\"eyebrow\">" + t("deck") + " 01</span><h2>" + (language === "ru" ? "Колода вылазки" : "Expedition deck") + "</h2><p>" + t("maxCopies") + "</p></div><div class=\"deck-progress\"><b>" + deckIds.length + "<small>/12</small></b><span class=\"deck-progress-track\"><i style=\"width:" + (deckIds.length / 12 * 100) + "%\"></i></span><small>" + (language === "ru" ? "СРЕДНЯЯ ЦЕНА" : "AVG COST") + " " + (deckIds.length ? (totalDeckCost / deckIds.length).toFixed(1) : "—") + "</small></div></div>" +
    "<div class=\"deck-slots\">" + deckSlots + "</div><div class=\"deck-tools\"><span class=\"deck-status\">" + (deckIds.length === 12 ? (language === "ru" ? "КОЛОДА ГОТОВА" : "DECK READY") : (language === "ru" ? "НУЖНО ЕЩЁ " + (12 - deckIds.length) : "ADD " + (12 - deckIds.length) + " MORE")) + "</span><button class=\"button button-light\" data-action=\"auto-deck\">" + t("autoDeck") + "</button><button class=\"button button-hot\" data-action=\"save-deck\" " + (deckIds.length !== 12 ? "disabled" : "") + ">" + t("save") + " ✓</button></div></section>" +
    "<section class=\"collection-section\"><div class=\"collection-heading\"><div><span class=\"eyebrow\">" + t("cards") + " / 120</span><h2>" + t("collection") + "</h2></div><div class=\"collection-filters\"><input id=\"collection-search\" type=\"search\" placeholder=\"" + t("search") + "\" value=\"" + esc(collectionQuery) + "\"><button class=\"button button-light\" data-action=\"find\">" + (language === "ru" ? "Найти" : "Find") + "</button><select id=\"collection-faction\" aria-label=\"" + t("allFactions") + "\"><option value=\"all\">" + t("allFactions") + "</option>" +
    Array.from(new Set(CARDS.map(card => card.faction))).map(faction => "<option value=\"" + esc(faction) + "\"" + (collectionFaction === faction ? " selected" : "") + ">" + esc(language === "ru" ? faction : englishFaction(faction)) + "</option>").join("") + "</select></div></div>" +
    "<div class=\"collection-grid\">" + shown.map(card => "<div class=\"collection-cell\">" + renderCard(card, "collection", "collection-card") + "<span class=\"collection-card-note\">" + (language === "ru" ? card.rarity : card.rarity === "Эпическая" ? "Epic" : card.rarity === "Редкая" ? "Rare" : "Common") + "</span></div>").join("") + "</div><p class=\"collection-footer\">" + (language === "ru" ? "Показано " + shown.length + " из 120 карт. Нажми на карту, чтобы добавить её в колоду." : "Showing " + shown.length + " of 120 cards. Select a card to add it to your deck.") + "</p></section></main>";
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
    if (!game || game.winner) return;
    chosenCardUid = null;
    lockPlayerAndResolve(game);
    if (game.winner) sfx(game.winner === "player" ? "win" : game.winner === "draw" ? "draw" : "lose");
    else sfx("reveal");
    render(); return;
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
    if (deckIds.length !== 12) return;
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
      if (deckIds.length >= 12) { showNotice(language === "ru" ? "Колода уже содержит 12 карт. Убери одну из верхнего ряда." : "Deck already has 12 cards. Remove one from the top row."); return; }
      if (count >= 2) { showNotice(language === "ru" ? "Можно взять не больше двух копий." : "Only two copies are allowed."); return; }
      if (CARD_BY_ID.has(id)) deckIds.push(id);
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
  const slot = hit instanceof HTMLElement ? hit.closest<HTMLElement>(".field-slot.empty-slot[data-slot][data-side=\"player\"]") : null;
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
