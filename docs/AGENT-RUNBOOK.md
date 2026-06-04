# Agent Runbook — операционный гайд для agent-native VibeOffer

**Что это:** how-to для запуска, мониторинга и эволюции каждого агента.
**Кому:** Сергей + Яна (manager-of-agents role).
**Когда читать:** перед запуском нового агента или при разборе incident'а.

---

## Принципы (по Menlo + OpenAI + YC)

1. **Agent = role + tools + SOP + quality bar + evals.** Без любого из 5 — это не агент, а функция.
2. **Human-in-the-loop для destructive actions.** Send/post/charge/delete — только через approval.
3. **Untrusted input оборачивается явно.** Любой контент из веб/TG/email = `unsafeInput: true`.
4. **Cost discipline.** Каждый агент знает свой `inputTokens/outputTokens/latency/cost`.
5. **Один эксперимент за раз.** Меняем SOP — мерим quality bar до/после.

---

## Запуск Outreach Drafter Agent (production-ready)

### Подготовка списка людей

Создать `docs/outreach-list.json` (gitignored — содержит personal data):

```json
[
  {
    "name": "Алексей",
    "profession": "junior frontend dev, 1 год опыта (React, TypeScript)",
    "relationship": "одногруппник по МАИ, вместе делали diplom",
    "handle": "@alexei_dev",
    "channel": "tg"
  },
  {
    "name": "Мария",
    "profession": "junior UX designer, портфолио на Behance",
    "relationship": "познакомились на DesignProsmotr 2025",
    "handle": "maria@example.com",
    "channel": "email"
  }
]
```

