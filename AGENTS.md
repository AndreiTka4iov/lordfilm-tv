# LordFilm TV

## Область и архитектура

- Next.js App Router + strict TypeScript. Тонкие маршруты в `src/app`.
- FSD: `app/core → views → widgets → features → entities → shared`. `core` — только инициализация и провайдеры, не бизнес-логика.
- `views` соответствует pages-слою FSD и не конфликтует с Next.js Pages Router.
- Между слайсами одного слоя импортов нет. Внешние импорты — через публичный `index.ts`; внутри слайса — относительные импорты. `app` и `core` — один уровень композиции, без циклов.
- Создавать сегменты `ui/model/api/lib/config` только когда есть содержимое. Не создавать пустые абстракции.
- Перед реализацией искать существующие компоненты и логику.

## SOLID

- SRP: отдельно отображение, состояние, бизнес-правила, транспорт и воспроизведение.
- OCP: расширение через композицию и узкие контракты, без механизмов для гипотетических требований.
- LSP: адаптеры сохраняют семантику ошибок и результатов контракта.
- ISP: небольшие props и интерфейсы по потребителям.
- DIP: бизнес-логика зависит от контрактов; внешние реализации подключаются на уровне композиции. Не создавать контейнер DI без необходимости.

## UI

- Mantine — первый выбор. Стандартные props, затем Tailwind для состояний и адаптивности.
- Без собственных CSS Modules, SCSS, inline `style/styles/sx`. `src/styles/globals.css` — только инфраструктура слоёв и Tailwind.
- Цвета/типографика — через тему. Не переопределять одно свойство одновременно Mantine props и Tailwind.
- Видимый фокус обязателен. При реализации TV-навигации проверять стрелки, OK, Back и возврат фокуса на реальной приставке.
- Все пользовательские тексты — в `shared/locales`; начальная локаль ru.

## Безопасность и проверки

- Не добавлять секреты, персональные настройки и код сторонних закрытых проектов.
- Ввод и внешние данные проверять на границе. Не использовать `any`, `@ts-ignore` и произвольный HTML.
- Проверять совместимость server/standalone и static export. Пока обязательны оба режима.
- Никаких Route Handlers/Server Actions в export-сборке. API живёт отдельно в `server/`.
- `npm run check`, `npm run build`, `npm run build:export`. При изменении Docker проверять config и затронутые сборки.
- Не делать push/deploy без запроса. Не устанавливать приложение на устройство без запроса.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## API

- Контракт — `postman/specs/catalog.openapi.json`, примеры запросов — `postman/collections/`.
- При изменении API синхронизировать контракт, адаптер, клиентскую валидацию и HTTP-тесты.
- `npm run test:api` должен работать без живого источника и внешних аккаунтов.
- Не добавлять произвольный URL-прокси, исполнение скриптов источника или кеширование видеопотоков.
