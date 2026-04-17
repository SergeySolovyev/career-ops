# CareerPilot — Deploy Guide

Полное руководство по развёртыванию для сдачи курсового проекта.

## Что готово (код)

| Критерий | Реализация | Файлы |
|----------|-----------|-------|
| 1. Прикладная задача | AI-автоматизация поиска работы | Весь проект |
| 2. Вайб-кодинг (n8n) | Визуальный workflow | `n8n/careerpilot-workflow.json` |
| 3. LLM | Claude API (streaming) | `apps/web/app/api/chat/route.ts` |
| 4. ТГ-бот | Webhook handler с 4 командами + freeform AI | `apps/web/app/api/telegram/webhook/route.ts` |
| 5. Лендинг | Hero + features + pricing | `apps/web/app/page.tsx` |
| 6. Web UI | Dashboard + matches + pipeline | `apps/web/app/(app)/*` |
| 7. Авторизация | Supabase Auth + server actions | `apps/web/app/(auth)/*`, `apps/web/lib/supabase/*` |
| 8. RAG-ассистент | Context-stuffing CV + top vacancies | `apps/web/app/(app)/chat/page.tsx` |
| 9. БД | Prisma schema (6 моделей), Supabase PostgreSQL | `packages/db/prisma/schema.prisma` |
| 10. Голосовой STT | Web Speech API (ru-RU) | `apps/web/app/(app)/chat/page.tsx` |
| 11. Дашборд | Реальные данные из seed JSON | `apps/web/app/(app)/dashboard/page.tsx` |
| 12. Воронка | Funnel visualization | `apps/web/app/(app)/analytics/page.tsx` |

## Порядок деплоя (30 мин)

### Шаг 1: Supabase (5 мин)

1. Создать проект: https://supabase.com/dashboard → New project
2. Settings → API → скопировать:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`
3. Settings → Database → Connection string → скопировать `URI` → `DATABASE_URL`, `DIRECT_URL`
4. (Опционально) Применить Prisma schema:
   ```bash
   cd packages/db
   pnpm prisma db push
   ```

### Шаг 2: Telegram-бот (3 мин)

1. Открыть [@BotFather](https://t.me/BotFather) → `/newbot`
2. Название: `CareerPilot Assistant`, username: `careerpilot_[yourname]_bot`
3. Сохранить `BOT_TOKEN` → `TELEGRAM_BOT_TOKEN`
4. Открыть бота, отправить любое сообщение
5. [@userinfobot](https://t.me/userinfobot) → `/start` → скопировать `Id` → `TELEGRAM_CHAT_ID`

### Шаг 3: Git push (2 мин)

```bash
cd careerpilot
git init
git add .
git commit -m "Initial CareerPilot MVP"
# создать репо на GitHub → careerpilot
git remote add origin https://github.com/USERNAME/careerpilot.git
git push -u origin main
```

### Шаг 4: Vercel deploy (10 мин)

1. https://vercel.com/new → Import GitHub repo `careerpilot`
2. **Root directory**: `apps/web`
3. **Framework preset**: Next.js (автоопределится)
4. **Build command**: `cd ../.. && pnpm install && pnpm --filter @careerpilot/web build`
5. **Install command**: `pnpm install`
6. Environment Variables — добавить все из `.env.example`:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   DATABASE_URL
   DIRECT_URL
   ANTHROPIC_API_KEY (или ProxyAPI)
   ANTHROPIC_BASE_URL (если ProxyAPI)
   ANTHROPIC_MODEL=claude-sonnet-4-20250514
   TELEGRAM_BOT_TOKEN
   TELEGRAM_CHAT_ID
   NEXT_PUBLIC_APP_URL=https://careerpilot.vercel.app
   ```
7. Deploy → получить URL `https://careerpilot-XXX.vercel.app`

### Шаг 5: Настроить Telegram webhook (1 мин)

После успешного деплоя:
```
https://careerpilot-XXX.vercel.app/api/telegram/setup?url=https://careerpilot-XXX.vercel.app
```
Проверь, что бот отвечает на `/start`.

### Шаг 6: n8n workflow (5 мин)

