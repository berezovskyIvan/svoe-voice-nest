# Зоя — голосовой помощник «Своё»

Бэкенд для демонстрационного клиента на Nuxt 4. Принимает текстовые и голосовые команды, составляет черновик заказа фермерских продуктов, анализирует траты за текущий месяц и предлагает вклад под 14% годовых на 6 месяцев. Заказ и вклад оформляются после явного подтверждения. Сценарии используют общий демо-счёт Екатерины без авторизации.

Стек — NestJS, TypeScript (ESM), PostgreSQL и TypeORM. SpeechKit распознаёт речь, YandexGPT определяет намерение и извлекает параметры команды.

## Локальный запуск

Понадобятся Node.js 24, Yarn Classic и Docker Compose для локальной PostgreSQL. Для загрузки аудиофайлов через HTTP установите `ffmpeg` с кодеком `libopus`.

```bash
yarn install --frozen-lockfile
cp -n .env.example .env
docker compose up -d --wait postgres
yarn build
yarn demo:seed
yarn start:dev
```

Перед отправкой текстовых и голосовых команд заполните `YC_FOLDER_ID` и `YC_API_KEY` в `.env`. Ключ сервисного аккаунта должен давать доступ к YandexGPT и SpeechKit.

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | Строка подключения к PostgreSQL. Значение из [`.env.example`](.env.example) подходит для Compose, где PostgreSQL доступен на `127.0.0.1:55432`. |
| `YC_FOLDER_ID`, `YC_API_KEY` | Каталог Yandex Cloud и ключ для YandexGPT. SpeechKit использует тот же API-ключ. |
| `HOST`, `PORT` | Адрес и порт API. По умолчанию `127.0.0.1:8080`. |
| `FRONTEND_ORIGIN` | Дополнительный origin Nuxt для HTTP и WebSocket, например `https://demo.example.com`. Адреса `http://localhost:3000` и `http://127.0.0.1:3000` уже разрешены. |

Swagger UI доступен на `http://127.0.0.1:8080/`, схема OpenAPI — на `/openapi.json`. Для запуска собранной версии выполните `yarn build` и `yarn start:prod` из корня проекта.

## API

| Метод и путь | Назначение |
| --- | --- |
| `POST /api/assistant/text` | Обработать JSON с полем `text`. [Контракт](docs/assistant-text.md) |
| `WS /api/assistant/voice` | Получать живую транскрипцию и результат команды. После события `ready` отправляйте моно PCM 16 кГц, signed 16-bit little-endian. [Контракт](docs/assistant-voice.md) |
| `POST /api/assistant/voice` | Загрузить запись WebM или MP4 в поле `file` запроса `multipart/form-data`. Ответ следует [исходному HTTP-контракту](docs/backend-spec-zoya.md). |
| `GET /api/actions/history` | Получить данные демо-пользователя, текущий баланс и историю. [Контракт](docs/actions-history.md) |
| `POST /api/actions/order` | Подтвердить заказ из корзины. [Контракт](docs/actions-order.md) |
| `POST /api/actions/deposit` | Подтвердить открытие демо-вклада. [Контракт](docs/actions-deposit.md) |
| `POST /api/actions/reset` | Вернуть стартовый баланс и историю, сохранив каталог и набор трат. |
| `GET /static/products/:filename` | Получить изображение товара, например `/static/products/1.webp`. |

Для формата Nuxt добавляйте `X-Zoya-Contract: nuxt` в запросы истории и текста. Для подтверждения заказа и вклада в формате Nuxt передавайте UUID в заголовке `Idempotency-Key`. При сетевом повторе используйте тот же UUID и то же тело запроса.

В `NUXT_PUBLIC_ZOYA_API_BASE` задайте origin бэкенда без `/api`. На HTTPS-стенде используйте HTTPS для API и WSS для голоса. Reverse proxy должен передавать `/api/*`, `/static/*` и WebSocket Upgrade. [Примеры запросов и интеграция с Nuxt](docs/README.md)

Пример запроса для проверки истории после запуска и заполнения базы.

```bash
curl -fsS -H 'X-Zoya-Contract: nuxt' http://127.0.0.1:8080/api/actions/history
```

## Демо-данные и проверки

- `yarn demo:seed` применяет миграции и заполняет базу стартовым счётом, историей, тратами текущего месяца и каталогом из 100 товаров. Повторный запуск сохраняет уже оформленные операции.
- `yarn demo:reset` восстанавливает стартовый баланс и историю, обновляет демо-траты на текущий месяц и сохраняет каталог. Выполняйте на выделенной демо-базе.
- `yarn test` запускает модульные тесты, `yarn test:e2e` — HTTP-тесты, `yarn test:cov` — модульные тесты с отчётом о покрытии.
- `yarn demo:smoke` проверяет OpenAPI, CORS, фотографии, текстовые сценарии и голосовые сессии без аудио. Текстовая проверка подтверждает заказ и вклад, поэтому запускайте её на свежей демо-базе. Для другого адреса передайте `SMOKE_API_URL`, для другого origin — `SMOKE_FRONTEND_ORIGIN`. Чтобы проверить распознавание речи, передайте путь к PCM-записи команды заказа в `SMOKE_AUDIO_PCM`. [Данные и проверка стенда](docs/foundation.md)
