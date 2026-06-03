# Launch Checklist — твои действия

**Цель:** запустить TG-поиск + Tinkoff-платежи. Всё что я мог автоматизировать — уже сделано. Это твой список.

**Прод сейчас:** https://vibeoffer.today — hh.ru scanner + Free quota gate + Pro intent flow работают live.

**Что НЕ работает пока:**
1. TG-поиск каналов — кнопка возвращает "Telegram-сканер скоро будет включён"
2. Pro/Premium платёж — кнопка "Оформить за ₽99" даст error (нет Tinkoff ключей)

---

## Track A: Tinkoff Касса (~30 мин активной работы)

**Зависит от:** одобрения Tinkoff (~24h после подачи заявки)

### A1. Подать заявку (5 мин, делай прямо сейчас)
- https://www.tinkoff.ru/kassa/
- "Подключить" → выбрать ИП → войти в ЛК Tinkoff Бизнес
- Заполнить анкету магазина:
  - Название: VibeOffer
  - Сайт: https://vibeoffer.today
  - Категория: Программное обеспечение (1521 ОКВЭД)
  - Описание: AI-платформа поиска работы. Pro подписка ₽299/мес, Premium ₽699/мес.
  - Тип товара: цифровой, доставка не требуется
- Прикрепить: договор оферты с сайта (можно мой сгенерировать если надо), скрин ИП-выписки
- Расчётный счёт: твой ВТБ RUB IBAN

### A2. После одобрения (~24h, делай когда придёт email "ваш магазин одобрен")
1. Зайти в lk.tinkoff.ru/business → Касса → Магазины
2. Выбрать **DEMO** terminal (тест!)
3. Скопировать TerminalKey + Password
4. Скинуть мне в чат **только в формате**:
   ```
   TINKOFF_TERMINAL_KEY=1234567890ABC
   TINKOFF_PASSWORD=YourSecretHere
   ```
   Я залью в Vercel env через REST API и redeploy сам.

### A3. Webhook URL (2 мин, после A2)
В том же ЛК Tinkoff:
- Магазин → Настройки → Уведомления
- **URL:** `https://vibeoffer.today/api/billing/webhook`
- **Метод:** POST, тип JSON
- **События:** все (AUTHORIZED, CONFIRMED, REJECTED, REFUNDED)
- Save

### A4. ₽1 sandbox test (~10 мин, я сделаю)
После A2+A3 — я выполню end-to-end ₽1 платёж тестовой картой и подтверждаю что `subscriptions` row создаётся с `status='active'`.

### A5. Переключение на боевой (~5 мин, после A4 green)
- В ЛК Tinkoff → переключиться на **боевой** terminal
- Скинуть мне новые TerminalKey + Password в том же формате
- Я обновлю Vercel env + redeploy
- Зарегистрировать webhook URL уже на боевом магазине

---

## Track B: TG-worker на droplet (~25 мин активной работы)

**Зависит от:** твоего телефона (SMS для TG-аккаунта) + SSH к droplet `165.245.217.177`

**Я уже сделал:**
- ✅ `WORKER_BASE_URL=https://tg-165-245-217-177.nip.io` в Vercel
- ✅ `WORKER_SHARED_SECRET=1543321e4a348fddc780c720291f96ff21127da7d556c4c3109a5cc879eb6a79` в Vercel
- ✅ Health-check gate в коде — пока worker мёртв, UI показывает "скоро"
- ✅ Migration 003 (`tg_channels`) применена в проде
- ✅ `tg_seed_default_channels()` RPC работает — новые юзеры получают 10 каналов

**Что нужно ОТ тебя:**

### B1. Зарегистрировать отдельный TG-аккаунт (~10 мин)
**Критично:** НЕ твой основной. Риск permanent ban за MTProto polling.
- Свежая SIM-карта или Google Voice / virtual number
- Установить Telegram → войти под новым номером
- В Telegram Desktop — подписаться на 10 default каналов (из /settings в проде; spoiler: `@datasciencejobs_ru`, `@designforevery_jobs`, `@devops_jobs`, `@forfrontend`, `@hh_jobbot`, `@HrA_devjobs`, `@itjobeurasia`, `@itswag`, `@product_management_jobs`, `@qajobs`)

