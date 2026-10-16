export type Side = "player" | "enemy";
export type Effect = {
  kind:
    | "damage" | "heal" | "draw" | "remove" | "return" | "boost" | "delay"
    | "own-count" | "enemy-count" | "transfer" | "guard" | "own-heal"
    | "curse" | "payoff" | "total-count" | "hand-count" | "enemy-hand-count"
    | "if-own-more" | "if-own-less" | "enemy-played-more" | "enemy-played-less"
    | "own-played-more" | "own-played-less" | "if-enemy-stability-low" | "if-own-stability-low";
  amount: number;
  min?: number;
  threshold?: number;
};
export interface CardDef { id: string; name: string; cost: number; text: string; timing: "start" | "play" | "end"; effect: Effect }

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

// Deterministic collection expansion: 31 curated + 469 generated = 500 unique cards.
// The generated pool is tuned so a random 30-card deck always carries enough raw
// offense to close a duel in ~5-6 rounds: direct damage dominates with amount 3-5
// (cost ≈ damage), pressure/scaling cards replace dead conditionals, and heals or
// guards stay a minority so they cannot offset the damage density.
const adjectives = ["Пыльный","Стальной","Соляной","Ржавый","Сумеречный","Бункерный","Заражённый","Кочевой","Искристый","Забытый","Подземный","Пепельный","Северный","Радиоактивный","Теневой","Механический","Бродячий","Закалённый","Сломанный","Последний"];
const nouns = ["Мародёр","Хранитель","Механик","Следопыт","Синоптик","Диверсант","Сборщик","Проводник","Сапёр","Курьер","Шаман","Картограф","Снайпер","Разведчик","Ремонтник","Техник","Контрабандист","Страж","Охотник","Архивариус","Паразит","Смотритель","Дрон","Киборг","Рейдер","Сталкер","Доктор","Фанатик","Переговорщик","Инженер"];
type GeneratedKind = Effect["kind"];

// Weighted kind table (weights sum to 101): offense dominates, pure conditionals
// are a rare garnish so they never crowd a random hand.
const kindWeights: Array<[GeneratedKind, number]> = [
  ["damage", 37], ["transfer", 6], ["delay", 5], ["payoff", 4],
  ["own-count", 3], ["enemy-count", 3], ["enemy-hand-count", 2], ["total-count", 2],
  ["heal", 11], ["own-heal", 1], ["guard", 2],
  ["draw", 5], ["remove", 2], ["return", 2], ["boost", 5], ["curse", 2],
  ["hand-count", 1], ["if-own-more", 1], ["if-own-less", 1],
  ["enemy-played-more", 1], ["enemy-played-less", 1],
  ["own-played-more", 1], ["own-played-less", 1],
  ["if-enemy-stability-low", 1], ["if-own-stability-low", 1],
];
const kindPattern: GeneratedKind[] = kindWeights.flatMap(([kind, weight]) =>
  Array.from({ length: weight }, () => kind),
);
const describeGenerated = (kind: GeneratedKind, a: number, n: number): string => ({
  damage: `При розыгрыше: враг теряет ${a} Стабильности.`,
  heal: `При розыгрыше: восстанови ${a} Стабильности.`,
  transfer: `При розыгрыше: перенеси ${a} Стабильности от врага к себе.`,
  draw: `При розыгрыше: возьми ${a} карту(ы).`,
  remove: `При розыгрыше: уничтожь ${a} старую карту противника.`,
  return: `При розыгрыше: верни ${a} старую карту с поля в руку.`,
  boost: `Следующая карта в этом раунде получает +${a} к эффекту.`,
  delay: `В начале следующего раунда враг теряет ${a} Стабильности.`,
  "own-count": `Враг теряет ${a} Стабильности за каждую твою карту на поле.`,
  "enemy-count": `Враг теряет ${a} Стабильности за каждую свою карту на поле.`,
  "own-heal": `Восстанови ${a} Стабильности за каждую свою карту на поле.`,
  guard: "Поглощает первый входящий удар в следующем раунде.",
  curse: "В этом раунде противник не может восстановить Стабильность.",
  payoff: `Враг теряет ${a}; если твоя Стабильность ниже ${n * 5}, урон удваивается.`,
  "total-count": `Враг теряет ${a} за каждую карту на обоих полях.`,
  "hand-count": `Восстанови ${a} Стабильности за каждую карту в твоей руке.`,
  "enemy-hand-count": `Враг теряет ${a} за каждую карту в его руке.`,
  "if-own-more": `Если на твоём поле больше карт, враг теряет ${a} Стабильности.`,
  "if-own-less": `Если на твоём поле меньше карт, враг теряет ${a} Стабильности.`,
  "enemy-played-more": `Если в этом раунде противник разыграл больше ${n} карт, он теряет ${a} Стабильности.`,
  "enemy-played-less": `Если в этом раунде противник разыграл меньше ${n} карт, он теряет ${a} Стабильности.`,
  "own-played-more": `Если ты разыграл больше ${n} карт в этом раунде, враг теряет ${a} Стабильности.`,
  "own-played-less": `Если ты разыграл меньше ${n} карт в этом раунде, враг теряет ${a} Стабильности.`,
  "if-enemy-stability-low": `Если у врага не больше ${n * 5} Стабильности, он теряет ещё ${a}.`,
  "if-own-stability-low": `Если у тебя не больше ${n * 5} Стабильности, восстанови ${a}.`
} as Record<GeneratedKind,string>)[kind];