**Schema:**
- `name` — как обращаются друзья
- `profession` — конкретно, не «работает в IT»
- `relationship` — контекст знакомства, **должен быть правдивым**
  (агент НЕ выдумывает общих знакомых, но опирается на это для hook'а)
- `handle` — куда отправлять
- `channel` — `tg` (80-150 слов) или `email` (150-200 слов)

### Запуск

```bash
cd "C:\Yandex.Disk\Yandex.Disk\! work -  i found job\careerpilot-git"
export ANTHROPIC_API_KEY=sk-ant-...
tsx scripts/draft-outreach.ts
```

Получите `docs/OUTREACH-DRAFTS.md` с готовыми черновиками.

### Workflow редактирования

1. Прочитать все 30 черновиков — это **обязательный** humanApprovalGate
2. Для каждого:
   - Проверить factuality (агент не выдумал общего знакомого?)
   - Подправить tone если звучит «как GPT»
   - Решить — отправлять или skip
3. Скопипастить → Telegram/Gmail → отправить
4. Через 7 дней — отметить какие конвертили (открыли/ответили/зарегались)

### Quality bar — как понять что агент работает

- ≥ 70% черновиков отправляются без правок или с минимальными правками
- ≥ 30% получают ответ в течение 48ч (vs baseline ~10% для bulk email)
- 0 случаев когда агент выдумал общего знакомого → если случилось,
  расширить SOP с явным «НЕ выдумывай отношений которых нет в input»

### Если что-то пошло не так

| Симптом | Диагностика | Действие |
|---|---|---|
| Все черновики звучат одинаково | SOP слишком жёсткий | Ослабить структурные требования в SOP |
| Агент пишет HR-канцелярит | Anthropic слишком формальный по умолчанию | Добавить few-shot example «как НЕ писать» |
| `Anthropic 401` | API key не установлен или неверный | Проверить env var |
| `Anthropic 529` | Перегрузка серверов Anthropic | Retry через 1-2 минуты |
| JSON parse failed | Модель вернула prose | Усилить `jsonHint` в runtime |

---

## Запуск существующих агентов (L2 в production)

### Match Agent — `/api/scan-now`

Запускается автоматически когда пользователь жмёт «Найти вакансии».
Quality monitoring:

```sql
-- Distribution of scores за неделю
SELECT
  CASE WHEN ai_score < 3 THEN '0-3'
       WHEN ai_score < 6 THEN '3-6'
       WHEN ai_score < 8 THEN '6-8'
       ELSE '8-10' END AS bucket,
  COUNT(*) AS n
FROM user_evaluations
WHERE evaluated_at > NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1;
```

Healthy distribution: 0-3 ≥ 20% (агент честно отбраковывает), 8-10 ≤ 15%.
Если > 50% попадают в 8-10 — агент стал «всё хорошо» (LLM drift) → проверить evals.

### CV Coach Agent — `/api/chat`

Запускается при отправке message в `/chat`. Quality signals:
- Chat sessions > 3 messages = engagement good
- User CV updated в течение 24ч после chat = high signal что советы применили

### Discovery Agent — `/api/tg/scan-all` (cron daily)

Healthy: `tg_scan_log` row каждый день с `status='ok'` и `count > 5`.
Alerts: 0 records 2+ дня подряд = разбираться (Sentry должен поймать).

---

## Запуск future-агентов (Sprint A-B roadmap)

### CV-Tailor Agent (Sprint A — РЕАЛИЗОВАН)

**Production-ready.** Файлы: `apps/web/lib/agents/cv-tailor.ts` + API route
`POST /api/agents/cv-tailor`.

**Использование через API (после auth):**

```bash
# Вариант 1: используем сохранённую evaluation
curl -X POST https://vibeoffer.today/api/agents/cv-tailor \
  -H "Cookie: <auth-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"vacancyId":"https://hh.ru/vacancy/123456"}'

# Вариант 2: ad-hoc с inline CV + JD
curl -X POST https://vibeoffer.today/api/agents/cv-tailor \
  -H "Cookie: <auth-cookie>" \
  -H "Content-Type: application/json" \
  -d '{
    "originalCv": "Иван Иванов, junior frontend...",
    "vacancy": {
      "title": "Frontend Developer",
      "company": "Ozon",
      "description": "React 18, TypeScript, ..."
    }
  }'
```

**Возвращает:**
```json
{
  "ok": true,
  "output": {
    "original": "...",
    "tailored": "...",
    "diff": [
      {"type": "replace", "before": "Опытный разработчик", "after": "Frontend developer с 2 годами опыта на React + TypeScript", "reason": "Привязка к JD требованию 'опыт React 18 ≥ 1 год'"}
    ],
    "ethics_flags": []
  },
  "latency_ms": 12450,
  "tokens": {"input": 1234, "output": 890}
}
```

**Что мониторить (quality bar из registry):**
- `ethics_flags.length === 0` для ≥ 95% вызовов (иначе SOP drift на fabrications)
- Re-eval-score Match Agent на tailored CV должен быть ≥ baseline + 0.5
- Tailored CV длиной 0-15% короче оригинала

**TODO Sprint A (после первых 10 paid users):**
1. Wire to `/onboarding` Step 3 → кнопка «Подогнать CV под топ-матч»
2. Создать golden-set: 10 CV+JD пар с reference tailoring от Яны
3. Добавить `tailored_cvs` таблицу для сохранения версий (одна на (user, vacancy))

### Salary-Anchor Agent (Sprint B)

**Не реализован, не registered ещё.** Concept:
- Input: target_roles + city + experience_years + skills
- Output: salary range (P25/P50/P75) с источниками (hh.ru API, habr.career)
- Trigger: daily cron + manual на запрос пользователя
- Quality bar: range на 80%+ совпадает с публичным habr salary report

### Ops Watch Agent (Sprint B)

**Registered, не реализован.** Concept:
- Hourly cron
- Reads: Vercel deployments API, Supabase health endpoint, Sentry events API
- Output: TG message founder'у при `status != 'ok'`
- HumanApprovalGate: НЕ перезапускает сам, только alerts

---

## Cost accounting

Каждый `invokeAgent()` логирует:
```
[agent:outreach-drafter-agent] ✓ manual · 1234in/567out · 2890ms
```

**Текущая стоимость Anthropic Claude Sonnet 4.5 (на 2026-06):**
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens
- 1234 in + 567 out = ~$0.012 per outreach draft
- **30 drafts ≈ $0.36 (~₽33)**

**Match Agent (per evaluation):**
- ~2500 in + 300 out = $0.012
- **5 evals per scan ≈ $0.06 (~₽5)**
- 100 scans/day × ₽5 = ₽500/day = ₽15k/мес

**Когда поднимем prompt caching (Sprint A):** -90% input cost
для SOP-токенов (повторяются 100% между вызовами).

---

## Эволюция SOP — workflow

1. **Identify regression**: пользователь жалуется / quality bar упал
2. **Reproduce**: запустить агента на том же input, сохранить output
3. **Hypothesize SOP fix**: что в SOP надо изменить
4. **A/B**: новый SOP vs старый на golden-set (10+ inputs)
5. **Roll out**: новый SOP в registry.ts если ≥ 80% on golden-set
6. **Monitor 7 days**: если quality bar дрейфит назад — rollback

---

## Когда добавить нового агента

✅ Стоит добавлять если:
- Есть повторяемый workflow на 10+ минут руками
- Output измерим (можно сказать «хорошо/плохо»)
- Есть human approval gate для destructive parts
- Cost per invocation < ₽20 (или есть outcome-pricing покрывающий)

❌ Не стоит добавлять если:
- Workflow выполняется раз в месяц (не окупает поддержку)
- Нет способа измерить качество (агент будет дрейфить незаметно)
- Требует tools которых нет (e.g. proprietary API без access)
- Дублирует существующего агента с другим SOP — это не новый агент, это
  fork SOP (плохо для maintainability)
