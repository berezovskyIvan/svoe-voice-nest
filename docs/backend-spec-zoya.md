# ТЗ Backend: Голосовой банковский ассистент «Зоя» (MVP)

## 1. Стек и окружение
* **Фреймворк:** NestJS (TypeScript), TypeORM, **PostgreSQL** (локально на ВМ).
* **Пакеты:** `@nestjs/serve-static`, `sharp` (ресайз/конвертация в WebP), `fluent-ffmpeg` (конвертация аудио в `oggopus`).
* **Системные зависимости на ВМ:** `ffmpeg` (`sudo apt install ffmpeg`).
* **Авторизация:** Отсутствует. Один зашитый тестовый пользователь (`id = 1`, Екатерина).
* **Переменные `.env`:**
  ```env
  DATABASE_URL="postgresql://user:password@localhost:5432/zoya_db"
  YC_FOLDER_ID="b1g5io2hntibmu8rtd6u"
  YC_API_KEY="секретный_api_ключ"
  ```

---

## 2. База данных (PostgreSQL) и Seed
Описать 4 таблицы в `schema.prisma` и вынести стартовое наполнение в функцию `seedDemoData()`:

1. **`accounts`**
   * Поля: `id`, `userName` («Екатерина»), `title` («Текущий счет»), `balance` (Int, стартово `1800000`).
2. **`products`** *(100 реальных товаров из каталога «Своё Родное»)*
   * Поля: `id`, `name`, `category`, `price` (Int), `unit` (шт/уп/кг), `imageUrl` (String).
   * **Изображения:** Спарсить 100 товаров со «Своё Родное». Скачать фото в `public/products/`, прогнать через `sharp` (ресайз `400x400px`, формат `.webp`, качество `80%`).
   * Раздавать `public` через `@nestjs/serve-static` с префиксом `/static` (в БД сохранять относительный путь `/static/products/1.webp`).
   * Папку `public/products/*.webp` закоммитить в Git (~3–4 МБ после сжатия).
3. **`transactions`**
   * Поля: `id`, `category`, `amount` (Int), `date` (DateTime).
   * *Seed:* Траты за текущий месяц, где «Кафе и рестораны» составляют ~48% от общей суммы, остальное — Супермаркеты, Транспорт, Аптеки.
4. **`assistant_history`**
   * Поля: `id`, `title`, `subtitle`, `amount` (Int, nullable), `type` (`market` | `analytics` | `transfer`), `createdAt`.
   * *Seed:* 4–5 стартовых записей (Перевод по СБП — 3 500 ₽, Оплата ЖКХ — 6 420 ₽, Аналитика трат за октябрь и т.д.).

---

## 3. Интеграция с Yandex Cloud (STT + LLM)

1. **Yandex SpeechKit (STT v1):**
   * Endpoint: `POST /speech/v1/stt:recognize?folderId=${YC_FOLDER_ID}&format=oggopus` (хост: `stt.api.cloud.yandex.net`).
   * Заголовок: `Authorization: Api-Key ${YC_API_KEY}`.
   * Входящее аудио из браузера (`.webm`/`.mp4`) конвертировать через `ffmpeg` в `ogg` (`libopus`).
   * **Защита от тишины:** Если STT вернул пустую строку или `< 2` символов — не вызывать LLM, сразу вернуть `{ "status": "error", "message": "Не расслышал. Повторите, пожалуйста" }`.

2. **YandexGPT (`yandexgpt-lite`):**
   * Endpoint: `POST /foundationModels/v1/completion` (хост: `llm.api.cloud.yandex.net`).
   * Заголовки: `Authorization: Api-Key ${YC_API_KEY}`, `x-folder-id: ${YC_FOLDER_ID}`.
   * Модель: `gpt://${YC_FOLDER_ID}/yandexgpt-lite/latest`, `"jsonObject": true`, `"temperature": 0.1`.
   * В системный промпт передавать текущую дату сервера (`new Date()`) для расчета дат доставки («завтра», «в субботу») и требовать JSON:
     `{ "intent": "market" | "analytics" | "unknown", "keywords": ["молоко", "творог"], "deliveryDate": "Суббота, 21 ноября", "deliverySlot": "09:00 - 12:00" }`.

---

## 4. API-эндпоинты (2 контроллера, 6 роутов)

### Контроллер 1: `AssistantController` (`/api/assistant`)

