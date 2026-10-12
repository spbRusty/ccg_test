import { CARD_TYPES, CARD_POOL } from "../cards/card-data";
import { makeCardFace } from "./card-face";

const DECK_SIZE = 30;
const MAX_COPIES = 2;
const STORAGE_KEY = "rift.customDeck";
const LANGUAGE_KEY = "rift.language";
const SOUND_KEY = "rift.sound";
const MUSIC_KEY = "rift.music";
const MUSIC_VOLUME_KEY = "rift.musicVolume";

type Language = "ru" | "en";
const words: Record<Language, Record<string, string>> = {
  ru: {
    eyebrow: "КОЛЛЕКЦИОННАЯ КАРТОЧНАЯ ИГРА", title: "Временной разлом", gameEyebrow: "ПРОТОТИП ККИ", opponentSubtitle: "Простой ИИ", opponentHand: "В руке:", ownTime: "Твоё время", handHint: "Выбирай несколько карт и разыгрывай их за один ход.", move: "Переместить выбранную", return: "Вернуть в руку", remove: "Снять выбранные карты", sacrifice: "Пожертвовать выбранные", boardClear: "Снять выделение",
    subtitle: "Собери колоду. Измени ход времени. Переживи разлом.",
    pvp: "PvP", single: "Одиночная кампания", collection: "Коллекция и колоды",
    progress: "Лента прогресса", shop: "Магазин", settings: "Настройки",
    sound: "Звуковые эффекты", music: "Музыка", musicVolume: "Громкость музыки", language: "Язык приложения",
    back: "В меню", deckTitle: "Конструктор колоды", library: "Все карты",
    search: "Поиск карт…", deck: "Твоя колода", empty: "Перетащи карту сюда или нажми на карту слева.",
    starter: "Случайная колода", clear: "Очистить", save: "Сохранить колоду",
    count: "карт", addHint: "Нажми на карту или перетащи её в колоду.",
    pvpSoon: "PvP появится после подключения сетевой игры.",
    progressSoon: "Лента прогресса появится в следующем обновлении.",
    shopSoon: "Магазин пока недоступен.", saved: "Колода сохранена.",
    deckFull: "В колоде уже 30 карт.", copyLimit: "Можно добавить не больше двух копий одной карты.",
    needsThirty: "Для сохранения в колоде должно быть ровно 30 карт.",
    game: "Игра", newGame: "Новая игра", fullscreen: "На весь экран",
    opponent: "Противник", yourTime: "Твоё время", hand: "Карты в руке",
    selected: "Выбрано несколько карт — разыграй их за один ход.",
    play: "Разыграть выбранные", pass: "Завершить ход", log: "ЖУРНАЛ ПАРТИИ",
    allCards: "Все карты", opponentCards: "Карты противника", cardDetails: "КАРТА",
    searchLibrary: "Поиск среди 500 карт…", deckHint: "Собери колоду из 30 карт. До двух копий каждой карты."
  },
  en: {
    eyebrow: "COLLECTIBLE CARD GAME", title: "Temporal Rift", gameEyebrow: "CCG PROTOTYPE", opponentSubtitle: "Basic AI", opponentHand: "In hand:", ownTime: "Your time", handHint: "Select multiple cards to play them in one turn.", move: "Move selected", return: "Return to hand", remove: "Remove selected", sacrifice: "Sacrifice selected", boardClear: "Clear selection",
    subtitle: "Build your deck. Bend time. Survive the rift.",
    pvp: "PvP", single: "Single-player campaign", collection: "Collection & Decks",
    progress: "Progress track", shop: "Shop", settings: "Settings",
    sound: "Sound effects", music: "Music", musicVolume: "Music volume", language: "App language",
    back: "Main menu", deckTitle: "Deck builder", library: "All cards",
    search: "Search cards…", deck: "Your deck", empty: "Drag a card here or click a card on the left.",
    starter: "Random deck", clear: "Clear", save: "Save deck",
    count: "cards", addHint: "Click a card or drag it into your deck.",
    pvpSoon: "PvP will be available when online play is connected.",
    progressSoon: "The progress track is planned for a future update.",
    shopSoon: "The shop is not available yet.", saved: "Deck saved.",
    deckFull: "Your deck already has 30 cards.", copyLimit: "You can add at most two copies of a card.",
    needsThirty: "A deck must contain exactly 30 cards to be saved.",
    game: "Game", newGame: "New game", fullscreen: "Fullscreen",
    opponent: "Opponent", yourTime: "Your time", hand: "Cards in hand",
    selected: "Select cards to play several in one turn.",
    play: "Play selected", pass: "End turn", log: "MATCH LOG",
    allCards: "All cards", opponentCards: "Opponent cards", cardDetails: "CARD",
    searchLibrary: "Search 500 cards…", deckHint: "Build a 30-card deck. Up to two copies per card."
  }
};

