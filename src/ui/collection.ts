import { CARD_TYPES } from "../cards/card-data";
import { makeCardFace } from "./card-face";
import type { CardInstance, PlayerKey, PlayerState } from "../cards/types";

export type CollectionMode = "player" | "opponent";

interface CollectionUIContext {
  getPlayers: () => Record<PlayerKey, PlayerState>;
  getMode: () => CollectionMode;
  $: (id: string) => HTMLElement | null;
}

export function createCollectionUI(context: CollectionUIContext) {
  const $ = context.$;

  function groupedCards(cards: CardInstance[]) {
    const groups = new Map<string, { card: CardInstance; count: number }>();
    cards.forEach((card) => {
      if (!groups.has(card.key)) groups.set(card.key, { card, count: 0 });
      groups.get(card.key)!.count += 1;
    });
    return Array.from(groups.values()).sort((a, b) => a.card.name.localeCompare(b.card.name, "ru"));
  }

  function renderCollection() {
    const players = context.getPlayers();
    const collectionMode = context.getMode();
    const list = $("collection-list");
    if (!list) return;
    $("tab-player-deck")?.classList.toggle("active", collectionMode === "player");
    $("tab-player-deck")?.setAttribute("aria-selected", String(collectionMode === "player"));
    $("tab-opponent-deck")?.classList.toggle("active", collectionMode === "opponent");
    $("tab-opponent-deck")?.setAttribute("aria-selected", String(collectionMode === "opponent"));
    list.replaceChildren();

    const playerCards = players.player.deck;
    const playerCount = $("player-collection-count");
    const opponentCount = $("opponent-collection-count");
    if (playerCount) playerCount.textContent = String(playerCards.length);
    if (opponentCount) opponentCount.textContent = String(players.opponent.played.length);

    const allCards = collectionMode === "player" ? playerCards : players.opponent.played;
    const query = (($("card-search") as HTMLInputElement | null)?.value || "").trim().toLocaleLowerCase("ru");
    const cards = query
      ? allCards.filter((card) => (card.name + " " + card.description + " " + card.type).toLocaleLowerCase("ru").includes(query))
      : allCards;
    const groups = groupedCards(cards);

    if (!groups.length) {
      const empty = document.createElement("p");
      empty.className = "collection-empty";
      empty.textContent = collectionMode === "player"
        ? "В колоде больше не осталось карт."
        : "Противник ещё не разыграл ни одной карты.";
      list.appendChild(empty);
      return;
    }

    groups.forEach(({ card, count }) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "collection-card";
      item.dataset.cardKey = card.key;
      item.appendChild(makeCardFace(card, false));
      const badge = document.createElement("span");
      badge.className = "collection-count";
      badge.textContent = "×" + count;
      badge.setAttribute("aria-label", count + " шт.");
      item.appendChild(badge);
      item.addEventListener("mouseenter", () => showCardDetails(card.key));
      item.addEventListener("focus", () => showCardDetails(card.key));
      list.appendChild(item);
    });
  }

  function showCardDetails(key: string) {
    const card = CARD_TYPES[key];
    const content = $("card-details-content");
    if (!card || !content) return;
    content.replaceChildren();

    const preview = makeCardFace(card, true);
    preview.classList.add("details-card-preview");
    preview.setAttribute("aria-label", card.name + ". " + card.description + " Стоимость: " + card.cost + " секунд.");

    const category = document.createElement("p");
    category.className = "details-category";
    category.textContent = "Стоимость розыгрыша: " + card.cost + " сек.";

    const effect = document.createElement("div");
    effect.className = "details-stats";
    const stat = document.createElement("span");
    stat.className = "details-stat";
    stat.textContent = "Сила эффекта: " + card.amount;
    effect.appendChild(stat);

    content.append(preview, category, effect);
  }

  return { renderCollection, showCardDetails };
}