const genValue = (kind: GeneratedKind, amount: number, timing: CardDef["timing"]): number => {
  const a = amount;
  const end = timing === "end";
  switch (kind) {
    case "damage": return end ? a * 2.5 : a;
    case "heal": return end ? a * 2.5 : a * 0.9;
    case "transfer": return end ? a * 3 : a * 2;
    case "own-count": case "enemy-count": return a * 1.5;
    case "own-heal": return end ? a * 3 : a * 1.6;
    case "total-count": case "enemy-hand-count": return a * 2;
    case "hand-count": return a * 1.6;
    case "draw": return a * 2.2;
    case "remove": return a * 3.5;
    case "return": return a * 1.6;
    case "boost": return a * 1.4;
    case "delay": return a * 0.8;
    case "guard": return 3.2;
    case "curse": return 3.5;
    case "payoff": return a * 1.5;
    default: return a * 1.5;
  }
};

const openingKinds: GeneratedKind[] = ["damage","heal","transfer","draw","boost","delay","hand-count","enemy-hand-count"];
const repeatKinds: GeneratedKind[] = ["damage","heal","own-count","enemy-count","own-heal","guard"];

const generatedAmount = (kind: GeneratedKind, i: number, timing: CardDef["timing"]): number => {
  switch (kind) {
    case "damage": return timing === "end" ? 2 + (i % 2) : 3 + (i % 3);
    case "heal": return timing === "end" ? 1 + (i % 3) : 2 + (i % 3);
    case "transfer": return 2 + (i % 2);
    case "delay": return 3 + (i % 3);
    case "payoff": return 3 + (i % 2);
    case "boost": return 2 + (i % 2);
    case "draw": case "remove": case "return": return 1 + (i % 2);
    case "guard": case "curse": return 1;
    case "own-count": case "enemy-count": case "own-heal":
    case "total-count": case "enemy-hand-count": case "hand-count":
      return 1 + (i % 2);
    default: return 2 + (i % 2);
  }
};

for (let i = 0; i < 469; i++) {
  const negative = i % 37 === 0 || i % 17 === 0;
  const kind: GeneratedKind = negative
    ? (["heal","damage","draw","boost"][i % 4] as GeneratedKind)
    : kindPattern[i % kindPattern.length];
  const opening = openingKinds.includes(kind);
  const repeating = repeatKinds.includes(kind);
  let timing: CardDef["timing"] = "play";
  if (negative) timing = "play";
  else if (kind === "guard") timing = "end";
  else if (opening && i % 31 === 7) timing = "start";
  else if (repeating && i % 4 === 0) timing = "end";
  const amount = negative ? 1 : generatedAmount(kind, i, timing);
  const cost = negative ? (i % 37 === 0 ? -2 : -1) : Math.max(1, Math.round(genValue(kind, amount, timing)));
  const baseThreshold = 1 + (i % 3);
  const isLow = kind.endsWith("low");
  const isLess = kind.includes("less");
  const isMore = kind.includes("more");
  const threshold = isLow ? baseThreshold * 5 : isLess ? 2 : isMore ? 1 : baseThreshold;
  const name = adjectives[i % adjectives.length] + " " + nouns[Math.floor(i / adjectives.length) % nouns.length];
  const id = "gen_" + String(i + 1).padStart(3, "0");
  const description = describeGenerated(kind, amount, isMore || isLess ? threshold : baseThreshold);
  const text = timing === "start" ? "В начале игры: " + description.replace(/^При розыгрыше: /, "") : description;
  const effect: Effect = {
    kind,
    amount,
    ...(kind === "payoff" ? { min: baseThreshold * 5 } : {}),
    ...(isMore || isLess || isLow ? { threshold } : {}),
  };
  CARDS.push({ id, name, cost, text, timing, effect });
}

