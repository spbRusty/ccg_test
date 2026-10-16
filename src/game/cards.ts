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

// Deterministic collection expansion: 30 original + 470 unique cards.
const adjectives = ["Пыльный","Стальной","Соляной","Ржавый","Сумеречный","Бункерный","Заражённый","Кочевой","Искристый","Забытый","Подземный","Пепельный","Северный","Радиоактивный","Теневой","Механический","Бродячий","Закалённый","Сломанный","Последний"];
const nouns = ["Мародёр","Хранитель","Механик","Следопыт","Синоптик","Диверсант","Сборщик","Проводник","Сапёр","Курьер","Шаман","Картограф","Снайпер","Разведчик","Ремонтник","Техник","Контрабандист","Страж","Охотник","Архивариус","Паразит","Смотритель","Дрон","Киборг","Рейдер","Сталкер","Доктор","Фанатик","Переговорщик","Инженер"];
type GeneratedKind = Effect["kind"];
const kinds: GeneratedKind[] = ["damage","heal","transfer","draw","remove","return","boost","delay","own-count","enemy-count","own-heal","guard","curse","payoff","total-count","hand-count","enemy-hand-count","if-own-more","if-own-less","enemy-played-more","enemy-played-less","own-played-more","own-played-less","if-enemy-stability-low","if-own-stability-low"];
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
for (let i=0;i<469;i++) {
  const kind=kinds[i%kinds.length], threshold=1+(i%3);
  const baseCost=i%37===0?-2:i%17===0?-1:1+(i%6);
  const openingKind=["damage","heal","transfer","draw","boost","delay","hand-count","enemy-hand-count"].includes(kind);
  const repeatKind=["damage","heal","own-count","enemy-count","own-heal","guard"].includes(kind);
  const timing: CardDef["timing"]=baseCost>=0&&i%13===0&&openingKind?"start":baseCost<0||!repeatKind?"play":i%4===0?"end":"play";
  const cost=baseCost<0?baseCost:timing==="end"?Math.max(baseCost,["own-count","enemy-count","own-heal"].includes(kind)?5:4):kind==="total-count"?Math.max(baseCost,5):["hand-count","enemy-hand-count"].includes(kind)?Math.max(baseCost,4):["own-count","enemy-count","own-heal"].includes(kind)?Math.max(baseCost,3):baseCost;
  const amount=baseCost<0||timing==="end"||["own-count","enemy-count","own-heal","total-count","hand-count","enemy-hand-count"].includes(kind)?1:(["damage","heal","transfer","payoff","if-own-more","if-own-less","enemy-played-more","enemy-played-less","own-played-more","own-played-less","if-enemy-stability-low","if-own-stability-low"].includes(kind)?1+(i%3):(["draw","remove","return"].includes(kind)?1:(kind==="delay"?2+(i%3):1+(i%2))));
  const name=adjectives[i%adjectives.length]+" "+nouns[Math.floor(i/adjectives.length)%nouns.length];
  const id="gen_"+String(i+1).padStart(3,"0");
  const description=describeGenerated(kind,amount,threshold);
  const text=timing==="start"?"В начале игры: "+description.replace(/^При розыгрыше: /,""):description;
  const effect: Effect={kind,amount,...(kind==="payoff"?{min:threshold*5}:{}),...(kind.includes("more")||kind.includes("less")||kind.endsWith("low")?{threshold:kind.endsWith("low")?threshold*5:threshold}:{})};
  CARDS.push({id,name,cost,text,timing,effect});
}

