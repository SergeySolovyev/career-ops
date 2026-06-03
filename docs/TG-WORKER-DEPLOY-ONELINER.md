# TG Worker — однострочный деплой

**Что:** запуск Telegram-парсера на DigitalOcean droplet.
**Зачем:** без него сканер TG-каналов в `/api/tg/scan-now` возвращает 503.
**Время выполнения:** 25 минут (с регистрацией нового TG-аккаунта).

---

## Что нужно ОТ Сергея ДО запуска

1. **Свежий Telegram-аккаунт** — НЕ основной. Купить SIM на физ.лицо (₽300 в Связном)
   или использовать виртуальную SIM от sms-activate.ru (₽30, не Telegram-friendly но работает).
   **Почему отдельный:** MTProto-polling массовых каналов может триггерить ban risk,
   защищаем основной аккаунт Сергея.

2. **api_id + api_hash от my.telegram.org** — после регистрации новой SIM:
   - Авторизация на my.telegram.org с новой SIM
   - API development tools → Create new application
   - App title: `VibeOffer Worker` · short name: `cp-worker`
   - URL: `https://vibeoffer.today`
   - Platform: Desktop
   - Получить `api_id` (число) и `api_hash` (32 hex)

3. **DigitalOcean droplet** — Ubuntu 22.04, $6/мес (минимальный 1GB RAM хватает)

4. **SSH-доступ** — `ssh root@<droplet-ip>`

---

## Деплой одной командой

После SSH на droplet:

```bash
# 1. Клонируем репозиторий (или копируем infra/do-worker/tg/ на сервер)
git clone <careerpilot-repo-url> /opt/careerpilot
cd /opt/careerpilot/infra/do-worker/tg

# 2. Создаём .env
cat > .env <<'EOF'
TG_API_ID=ВСТАВИТЬ_СЮДА
TG_API_HASH=ВСТАВИТЬ_СЮДА
TG_PHONE=+7900XXXXXXX
WORKER_SHARED_SECRET=ВЫПОЛНИТЬ_openssl_rand_base64_48
ANTHROPIC_API_KEY=скопировать_из_Vercel
SUPABASE_URL=скопировать_из_Vercel
SUPABASE_SERVICE_ROLE_KEY=скопировать_из_Vercel
EOF

# 3. Первый запуск auth.js для получения TG-session-string
docker compose run --rm tg-worker node auth.js
# Появится prompt: ввести код из SMS (придёт в Telegram-приложение на новой SIM)
# После успеха — выведет session string. Добавить в .env:
echo "TG_SESSION=<вставленный-session-string>" >> .env

# 4. Поднять полный стек (worker + caddy reverse proxy с auto-SSL)
docker compose up -d tg-worker caddy

# 5. Проверка
curl https://<droplet-ip>/health
# Ожидаем: {"ok":true,"version":"...","uptime":...}
```

---

## После запуска worker'а

В Vercel env (через CLI или https://vercel.com/<team>/careerpilot/settings/environment-variables):

```bash
vercel env add WORKER_BASE_URL production
# Значение: https://<droplet-domain-or-ip>

vercel env add WORKER_SHARED_SECRET production
# Значение: то же что в .env worker'а

# Если ещё не были добавлены:
vercel env add CRON_SECRET production
# Значение: openssl rand -base64 32 (генерируется локально, добавляется и в vercel.json cron header)

vercel env add ANTHROPIC_HAIKU_MODEL production
# Значение: claude-haiku-4-5-20250929 (или актуальная версия)
```

Затем триггерим redeploy:
```bash
vercel --prod
```

---

## Проверка после деплоя Vercel

```bash
# 1. /api/tg/scan-now должен теперь возвращать 200 (был 503)
curl -X POST https://vibeoffer.today/api/tg/scan-now \
  -H "Cookie: <auth-cookie>"
# Ожидаем: {"ok":true,"channels_scanned":N,...}

# 2. Cron /api/tg/scan-all зарегистрирован (Vercel UI → Cron Jobs)
# Должен бежать 1 раз в сутки.
```

---

## Расходы

| Item | Цена | Частота |
|---|---|---|
| DO droplet (1GB) | $6/мес | ежемесячно |
| Caddy + SSL | бесплатно | — |
| TG SIM | ₽300 | разово |
| **Итого первого месяца** | **~₽900** | — |

---

## Recovery (если TG-аккаунт забанили)

1. Купить новую SIM
2. На my.telegram.org → создать новое приложение, новый `api_id/api_hash`
3. Удалить старый `TG_SESSION` из .env
4. `docker compose run --rm tg-worker node auth.js` → новый session
5. `docker compose restart tg-worker`

Все настройки cron + каналов в Supabase останутся — пользователи не заметят
переключения backend'а.
