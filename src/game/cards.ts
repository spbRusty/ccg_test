export type Side = "player" | "enemy";
export type Effect = {
  kind:
    | "damage" | "heal" | "draw" | "remove" | "return" | "boost" | "delay"
    | "own-count" | "enemy-count" | "transfer" | "guard" | "own-heal"
    | "curse" | "payoff";
  amount: number;
  min?: number;
};
export interface CardDef { id: string; name: string; cost: number; text: string; timing: "play" | "end"; effect: Effect }

const c = (
  id: string,
  name: string,
  cost: number,
  text: string,
  timing: "play" | "end",
  kind: Effect["kind"],
  amount: number,
  min?: number,
): CardDef => ({ id, name, cost, text, timing, effect: min === undefined ? { kind, amount } : { kind, amount, min } });

/**
 * Repeating cards ("В конце хода") tick every round, so they are priced above their
 * per-round amount; one-shot cards are priced close to 1:1 so pure damage stays a fair
 * race and utility (removal, draw, guard) carries the tempo.
 */
export const CARDS: CardDef[] = [
  // --- End of turn (repeating value): cost ≈ 2× per-round amount ---
  c("dog", "Морозный пёс", 5, "В конце хода: −2 Стабильности врагу.", "end", "damage", 2),
  c("convoy", "Конвой", 6, "В конце хода: −3 Стабильности врагу.", "end", "damage", 3),
  c("camp", "Костровой", 7, "В конце хода: +3 Стабильности.", "end", "heal", 3),
  c("battery", "Старая батарея", 5, "В конце хода: +2 Стабильности.", "end", "heal", 2),
  c("quiet", "Тихий час", 3, "В конце хода: +1 Стабильности.", "end", "heal", 1),
  c("watch", "Долгий дозор", 6, "В конце хода: −2 врагу и +2 тебе.", "end", "transfer", 2),
  c("tower", "Дозорная вышка", 4, "В конце хода: −1 врагу за каждую твою карту на поле.", "end", "own-count", 1),
  c("hunger", "Голод", 4, "В конце хода: −1 врагу за каждую его карту на поле.", "end", "enemy-count", 1),
  c("kitchen", "Полевая кухня", 5, "В конце хода: +1 Стабильности за каждую твою карту на поле.", "end", "own-heal", 1),
  c("sleeper", "Спящий агент", 3, "В конце хода: −1 Стабильности врагу.", "end", "damage", 1),

  // --- On play (utility + tempo): cost ≈ effect ---
  c("raid", "Облава", 3, "При розыгрыше: −3 Стабильности врагу.", "play", "damage", 3),
  c("sniper", "Снайпер", 4, "При розыгрыше: −4 Стабильности врагу.", "play", "damage", 4),
  c("blackout", "Затемнение", 5, "При розыгрыше: −5 Стабильности врагу.", "play", "damage", 5),
  c("ambush", "Засада", 2, "При розыгрыше: −2 Стабильности врагу.", "play", "damage", 2),
  c("medic", "Полевой медик", 3, "При розыгрыше: +3 Стабильности.", "play", "heal", 3),
  c("ration", "Сухой паёк", 2, "При розыгрыше: +2 Стабильности.", "play", "heal", 2),
  c("hope", "Последняя надежда", 5, "При розыгрыше: +5 Стабильности.", "play", "heal", 5),
  c("mediator", "Посредник", 4, "При розыгрыше: перенеси 2 Стабильности от врага к себе.", "play", "transfer", 2),
  c("saboteur", "Диверсант", 4, "При розыгрыше: сними старую карту врага.", "play", "remove", 1),
  c("cleaner", "Чистильщик", 6, "При розыгрыше: сними до 2 старых карт врага.", "play", "remove", 2),
  c("scavenger", "Сборщик", 2, "При розыгрыше: возьми 1 карту.", "play", "draw", 1),
  c("map", "Старая карта", 1, "При розыгрыше: возьми 1 карту.", "play", "draw", 1),
  c("reserves", "Резерв", 3, "При розыгрыше: возьми 2 карты.", "play", "draw", 2),
  c("signal", "Сигнальщик", 2, "При розыгрыше: усили следующую карту на +2.", "play", "boost", 2),
  c("charge", "Отложенный заряд", 3, "При розыгрыше: в следующем раунде враг потеряет 4.", "play", "delay", 4),
  c("recall", "Отзыв", 2, "При розыгрыше: верни старую свою карту с поля в руку.", "play", "return", 1),
  c("barrier", "Живая преграда", 3, "Со следующего раунда: поглощает следующий удар по тебе, затем уходит.", "end", "guard", 1),
  c("toll", "Плата за проход", 3, "При розыгрыше: −1 врагу за каждую его карту на поле.", "play", "enemy-count", 1),

  // --- Conditional / debuff (new mechanics) ---
  c("curse", "Проклятие", 3, "При розыгрыше: враг не восстанавливает Стабильность в этом раунде.", "play", "curse", 1),
  c("payoff", "Отчаянный бросок", 3, "При розыгрыше: −3 врагу. Если твоя Стабильность ниже 8, то −6.", "play", "payoff", 3),
  c("surge", "Натиск", 4, "При розыгрыше: −1 врагу за каждую твою карту на поле.", "play", "own-count", 1),
];