function readDeck(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((key): key is string => typeof key === "string" && key in CARD_TYPES).slice(0, DECK_SIZE) : [];
  } catch { return []; }
}

export function getSavedDeckKeys(): string[] {
  const deck = readDeck();
  return deck.length === DECK_SIZE ? deck : [];
}

export function initAppShell(startSinglePlayer: () => void): void {
  const $ = (id: string) => document.getElementById(id);
  const menu = $("main-menu");
  const game = $("game-shell");
  const collection = $("collection-screen");
  const settings = $("settings-panel");
  const settingsToggle = $("settings-toggle");
  let language: Language = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "ru";
  let deck = readDeck();

  function t(key: string): string { return words[language][key] || key; }
  function setText(id: string, key: string): void { const el = $(id); if (el) el.textContent = t(key); }
  function setMenuOptionText(id: string, key: string): void {
    const label = $(id)?.querySelector<HTMLElement>("span:nth-child(2)");
    if (label) label.textContent = t(key);
  }

  function applyLanguage(): void {
    document.documentElement.lang = language;
    setText("menu-eyebrow", "eyebrow");
    setText("menu-title", "title");
    setText("menu-subtitle", "subtitle");
    setMenuOptionText("menu-pvp", "pvp");
    setMenuOptionText("menu-single", "single");
    setMenuOptionText("menu-collection", "collection");
    setMenuOptionText("menu-progress", "progress");
    setMenuOptionText("menu-shop", "shop");
    setText("settings-title", "settings");
    setText("sound-label", "sound");
    setText("music-label", "music");
    setText("music-volume-label", "musicVolume");
    setText("language-label", "language");
    setText("collection-back", "back");
    setText("deck-title", "deckTitle");
    setText("library-title", "library");
    setText("deck-panel-title", "deck");
    setText("deck-hint", "deckHint");
    setText("deck-random", "starter");
    setText("deck-clear", "clear");
    setText("deck-save", "save");
    setText("game-menu", "back");
    setText("fullscreen-toggle", "fullscreen");
    setText("game-eyebrow", "gameEyebrow");
    setText("game-title", "title");
    setText("opponent-label", "opponent");
    setText("opponent-subtitle", "opponentSubtitle");
    setText("opponent-hand-label", "opponentHand");
    setText("own-time-label", "ownTime");
    setText("hand-hint", "handHint");
    setText("move-selected", "move");
    setText("return-selected", "return");
    setText("remove-selected", "remove");
    setText("sacrifice-selected", "sacrifice");
    setText("clear-board-selection", "boardClear");
    setText("new-game", "newGame");
    setText("play-selected", "play");
    setText("pass-turn", "pass");
    setText("hand-title", "hand");
    setText("log-title", "log");
    setText("tab-player-deck-label", "allCards");
    setText("tab-opponent-deck-label", "opponentCards");
    setText("details-title", "cardDetails");
    const search = $("deck-search") as HTMLInputElement | null;
    if (search) search.placeholder = t("search");
    const gameSearch = $("card-search") as HTMLInputElement | null;
    if (gameSearch) gameSearch.placeholder = t("searchLibrary");
    renderDeck();
  }

  function showScreen(screen: "menu" | "game" | "collection"): void {
    menu?.classList.toggle("screen-active", screen === "menu");
    game?.classList.toggle("screen-active", screen === "game");
    collection?.classList.toggle("screen-active", screen === "collection");
    settings?.classList.remove("open");
    settingsToggle?.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function countOf(key: string): number { return deck.filter(item => item === key).length; }

  function addCard(key: string): void {
    if (!(key in CARD_TYPES)) return;
    if (deck.length >= DECK_SIZE) { setStatus(t("deckFull")); return; }
    if (countOf(key) >= MAX_COPIES) { setStatus(t("copyLimit")); return; }
    deck.push(key);
    renderDeck();
  }

  function setStatus(message: string): void {
    const status = $("deck-status");
    if (status) status.textContent = message;
  }

  function renderDeck(): void {
    const deckList = $("deck-list");
    const libraryList = $("deck-library");
    if (!deckList || !libraryList) return;
    const query = (($("deck-search") as HTMLInputElement | null)?.value || "").trim().toLocaleLowerCase(language);
    const libraryNeedsRender = libraryList.dataset.query !== query
      || libraryList.dataset.language !== language
      || libraryList.children.length === 0;

    // Keep the 500-card library DOM stable while adding/removing cards from the deck.
    // Rebuilding it on every click reset focus/scroll and made all thumbnails jump.
    if (libraryNeedsRender) {
      const libraryScrollTop = libraryList.scrollTop;
      libraryList.replaceChildren();
      Object.values(CARD_TYPES)
        .filter(card => !query || (card.name + " " + card.description + " " + card.type).toLocaleLowerCase(language).includes(query))
        .forEach(card => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "builder-card";
          item.draggable = true;
          item.dataset.cardKey = card.key;
          item.appendChild(makeCardFace(card, true));
          item.addEventListener("click", () => addCard(card.key));
          item.addEventListener("dragstart", event => {
            event.dataTransfer?.setData("text/card-key", card.key);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
          });
          libraryList.appendChild(item);
        });
      libraryList.dataset.query = query;
      libraryList.dataset.language = language;
      libraryList.scrollTop = libraryScrollTop;
    }

    libraryList.querySelectorAll<HTMLButtonElement>(".builder-card").forEach(item => {
      const copies = countOf(item.dataset.cardKey || "");
      let badge = item.querySelector<HTMLElement>(".builder-count");
      if (copies && !badge) {
        badge = document.createElement("span");
        badge.className = "builder-count";
        item.appendChild(badge);
      }
      if (badge) {
        badge.textContent = copies ? String(copies) + "/" + MAX_COPIES : "";
        badge.hidden = copies === 0;
      }
    });

    deckList.replaceChildren();
    deck.forEach((key, index) => {
      const card = CARD_TYPES[key];
      if (!card) return;
      const item = document.createElement("button");
      item.type = "button";
      item.className = "deck-card";
      item.draggable = true;
      item.title = language === "ru" ? "Нажми, чтобы убрать из колоды" : "Click to remove from deck";
      const preview = makeCardFace(card, false);
      preview.classList.add("deck-card-preview");
      const info = document.createElement("span");
      info.className = "deck-card-info";
      const name = document.createElement("strong");
      name.className = "deck-card-name";
      name.textContent = card.name + " · " + card.cost + "с";
      const description = document.createElement("span");
      description.className = "deck-card-description";
      description.textContent = card.description;
      info.append(name, description);
      item.append(preview, info);
      item.addEventListener("click", () => { deck.splice(index, 1); renderDeck(); });
      item.addEventListener("dragstart", event => {
        event.dataTransfer?.setData("text/deck-index", String(index));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      deckList.appendChild(item);
    });

    const count = $("deck-count");
    if (count) count.textContent = deck.length + "/" + DECK_SIZE;
    const save = $("deck-save") as HTMLButtonElement | null;
    if (save) save.disabled = deck.length !== DECK_SIZE;
    if (deckList.children.length === 0) {
      const empty = document.createElement("p");
      empty.className = "deck-empty";
      empty.textContent = t("empty");
      deckList.appendChild(empty);
    }
  }

  $("menu-single")?.addEventListener("click", () => { showScreen("game"); startSinglePlayer(); });
  $("menu-pvp")?.addEventListener("click", () => window.alert(t("pvpSoon")));
  $("menu-progress")?.addEventListener("click", () => window.alert(t("progressSoon")));
  $("menu-shop")?.addEventListener("click", () => window.alert(t("shopSoon")));
  $("menu-collection")?.addEventListener("click", () => { deck = readDeck(); renderDeck(); showScreen("collection"); });
  $("game-menu")?.addEventListener("click", () => showScreen("menu"));
  $("collection-back")?.addEventListener("click", () => showScreen("menu"));
  $("deck-search")?.addEventListener("input", renderDeck);
  $("deck-library")?.addEventListener("dragover", event => event.preventDefault());
  $("deck-list")?.addEventListener("dragover", event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"; });
  $("deck-list")?.addEventListener("drop", event => {
    event.preventDefault();
    const key = event.dataTransfer?.getData("text/card-key");
    if (key) addCard(key);
  });
  $("deck-library")?.addEventListener("drop", event => {
    event.preventDefault();
    const index = Number(event.dataTransfer?.getData("text/deck-index"));
    if (Number.isInteger(index) && index >= 0 && index < deck.length) { deck.splice(index, 1); renderDeck(); }
  });
  $("deck-random")?.addEventListener("click", () => {
    deck = [...CARD_POOL].sort(() => Math.random() - .5).slice(0, DECK_SIZE);
    renderDeck();
  });
  $("deck-clear")?.addEventListener("click", () => { deck = []; renderDeck(); });
  $("deck-save")?.addEventListener("click", () => {
    if (deck.length !== DECK_SIZE) { setStatus(t("needsThirty")); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
    setStatus(t("saved"));
  });

  settingsToggle?.addEventListener("click", () => {
    const isOpen = settings?.classList.toggle("open") || false;
    settingsToggle.setAttribute("aria-expanded", String(isOpen));
  });
  $("language-select")?.addEventListener("change", event => {
    language = (event.target as HTMLSelectElement).value === "en" ? "en" : "ru";
    localStorage.setItem(LANGUAGE_KEY, language);
    applyLanguage();
  });
  ($("language-select") as HTMLSelectElement | null)?.setAttribute("value", language);
  if ($("language-select")) ($("language-select") as HTMLSelectElement).value = language;
  const musicVolume = $("music-volume") as HTMLInputElement | null;
  const musicVolumeValue = $("music-volume-value") as HTMLOutputElement | null;
  const savedMusicVolume = Math.max(0, Math.min(100, Number(localStorage.getItem(MUSIC_VOLUME_KEY) ?? "75") || 0));
  if (musicVolume) {
    musicVolume.value = String(savedMusicVolume);
    if (musicVolumeValue) musicVolumeValue.value = savedMusicVolume + "%";
    document.dispatchEvent(new CustomEvent("rift-music-volume-change", { detail: { volume: savedMusicVolume / 100 } }));
    musicVolume.addEventListener("input", () => {
      const value = Math.max(0, Math.min(100, Number(musicVolume.value) || 0));
      if (musicVolumeValue) musicVolumeValue.value = value + "%";
      localStorage.setItem(MUSIC_VOLUME_KEY, String(value));
      document.dispatchEvent(new CustomEvent("rift-music-volume-change", { detail: { volume: value / 100 } }));
    });
  }

  ["sound-toggle", "music-toggle"].forEach(id => {
    const input = $(id) as HTMLInputElement | null;
    if (!input) return;
    const key = id === "sound-toggle" ? SOUND_KEY : MUSIC_KEY;
    input.checked = localStorage.getItem(key) !== "off";
    input.addEventListener("change", () => { localStorage.setItem(key, input.checked ? "on" : "off"); if (id === "music-toggle") document.dispatchEvent(new CustomEvent("rift-music-change", { detail: { enabled: input.checked } })); });
  });

  document.addEventListener("keydown", event => { if (event.key === "Escape") { settings?.classList.remove("open"); settingsToggle?.setAttribute("aria-expanded", "false"); } });
  document.addEventListener("click", event => {
    if (!(event.target as Element).closest("#settings-panel, #settings-toggle")) {
      settings?.classList.remove("open");
      settingsToggle?.setAttribute("aria-expanded", "false");
    }
  });

  applyLanguage();
  showScreen("menu");
}
