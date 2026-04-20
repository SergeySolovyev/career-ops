# n8n Workflow — CareerPilot Daily Job Digest

**Purpose**: каждые 4 часа дёргаем `/api/stats` у CareerPilot, если есть новые рекомендованные вакансии — шлём уведомление в Telegram-бот [@career170426bot](https://t.me/career170426bot).

**Hosted on**: https://sergeisolovev.app.n8n.cloud/workflow/gQLyThF7XLCZYb7x
(доступ только у владельца; этот README — публичная документация flow)

## Диаграмма

```
┌─ Schedule Trigger ───────┐
│ "Каждые 4 часа"          │
│ scheduleTrigger          │
└──────────┬───────────────┘
           │
           ▼
┌─ HTTP Request ───────────┐
│ "GET CareerPilot Stats"  │
│ GET https://careerpilot- │
│ umber.vercel.app/api/    │
│ stats                    │
└──────────┬───────────────┘
           │
           ▼
┌─ IF Condition ───────────┐
│ "Есть рекомендации?"     │
│ funnel.recommended > 0   │
└──────────┬───────────────┘
           │ (true)
           ▼
┌─ Code (JS) ──────────────┐
│ "Форматировать сообщение"│
│ Собирает markdown-       │
│ сообщение из stats.      │
│ topVacancies + funnel    │
└──────────┬───────────────┘
           │
           ▼
┌─ Telegram ───────────────┐
│ "Отправить в Telegram"   │
│ sendMessage → chat_id    │
│ (владельца бота)         │
└──────────────────────────┘
```

## Узлы (из n8n API)

| # | Node name | n8n type | Задача |
|---|---|---|---|
| 1 | «Каждые 4 часа» | `scheduleTrigger` | Каждые 4 часа запускает flow |
| 2 | «GET CareerPilot Stats» | `httpRequest` | `GET https://careerpilot-umber.vercel.app/api/stats` → funnel + topVacancies |
| 3 | «Есть рекомендации?» | `if` | Проверяет `funnel.recommended > 0` |
| 4 | «Форматировать сообщение» | `code` (JavaScript) | Формирует markdown-сообщение с топом вакансий |
| 5 | «Отправить в Telegram» | `telegram` | `sendMessage` в TG через бота `career170426bot` |

## Почему n8n

n8n — visual workflow builder, «вайб-кодинг» без классического программирования. Альтернатива Make/Zapier. Здесь — для периодических фоновых задач, которые неудобно держать в Vercel Cron.

## Связь с приложением

- **Upstream** (источник данных): `/api/stats` у CareerPilot (Vercel) — возвращает воронку и топ-вакансии по AI-скору
- **Downstream** (куда шлёт): Telegram Bot API через Telegram-node в n8n
- **Credential storage**: Telegram bot token хранится в n8n Credentials (зашифровано), никогда не попадает в код