* **`POST /api/assistant/voice`**
  * Вход: `multipart/form-data`, поле `file` (аудиофайл).
  * Логика: Конвертация в `oggopus` → SpeechKit STT → передача текста в `processText(text)`.
* **`POST /api/assistant/text`**
  * Вход: JSON `{ "text": "string" }`.
  * Логика: Напрямую вызывает `processText(text)`.

**Форматы ответов `processText(text)`:**

1. **Ошибка (`unknown` или тишина):**
   ```json
   {
     "status": "error",
     "message": "Не расслышал. Повторите, пожалуйста"
   }
   ```

2. **Сценарий `market` (Заказ продуктов):**
   Поиск по `keywords` в таблице `products` (`ILIKE`). Если конкретных названий нет — вернуть 3–4 дефолтных товара (молоко, творог, яйца).
   ```json
   {
     "status": "success",
     "intent": "market",
     "recognizedText": "Закажи молоко 3,2%, творог и яйца на субботу утром",
     "payload": {
       "items": [
         {
           "id": 1,
           "name": "Молоко фермерское 3,2%",
           "qty": 1,
           "price": 99,
           "imageUrl": "/static/products/1.webp"
         }
       ],
       "delivery": {
         "date": "Суббота, 21 ноября",
         "slot": "09:00 - 12:00",
         "address": "ул. Красная, 122"
       }
     }
   }
   ```

3. **Сценарий `analytics` (Аналитика трат → Вклад):**
   Агрегация `transactions` + генерация короткого совета через YandexGPT + баланс из `accounts`.
   ```json
   {
     "status": "success",
     "intent": "analytics",
     "recognizedText": "На что я больше всего потратила в этом месяце?",
     "payload": {
       "totalSpent": 87500,
       "categories": [
         { "name": "Кафе и рестораны", "percent": 48, "amount": 42000 },
         { "name": "Супермаркеты", "percent": 27, "amount": 23625 }
       ],
       "aiAdvice": "В этом месяце почти половина трат ушла на кафе. Переведите свободные средства на вклад под 14%, чтобы накопить быстрее.",
       "depositOffer": {
         "rate": 14,
         "defaultAmount": 800000,
         "accountBalance": 1800000
       }
     }
   }
   ```

---

### Контроллер 2: `ActionsController` (`/api/actions`)

* **`POST /api/actions/order`**
  * Вход: `{ "items": [{ "id": 1, "qty": 2 }], "totalPrice": 497, "deliverySlot": "09:00 - 12:00" }`
  * Логика: В транзакции БД списывает `totalPrice` из `accounts`, подтягивает названия товаров по `id` и создает запись в `assistant_history` (`title: "Заказ фермерских продуктов"`, `subtitle: "Молоко фермерское 3,2%, Творог..."`, `amount: 497`, `type: "market"`).
  * Выход: `{ "status": "ok", "newBalance": 1799503 }`

* **`POST /api/actions/deposit`**
  * Вход: `{ "amount": 800000, "termMonths": 6, "rate": 14 }`
  * Логика: Списывает `amount` из `accounts`, создает запись в `assistant_history` (`title: "Открытие вклада под 14%"`, `subtitle: "На срок 6 мес."`, `amount: 800000`, `type: "analytics"`).
  * Выход: `{ "status": "ok", "newBalance": 1000000 }`

* **`GET /api/actions/history`**
  * Логика: Возвращает баланс из `accounts` и список `assistant_history` (`ORDER BY createdAt DESC`).
  * Выход:
    ```json
    {
      "balance": 1800000,
      "history": [
        { "id": 1, "title": "Перевод по СБП", "subtitle": "Александру К.", "amount": 3500, "type": "transfer", "createdAt": "..." }
      ]
    }
    ```

* **`POST /api/actions/reset`** *(Сброс демо перед питчем)*
  * Логика: Очищает `assistant_history`, возвращает `balance` к `1800000` и перезапускает сид истории (таблицу `products` из 100 товаров не трогает).
  * Выход: `{ "status": "ok", "message": "Demo reset completed" }`

---

## 5. Интеграция и Swagger
* Включить CORS для фронтенд-домена и `localhost:3000`.
* Описать все эндпоинты декораторами Swagger (`@ApiTags`, `@ApiBody`, `@ApiConsumes('multipart/form-data')` для `/voice`).
