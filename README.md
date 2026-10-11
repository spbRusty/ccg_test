# Временной разлом — прототип ККИ

Браузерная карточная игра на TypeScript и Vite. GitHub Actions собирает проект и публикует статическую версию на GitHub Pages.

## Локальный запуск

Требуется Node.js 20 или новее.

```bash
npm install
npm run dev
```

Vite выведет локальный адрес. Для production-сборки:

```bash
npm run build
npm run preview
```

Готовые файлы появляются в `dist/`. Папка `dist/` не хранится в Git: GitHub Actions собирает её при обновлении ветки `main` и публикует через GitHub Pages.

## Структура

- `src/main.ts` — игровая логика и интерфейс, перенесённые без намеренного изменения правил.
- `src/cards/card-data.ts` — генерация библиотеки из 500 карт.
- `src/cards/types.ts` — типы данных карт и перечень эффектов.
- `style.css` — стили интерфейса.
- `image2.avif` — графический ресурс карт.
- `vite.config.ts` — конфигурация сборки и путь GitHub Pages.

## Публикация

Workflow `.github/workflows/static.yml` устанавливает зависимости, собирает игру и публикует содержимое `dist/`. Для GitHub Pages Vite использует базовый URL `/ccg_test/`.
