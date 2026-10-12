# Временной разлом — прототип ККИ

Браузерная карточная игра на TypeScript и Vite. GitHub Actions собирает проект и публикует статическую версию на GitHub Pages.

## Локальный запуск

Требуется Node.js 22 или новее.

```bash
npm install
npm run dev
```

Vite выведет локальный адрес. Перед сборкой автоматически выполняются проверка TypeScript и тесты библиотеки карт, фабрики колод, создания игрока и игровых эффектов. Отдельно их можно запустить командами `npm run check` и `npm test`.

Для production-сборки:

```bash
npm run build
npm run preview
```

Готовые файлы появляются в `dist/`. Папка `dist/` не хранится в Git: GitHub Actions собирает её при обновлении ветки `main` и публикует через GitHub Pages.

## Аудит баланса карт

Команда `npm run balance:audit` оценивает все 500 карт в одном фиксированном эталонном состоянии и создаёт `reports/card-balance-audit.csv` и `reports/card-balance-audit.md`. В CSV есть текущая цена, ориентировочная ценность, экспериментальная цена-кандидат и флаги риска. Цены в `src/cards/card-data.ts` команда не меняет: оценки для контекстных и утилитарных эффектов — только эвристика, не подтверждённый баланс. Генератор запускается и в CI.

Для первичного прогона AI-vs-AI используйте `npm run balance:simulate -- 1000 1` (число матчей и стартовый seed). Команда создаёт `reports/card-balance-simulation.csv` и `reports/card-balance-simulation.md`. Симулятор использует текущие правила эффектов и текущую оценку AI, ограничивает матч 100 ходами и отдельно считает партии, дошедшие до лимита. Это проверка экономики и перекоса первого хода, а не замена тестам с людьми.

## Структура

- `src/main.ts` — запуск игры, состояние партии, ходы и обработчики событий.
- `src/cards/card-data.ts` — генерация библиотеки из 500 карт.
- `src/cards/types.ts` — типы данных карт и перечень эффектов.
- `src/ui/card-face.ts` — отрисовка лицевой стороны карты.
- `src/ui/collection.ts` — коллекция, фильтрация и просмотр подробностей карт.
- `src/game/player.ts` — создание игроков и перемешивание колод.
- `src/ai/scoring.ts` — оценка карт для AI.
- `src/effects/apply-effect.ts` — обработчики игровых эффектов.
- `src/cards/card-data.test.ts` — проверки библиотеки карт и создания игроков.
- `src/effects/apply-effect.test.ts` — регрессионные тесты игровых эффектов.
- `src/balance/card-value.ts` — эвристическая оценка ценности и флаги риска.
- `src/balance/card-value.test.ts` — тесты аудита библиотеки.
- `src/balance/simulator.ts` — воспроизводимый AI-vs-AI симулятор.
- `src/balance/simulator.test.ts` — тесты воспроизводимости симуляций.
- `scripts/balance-audit.mjs` — генерация CSV и Markdown-отчёта по картам.
- `scripts/balance-simulate.mjs` — генерация отчёта по серии матчей.
- `style.css` — стили интерфейса.
- `image2.avif` — графический ресурс карт.
- `vite.config.ts` — конфигурация сборки и путь GitHub Pages.

## Настройка GitHub Pages

Один раз открой в репозитории **Settings → Pages → Build and deployment → Source** и выбери **GitHub Actions**. Это отключит автоматическую публикацию исходников из ветки `main` через Jekyll и оставит публикацию собранной папки `dist/` из workflow.

После этого каждый push в `main` будет запускать проверку типов, тесты и production-сборку, а затем публиковать игру.

## Публикация

Workflow `.github/workflows/static.yml` устанавливает зависимости, собирает игру и публикует содержимое `dist/`. Для GitHub Pages Vite использует базовый URL `/ccg_test/`.
