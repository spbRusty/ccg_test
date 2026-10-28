export type Side = "player" | "enemy";
export type CardTarget = "opposite" | "left" | "right" | "adjacent" | "edge" | "all";
export type CardAction = "remove" | "bounce" | "shift" | "lock" | "spawn_token";
export type CardTrigger = "on_reveal" | "on_round_end" | "on_destroy";

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  text: string;
  target: CardTarget;
  action: CardAction;
  trigger: CardTrigger;
  faction: string;
  rarity: "Обычная" | "Редкая" | "Эпическая";
  art: number;
  token?: boolean;
}

const definitions: CardDef[] = [
  { id: "scout", name: "Разведчик", cost: 0, target: "opposite", action: "shift", trigger: "on_reveal", text: "При вскрытии: сдвинь карту напротив на соседний свободный слот.", faction: "Дозор", rarity: "Обычная", art: 1 },
  { id: "hook", name: "Крюк", cost: -2, target: "left", action: "remove", trigger: "on_reveal", text: "При вскрытии: убери карту в левом соседнем слоте врага.", faction: "Рейдеры", rarity: "Редкая", art: 2 },
  { id: "repulsor", name: "Отталкиватель", cost: -3, target: "opposite", action: "shift", trigger: "on_reveal", text: "При вскрытии: сдвинь карту напротив вправо, если слот свободен.", faction: "Технари", rarity: "Редкая", art: 3 },
  { id: "evacuation", name: "Эвакуация", cost: 1, target: "edge", action: "bounce", trigger: "on_reveal", text: "При вскрытии: верни карту врага с крайнего слота в руку владельца.", faction: "Караван", rarity: "Обычная", art: 1 },
  { id: "roadblock", name: "Завал", cost: -2, target: "opposite", action: "lock", trigger: "on_reveal", text: "При вскрытии: заблокируй слот напротив до конца раунда.", faction: "Технари", rarity: "Обычная", art: 2 },
  { id: "scrapper", name: "Разборщик", cost: -4, target: "opposite", action: "remove", trigger: "on_reveal", text: "При вскрытии: убери карту напротив.", faction: "Сборщики", rarity: "Эпическая", art: 3 },
  { id: "side-step", name: "Шаг в сторону", cost: 1, target: "left", action: "shift", trigger: "on_reveal", text: "При вскрытии: сдвинь карту врага в левом соседнем слоте ещё на один слот влево.", faction: "Дозор", rarity: "Обычная", art: 1 },
  { id: "shard-maker", name: "Осколочник", cost: -3, target: "right", action: "spawn_token", trigger: "on_reveal", text: "При вскрытии: создай Осколок в правом соседнем слоте.", faction: "Технари", rarity: "Редкая", art: 2 },
  { id: "sweeper", name: "Зачистка", cost: -5, target: "edge", action: "remove", trigger: "on_reveal", text: "При вскрытии: убери карту врага на крайнем слоте.", faction: "Рейдеры", rarity: "Эпическая", art: 3 },
  { id: "recall", name: "Отзыв", cost: 2, target: "opposite", action: "bounce", trigger: "on_reveal", text: "При вскрытии: верни карту напротив в руку владельца.", faction: "Караван", rarity: "Редкая", art: 1 },
  { id: "jammer", name: "Глушитель", cost: -2, target: "adjacent", action: "lock", trigger: "on_reveal", text: "При вскрытии: заблокируй соседние слоты врага до конца раунда.", faction: "Технари", rarity: "Редкая", art: 2 },
  { id: "mirror", name: "Зеркальный манёвр", cost: 0, target: "opposite", action: "shift", trigger: "on_reveal", text: "При вскрытии: сдвинь карту напротив влево или вправо в свободный слот.", faction: "Дозор", rarity: "Обычная", art: 3 },
  { id: "corner-guard", name: "Страж края", cost: 2, target: "edge", action: "lock", trigger: "on_reveal", text: "При вскрытии: заблокируй соответствующий крайний слот врага.", faction: "Дозор", rarity: "Обычная", art: 1 },
  { id: "token-seed", name: "Семя осколка", cost: -1, target: "adjacent", action: "spawn_token", trigger: "on_reveal", text: "При вскрытии: создай Осколок в соседнем свободном слоте.", faction: "Медики", rarity: "Обычная", art: 2 },
  { id: "recycler", name: "Переработчик", cost: 1, target: "opposite", action: "bounce", trigger: "on_reveal", text: "При вскрытии: верни карту врага напротив в руку владельца.", faction: "Сборщики", rarity: "Редкая", art: 3 },
  { id: "bulwark", name: "Укрепление", cost: -3, target: "adjacent", action: "lock", trigger: "on_round_end", text: "В конце раунда заблокируй соседние слоты врага на следующий раунд.", faction: "Технари", rarity: "Редкая", art: 1 },
  { id: "undertow", name: "Обратное течение", cost: 0, target: "all", action: "shift", trigger: "on_round_end", text: "В конце раунда сдвинь одну карту врага к ближайшему свободному слоту.", faction: "Караван", rarity: "Редкая", art: 2 },
  { id: "afterimage", name: "Послесвечение", cost: 1, target: "adjacent", action: "spawn_token", trigger: "on_destroy", text: "Когда эту карту убирают, создай Осколок в соседнем свободном слоте.", faction: "Легенды", rarity: "Эпическая", art: 3 },
  { id: "glass-cannon", name: "Хрупкий заслон", cost: -6, target: "opposite", action: "remove", trigger: "on_reveal", text: "При вскрытии: убери карту напротив. Стоимость высока, но эффект немедленный.", faction: "Рейдеры", rarity: "Эпическая", art: 1 },
  { id: "free-shard", name: "Бесплатный осколок", cost: 0, target: "left", action: "spawn_token", trigger: "on_reveal", text: "При вскрытии: создай Осколок слева, если слот свободен.", faction: "Технари", rarity: "Обычная", art: 2 },
  { id: "medic", name: "Полевой медик", cost: 3, target: "opposite", action: "bounce", trigger: "on_reveal", text: "При вскрытии: верни карту врага напротив в руку владельца.", faction: "Медики", rarity: "Обычная", art: 3 },
  { id: "locksmith", name: "Слесарь", cost: -4, target: "opposite", action: "lock", trigger: "on_reveal", text: "При вскрытии: заблокируй слот напротив и не дай ему участвовать в залпе.", faction: "Сборщики", rarity: "Редкая", art: 1 },
  { id: "flanker", name: "Обходчик", cost: -2, target: "right", action: "remove", trigger: "on_reveal", text: "При вскрытии: убери карту в правом соседнем слоте врага.", faction: "Рейдеры", rarity: "Обычная", art: 2 },
  { id: "shifter", name: "Перестановщик", cost: 2, target: "all", action: "shift", trigger: "on_reveal", text: "При вскрытии: сдвинь карту напротив в любой свободный соседний слот.", faction: "Дозор", rarity: "Редкая", art: 3 },
  { id: "cornerstone", name: "Краеугольный", cost: -1, target: "edge", action: "spawn_token", trigger: "on_reveal", text: "При вскрытии на краю: создай Осколок в соседнем слоте.", faction: "Легенды", rarity: "Эпическая", art: 1 },
  { id: "retreat", name: "Отступление", cost: 4, target: "opposite", action: "bounce", trigger: "on_round_end", text: "В конце раунда верни карту врага напротив в руку владельца.", faction: "Караван", rarity: "Редкая", art: 2 },
  { id: "sentry", name: "Часовой", cost: -2, target: "opposite", action: "lock", trigger: "on_reveal", text: "При вскрытии: блокируй слот напротив до конца раунда.", faction: "Дозор", rarity: "Обычная", art: 3 },
  { id: "needle", name: "Игла", cost: -1, target: "opposite", action: "shift", trigger: "on_reveal", text: "При вскрытии: сдвинь карту напротив влево, если там свободно.", faction: "Рейдеры", rarity: "Обычная", art: 1 },
  { id: "tether", name: "Привязь", cost: 2, target: "adjacent", action: "bounce", trigger: "on_reveal", text: "При вскрытии: верни соседнюю карту врага в руку владельца.", faction: "Технари", rarity: "Редкая", art: 2 },
  { id: "fracture", name: "Трещина", cost: -7, target: "all", action: "remove", trigger: "on_reveal", text: "При вскрытии: убери карту напротив; на пустом месте сработает базовое восстановление.", faction: "Легенды", rarity: "Эпическая", art: 3 },
  { id: "echo", name: "Эхо", cost: 0, target: "adjacent", action: "spawn_token", trigger: "on_destroy", text: "Когда эту карту убирают, оставь Осколок на соседнем свободном слоте.", faction: "Легенды", rarity: "Эпическая", art: 1 },
  { id: "token", name: "Осколок", cost: 0, target: "all", action: "shift", trigger: "on_reveal", text: "Токен без эффекта. Занимает слот и участвует в залпе стола.", faction: "Токены", rarity: "Обычная", art: 2, token: true }
];

export const CARDS: CardDef[] = definitions;
export const CARD_BY_ID = new Map(CARDS.map(card => [card.id, card]));
export const DEFAULT_DECK = [
  "scout", "hook", "repulsor", "evacuation", "roadblock", "scrapper", "side-step",
  "shard-maker", "sweeper", "recall", "jammer", "mirror", "corner-guard", "token-seed"
];
