# Временной разлом — прототип ККИ

Браузерная карточная игра на TypeScript и Vite. GitHub Actions собирает проект и публикует статическую версию на GitHub Pages.

## Локальный запуск

Требуется Node.js 20 или новее.

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
- `style.css` — стили интерфейса.
- `image2.avif` — графический ресурс карт.
- `vite.config.ts` — конфигурация сборки и путь GitHub Pages.

## Настройка GitHub Pages

Один раз открой в репозитории **Settings → Pages → Build and deployment → Source** и выбери **GitHub Actions**. Это отключит автоматическую публикацию исходников из ветки `main` через Jekyll и оставит публикацию собранной папки `dist/` из workflow.

После этого каждый push в `main` будет запускать проверку типов, тесты и production-сборку, а затем публиковать игру.

## Публикация

Workflow `.github/workflows/static.yml` устанавливает зависимости, собирает игру и публикует содержимое `dist/`. Для GitHub Pages Vite использует базовый URL `/ccg_test/`.