### B2. Получить api_id + api_hash (~3 мин)
- https://my.telegram.org → войти под новым TG-аккаунтом
- API development tools → Create new application:
  - Title: `VibeOffer`
  - Short name: `careerpilot`
  - URL: `https://vibeoffer.today`
  - Platform: Other
- Скопировать **api_id** (число) и **api_hash** (32-hex)
- Скинуть мне в чат **только в формате:**
  ```
  TG_MTPROTO_API_ID=12345678
  TG_MTPROTO_API_HASH=0123456789abcdef0123456789abcdef
  ```

### B3. SSH к droplet (~10 мин, тебе нужно ввести SMS-код)
**Команды для копипасты — pre-baked secret уже подставлен:**

```bash
ssh root@165.245.217.177

# Обновить код
cd /opt/cp-worker
git fetch origin && git checkout careerpilot && git pull

# Запустить auth.js — потребует SMS-код в Telegram Desktop
cd /opt/cp-worker/infra/do-worker/tg
docker run --rm -it \
  -e TG_MTPROTO_API_ID=<твой api_id из B2> \
  -e TG_MTPROTO_API_HASH=<твой api_hash из B2> \
  -v "$(pwd):/app" -w /app \
  node:20-alpine sh -c "npm install --omit=dev && node auth.js"

# Скрипт спросит:
# 1. Phone number → введи номер от B1 (+79991234567)
# 2. Code from Telegram → откроется в Telegram Desktop, введи 5 цифр
# 3. 2FA password → Enter (если не ставил)
# 4. Скопируй TG_MTPROTO_SESSION (~350 символов)
```

### B4. Создать .env на droplet (~3 мин)
```bash
nano /opt/cp-worker/infra/do-worker/.env

# Добавь (НЕ удаляй существующие BROWSERLESS_* строки):
TG_MTPROTO_API_ID=<api_id из B2>
TG_MTPROTO_API_HASH=<api_hash из B2>
TG_MTPROTO_SESSION=<session из B3>
TG_WORKER_SECRET=1543321e4a348fddc780c720291f96ff21127da7d556c4c3109a5cc879eb6a79
TG_WORKER_DOMAIN=tg-165-245-217-177.nip.io

# Ctrl+O, Enter, Ctrl+X
chmod 600 /opt/cp-worker/infra/do-worker/.env
```

### B5. Запустить worker (~2 мин)
```bash
cd /opt/cp-worker/infra/do-worker
git pull   # на случай если docker-compose.yml обновился
docker compose build tg-worker
docker compose up -d tg-worker caddy
docker compose logs --tail=20 tg-worker
# Жди: [tg-worker] Telegram MTProto connected
#      [tg-worker] HTTP listening on :3200
```

### B6. Проверка (~1 мин)
```bash
# С droplet
curl http://localhost:3200/health
# {"ok":true,...}

# Из любого места
curl https://tg-165-245-217-177.nip.io/health
# {"ok":true,...}
```

**Если оба зелёные → TG-поиск активен.** Vercel-side ничего трогать не надо — env vars уже залиты.

---

## Что после launch (Week 1, я делаю)

- Sentry P0/P1 alerts (любая 5xx в /api/billing/* или /api/tg/* — pager)
- Daily DB metrics: новые subscriptions, conversion rate, churn
- Анти-fraud: detect users with 50+ scans/день → manual review
- Recurring billing test через `tinkoff_rebill_id` (Day +28 после первого платежа)

---

## TL;DR — твой список

| Action | Время | Зависит от |
|---|---|---|
| A1: Подать в Tinkoff | 5 мин | — |
| A2: Скинуть мне Tinkoff ключи | 1 мин | Одобрение (~24h) |
| A3: Зарегать webhook URL в Tinkoff | 2 мин | A2 |
| B1: Свежая SIM + TG-аккаунт + подписка на 10 каналов | 15 мин | — |
| B2: Скинуть мне api_id+api_hash | 2 мин | B1 |
| B3-B5: SSH + auth + deploy | 10 мин | B1+B2 |
| B6: Smoke test | 1 мин | B5 |

**Total active time твоей стороны: ~36 минут**, не считая ожидания одобрения Tinkoff.

Всё остальное я доведу.