1. https://app.n8n.cloud → Sign up (free)
2. New Workflow → `...` menu → Import from File → `n8n/careerpilot-workflow.json`
3. Credentials → Add → Telegram API:
   - Access Token = `TELEGRAM_BOT_TOKEN`
4. Variables:
   - `CAREERPILOT_URL` = `https://careerpilot-XXX.vercel.app`
   - `TELEGRAM_CHAT_ID` = ваш chat_id
5. Активировать (toggle `Active`) → тест `Execute Workflow`

### Шаг 7: Проверка 12 критериев (5 мин)

Открой каждый URL и убедись, что работает:

| # | Критерий | URL | Что проверить |
|---|----------|-----|---------------|
| 1 | Прикладная задача | https://careerpilot-XXX.vercel.app | Лендинг отображается |
| 2 | Вайб-кодинг | n8n workflow editor | Скриншот workflow |
| 3 | LLM | /chat | Отправь сообщение, увидишь streaming |
| 4 | ТГ-бот | @careerpilot_..._bot | `/start`, `/status`, `/top` |
| 5 | Лендинг | / | Hero + pricing |
| 6 | Web UI | /dashboard | Статистика + navigation |
| 7 | Авторизация | /login, /signup | Supabase auth |
| 8 | RAG | /chat | Советы на основе CV + вакансий |
| 9 | БД | Supabase dashboard | Таблицы видны |
| 10 | Голос STT | /chat → микрофон | Кнопка Mic работает в Chrome |
| 11 | Дашборд | /dashboard | 5 метрик + quick actions |
| 12 | Воронка | /analytics | 7-этапная воронка + топ-5 |

## Env checklist

**Обязательные для работы (минимум)**:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — auth
- ✅ `ANTHROPIC_API_KEY` — RAG chat + TG bot freeform
- ✅ `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — бот

**Опциональные (для полного функционала)**:
- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` — БД через Prisma
- `STRIPE_*` — billing (пока не реализовано в UI)
- `ANTHROPIC_BASE_URL` — если через ProxyAPI

## Troubleshooting

**Build падает на Vercel**:
- Проверь Build Command: `cd ../.. && pnpm install && pnpm --filter @careerpilot/web build`
- Проверь Install Command: `pnpm install`
- Root Directory должен быть `apps/web`

**Telegram бот не отвечает**:
- Проверь webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Должен быть `url` = твой vercel URL
- Пересоздай: `/api/telegram/setup?url=https://...`

**Chat возвращает ошибку**:
- Проверь `ANTHROPIC_API_KEY` в Vercel env
- Проверь Function Logs в Vercel → `/api/chat`

**Stats/Analytics показывают нули**:
- Seed-данные находятся в `apps/web/data/auto-eval-log.json`, `outreach.json`
- При деплое они автоматически попадают в `process.cwd()/data/`

## Стоимость

| Сервис | Free tier | Достаточно? |
|--------|-----------|-------------|
| Vercel | 100GB bandwidth/мес | Да |
| Supabase | 500MB DB, 1GB storage | Да |
| n8n.cloud | 5 workflows | Да (1 используем) |
| Telegram Bot | Бесплатно навсегда | Да |
| Anthropic API | Pay-as-you-go (~$0.01/запрос) | Пополнить $5 достаточно |

**Итого: $0-5 на запуск.**

## Структура для сдачи

1. **Публичные URL** (для xlsx):
   - Landing: `https://careerpilot-XXX.vercel.app`
   - Dashboard: `https://careerpilot-XXX.vercel.app/dashboard`
   - Chat: `https://careerpilot-XXX.vercel.app/chat`
   - Analytics: `https://careerpilot-XXX.vercel.app/analytics`
   - Login: `https://careerpilot-XXX.vercel.app/login`
   - Telegram: `https://t.me/careerpilot_XXX_bot`

2. **Репозитории**:
   - GitHub: `https://github.com/USERNAME/careerpilot`
   - n8n workflow: экспорт JSON из `n8n/careerpilot-workflow.json`

3. **Скриншоты** (сделать вручную):
   - n8n workflow editor (визуальные ноды)
   - Supabase tables view
   - Telegram bot conversation
   - Voice input (микрофон горит красным)
