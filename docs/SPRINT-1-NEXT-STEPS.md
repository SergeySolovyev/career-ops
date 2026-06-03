# Sprint 1 — Next Steps to Live

После того как Vercel задеплоит коммит `ade9d7c` и я применю миграцию 003 — остаются **3 ручных шага** для тебя, без которых TG-парсер не заработает в проде. Все три можно сделать за **20 минут**.

---

## 🟢 Что уже готово (моя зона)

| ✓ | Что | Где |
|---|---|---|
| ✅ | Sprint 1 код (15 новых файлов + 6 модифицированных) | `da36a93` + `ade9d7c` на `careerpilot` branch |
| ✅ | Build чистый, 33/33 страниц | local + Vercel preview |
| ✅ | Code-review (3 BLOCKER + 13 issues) применён | `ade9d7c` |
| ✅ | Migration 003 приложена | Supabase prod (после твоего "ок") |
| ✅ | Runbook для droplet деплоя | `infra/do-worker/tg/RUNBOOK.md` |

---

## 🟡 Что нужно от тебя (в этом порядке)

### Шаг 1 — Telegram credentials (5 минут)

1. Открой https://my.telegram.org → **API development tools** → **Create application**
2. Заполни форму (App title `VibeOffer`, short name `careerpilot`, URL любой, Platform `Other`)
3. Скопируй из ответа:
   - `App api_id` — целое число
   - `App api_hash` — 32-символьная hex-строка

> ⚠️ **Используй ВЫДЕЛЕННЫЙ Telegram-аккаунт**, не основной. Риск бана >0% при чтении 10+ каналов через MTProto. Купи SIM на Wildberries за ~500₽, зарегистрируй TG, добавься во все 10 default-каналов через Telegram Desktop.

### Шаг 2 — Деплой worker на droplet (10 минут)

Полный пошаговый runbook в репо: **`infra/do-worker/tg/RUNBOOK.md`** (1450 слов, copy-paste команды для каждого шага).

Сжатая версия:

```bash
# 1. SSH на droplet
ssh root@<DROPLET_IP>

# 2. pull свежий код careerpilot branch
cd /opt/cp-worker && git pull origin careerpilot

# 3. Сгенерить MTProto session (interactive)
cd infra/do-worker/tg
docker run --rm -it \
  -e TG_MTPROTO_API_ID=<api_id_из_шага_1> \
  -e TG_MTPROTO_API_HASH=<api_hash_из_шага_1> \
  -v "$(pwd):/app" -w /app \
  node:20-alpine sh -c "npm install --omit=dev && node auth.js"
# → введёшь телефон + код из TG → вернёт длинный StringSession

# 4. Сохранить env vars
cd ../  # → /opt/cp-worker/infra/do-worker
nano .env
# Добавить:
#   TG_MTPROTO_API_ID=...
#   TG_MTPROTO_API_HASH=...
#   TG_MTPROTO_SESSION=<длинный_blob>
#   TG_WORKER_SECRET=<openssl rand -hex 32>
#   TG_WORKER_DOMAIN=tg-<ip-через-дефисы>.nip.io

# 5. Запустить worker
docker compose up -d tg-worker
docker compose up -d caddy
docker compose logs --tail=30 tg-worker
# Должно быть: [tg-worker] Telegram MTProto connected
#              [tg-worker] HTTP listening on :3200

# 6. Проверка
curl https://tg-<ip-дашами>.nip.io/health
# → {"ok":true,"ts":...}
```

### Шаг 3 — Vercel env vars (3 минуты)

В Vercel Dashboard → VibeOffer → **Settings → Environment Variables** добавь 4 переменные (Production + Preview):

| Переменная | Значение | Откуда |
|---|---|---|
| `WORKER_BASE_URL` | `https://tg-<ip-дашами>.nip.io` | URL из шага 2.5 |
| `WORKER_SHARED_SECRET` | **точно то же что `TG_WORKER_SECRET`** | из шага 2.4 |
| `CRON_SECRET` | `openssl rand -hex 32` | новый random |
| `ANTHROPIC_HAIKU_MODEL` | `claude-haiku-4-5` | optional, дефолт в коде |

Затем: **Deployments → последний → Redeploy** чтобы env vars подхватились.

### Шаг 4 — Промоут в Production (1 клик)

Vercel deploy `ade9d7c` сейчас building. После того как станет Ready Latest:

1. Открой https://vercel.com/sergeys-projects-04c8641c/careerpilot/AwfHPDYRy5kFhWXuj3FrZPFhRTB3
2. Меню "..." → **Promote to Production**
3. Confirm

Через ~30 секунд `vibeoffer.today` будет на новом коммите.

---

## ✅ Финальная проверка end-to-end

После всех 4 шагов:

1. Открой https://vibeoffer.today/settings → должен видеть **10 default Telegram-каналов** с зелёным "active" статусом
2. Перейди на /matches → нажми **"Сканировать TG"** в правом верхнем углу
3. Через ~30 секунд должно появиться **5–30 новых вакансий** с бейджем `@g_jobbot` (или другой)
4. Бейдж `🔄 dup` должен появиться у вакансий, которые повторяются между HH и TG

Если видишь "Worker недоступен" — проверь Section 9 в `RUNBOOK.md`.

---

## 📊 Costs you'll pay

| Сервис | $/месяц | За что |
|---|---|---|
| Claude API (Haiku + Sonnet) | ~$0.75/user (cap $3) | Классификация + извлечение TG-сообщений |
| DigitalOcean droplet | $0 (уже платишь) | tg-worker сосуществует с Browserless |
| Vercel Hobby | $0 | Daily cron влезает в free tier |
| Telegram | $0 | MTProto бесплатен |
| **Итого incremental** | **~$0.75/active user/month** | |

При 100 платящих юзерах × ₽299/мес = ₽29,900 revenue, минус ₽75 × 100 = ₽7,500 AI cost = **~75% gross margin**. Healthy unit economics.

---

## 🚦 Sprint 2 готов к старту

После Sprint 1 live → переходим к **Sprint 2 (Pivot UX)**:
- Лендинг tone под junior/middle (убрать "Директорский")
- Onboarding без CV — чек-лист скиллов
- Scoring criteria важно: обучение, mentor, удалёнка
- Цены в рублях

Дай знать когда захочешь стартовать planning Sprint 2.
