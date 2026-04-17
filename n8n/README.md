# n8n Workflow — CareerPilot Daily Digest

Визуальный workflow (критерий "Вайб-кодинг"), который каждые 4 часа забирает статистику из CareerPilot API и отправляет дайджест в Telegram.

## Структура workflow

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────────┐
│ Schedule     │───▶│ GET /api/stats   │───▶│ IF recommend │───▶│ Format MSG │───▶│ Telegram Bot │
│ (каждые 4ч)  │    │ (CareerPilot)    │    │ > 0          │    │ (Markdown) │    │ sendMessage  │
└──────────────┘    └──────────────────┘    └──────────────┘    └────────────┘    └──────────────┘
```

## Установка

### 1. Создать Telegram-бота

1. Открой [@BotFather](https://t.me/BotFather) в Telegram
2. Отправь `/newbot`, придумай имя (например, `CareerPilot Assistant`) и username (`careerpilot_sss_bot`)
3. Сохрани полученный `BOT_TOKEN` — формат `123456789:ABC...`
4. Открой своего бота, отправь любое сообщение
5. Получи свой `CHAT_ID` через [@userinfobot](https://t.me/userinfobot)

### 2. Зарегистрироваться в n8n.cloud

1. [n8n.cloud/signup](https://app.n8n.cloud/register) — free tier (5 workflows)
2. Создать новый workflow → Import from JSON
3. Загрузить `careerpilot-workflow.json`

### 3. Настроить credentials и переменные

В n8n Settings → Environment Variables:
```
CAREERPILOT_URL=https://careerpilot.vercel.app
TELEGRAM_CHAT_ID=123456789
```

В Credentials → Add Credential → Telegram API:
- Name: `CareerPilot Bot`
- Access Token: вставь `BOT_TOKEN` от BotFather

### 4. Активировать workflow

1. Открыть импортированный workflow
2. Кликнуть `Active` (toggle справа сверху)
3. Первый запуск произойдёт через 4 часа, либо нажать `Execute Workflow` для теста

## Что увидит пользователь

Каждые 4 часа в Telegram придёт сообщение:

```
🚀 CareerPilot — Дайджест

📊 Воронка:
• Найдено: 47
• Оценено: 29
• Рекомендовано: 12
• Откликов: 8

📈 Средний скор: 3.7/5

⭐ Топ-3 вакансии:

1. 4.7/5 — cornerstone russia banking ai director
   hh.ru

2. 4.2/5 — сбер rnd data science
   hh.ru

3. 4.2/5 — группа вр cdo
   hh.ru

💬 Задай вопрос боту или открой CareerPilot
```

## Связь с Telegram-ботом

Параллельно работает **интерактивный бот** (`/api/telegram/webhook`):
- Принимает команды `/start`, `/status`, `/top`, `/help`
- Свободный текст → Claude API → ответ консультанта

**Настройка webhook (один раз):**
```bash
curl "https://careerpilot.vercel.app/api/telegram/setup?url=https://careerpilot.vercel.app"
```

## Зачем так, а не всё в Next.js?

n8n покрывает **критерий 2 (вайб-кодинг)** — это no-code визуальный инструмент. Сделать то же самое в Next.js можно, но:
- n8n показывает "ИИ в бизнесе" как интеграционный паттерн
- Визуальный workflow понимает любой стейкхолдер без кода
- Легко добавлять новые шаги (Google Sheets, Slack, Notion, etc.)

**Архитектура разделения:**
- **Next.js** — приложение, API, UI, AI chat (ядро продукта)
- **n8n** — оркестрация периодических задач и уведомлений (вайб-кодинг)
- **Telegram Bot** — канал доставки уведомлений и интерактив (критерий 4)
