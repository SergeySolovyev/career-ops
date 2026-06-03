# YC-style Solo Founder Plan — pre/post CloudPayments approval

**Дата:** 2026-06-02
**Контекст:** платёжный gate (CP) висит на одобрении 1-3 рабочих дня. Параллельно
максимизируем всё, что не зависит от CP — чтобы момент одобрения превратился
в часовое включение света, не в недели работы.

**Один принцип YC, который правит всем:** *"do things that don't scale" → запустись →
учись на 10 живых пользователях → масштабируй то, что подтвердилось.* Никаких
preemptive оптимизаций под 10 000 юзеров, которых нет.

---

## Workstream Status (на 2026-06-02 19:00 МСК)

### ✅ Сделано автономно в этой сессии

| # | Что | Файлы | Польза |
|---|---|---|---|
| W1 | Миграция 009 waitlist + RLS + view + индексы | `supabase/migrations/009_waitlist.sql` | Приём emails пока CP не активен |
| W2 | `/waitlist` страница + Server Action + клиент-форма | `apps/web/app/waitlist/{page,actions,waitlist-form}.tsx`, `apps/web/lib/waitlist.ts` | Каждый ушедший на checkout-error остаётся в lead-базе |
| W3 | Onboarding fallback: при `payment_unavailable` → `/waitlist?intent=pro&promo=BETA99` | `apps/web/app/(app)/onboarding/page.tsx` | Превращаем «временно недоступно» в конверсию в lead |
| W4 | Landing Final CTA: лёгкая ссылка «встать в waitlist» | `apps/web/app/page.tsx` | Сбор leads с трафика лендинга |
| W5 | CP submission packet (анкета + cover letter + чек-лист доков) | `docs/CP-SUBMISSION-PACKET-2026-06-02.md` | Яне — открыть Notion и копипастить |
| W6 | Beta outreach templates (TG/LinkedIn/Habr/email) + список 30 имён | `docs/BETA-OUTREACH-TEMPLATES.md` | YC "do things that don't scale" — первые 50 руками |
| W7 | Domain config guide (Reg.ru → Vercel → Yandex 360) | `docs/DOMAIN-CONFIG-careerpilot-ru.md` | Сергею — 30 минут активных действий |
| W8 | TG worker 1-command deploy script + env audit | `docs/TG-WORKER-DEPLOY-ONELINER.md` | Сергею — 25 минут после получения api_id/api_hash |
| W9 | Bulk-email script для waitlist в день одобрения CP | `scripts/notify-waitlist.ts` | Из 50 leads → 8 платящих за 2 часа |

### ⏳ Требует действий человека (см. блок «Где нужно ваше участие» внизу)

| # | Что | Кто | Срок |
|---|---|---|---|
| H1 | Подать заявку CloudPayments + загрузить паспорт | Яна | 1 час |
| H2 | Купить SIM + получить api_id/api_hash + ssh DO + запустить TG worker | Сергей | 25 мин |
| H3 | Купить vibeoffer.today + подвязать к Vercel | Сергей | 30 мин |
| H4 | Применить миграцию 009 на Supabase prod | Сергей | 5 мин |
| H5 | Уведомление в РКН (152-ФЗ ст. 22) | Сергей | 30 мин |
| H6 | Заявка в АТОЛ Онлайн на онлайн-кассу (54-ФЗ) | Яна | 1 день |
| H7 | Отправить персональные TG-сообщения 30 человекам (см. BETA-OUTREACH) | Сергей+Яна | 1 час |

### 🔜 Следующие 2-4 недели (после одобрения CP)

| Спринт | Фокус | KPI |
|---|---|---|
| **Sprint A — Launch week** | Запуск bulk-email из waitlist → первые 8 платящих | 8 paid, < 25% refund |
| **Sprint B — Content engine** | 3 SEO-статьи в /blog: «junior frontend CV 2026», «AI поиск работы РФ 2026», «hh.ru лайфхаки» | Indexed by Google, 100+ visits/week к концу 4-й недели |
| **Sprint C — Product depth** | CV skill extraction (LLM на Step 1 save → автозаполнение skills/segment/years) | -50% дропа в onboarding |
| **Sprint D — Activation loop** | Email follow-up через 24ч после signup без CV + reminder если CV есть но скан не запущен | +20% completion rate |

---

## YC-style принципы, под которые построен этот план

### 1. "Build something people want" — но валидируй ДО кода

**Что мы делаем:** мы НЕ строим в текущий момент новый функционал. Мы достраиваем
шлюзы для конверсии существующего готового продукта. ICP-aware скоринг
(Sonnet 4.5 с 10 критериями) — единственная фича, которую беты будут оценивать.
Всё остальное (TG worker, /chat, /pipeline) — supporting, не core.

### 2. "Talk to users" — собирай feedback напрямую, не через формы

**Что мы делаем:** beta-outreach templates персональные, шаблон email-follow-up
заканчивается «просто ответьте на это письмо — отвечу лично». Каждое возражение
бета-тестера сохраняется в Notion/Google Sheet с тегом 'product/pricing/UX'.

### 3. "Do things that don't scale" — первые 50 руками

**Что мы НЕ делаем:** не покупаем рекламу в Яндексе, не запускаем ProductHunt
до того как 10 органик-юзеров скажут «работает». Все первые касания —
персональные TG-сообщения по списку из 30 имён.

### 4. "Find a slope, push" — итерируй еженедельно

**Cadence:** каждую пятницу retrospective:
- что измерено (DAU, signups, paid, refund-rate, churn-rate)
- что сработало vs не сработало
- одна вещь на следующую неделю

### 5. "Default alive" — runway > 12 месяцев на текущем burn-rate

**Текущий burn-rate:** Vercel (бесплатно) + Supabase (бесплатно до 500MB) +
Anthropic (~₽5/scan × 100 scans/день = ₽500/день = ₽15k/мес) + DO droplet ($6) +
домен (₽300/год) = **~₽16k/мес**.

**Default alive при 30 платящих Pro (₽490)** = ₽14 700/мес. Сейчас целимся в 50
платящих ко 2-й неделе чтобы зайти в плюс.

---

## Multi-agent network setup (под user-запрос "максимально настрой")

**Что уже crystalized в этом проекте:**

| Агент | Роль | Когда вызывается |
|---|---|---|
| **Subagent dev** | Imp-level code-fixer | Параллельно с code-reviewer на батчах |
| **code-reviewer** | Adversarial verify findings | После каждого dev-батча |
| **explore-agent** | Read-only поиск в кодовой базе | Перед planning |
| **plan-agent** | Architect-level планирование | Перед сложными feature-batch |
| **chrome-devtools** MCP | Smoke-тесты на prod | После каждого vercel --prod |
| **supabase** MCP | Schema-aware queries + migration apply | Когда нужен SQL Editor |
| **vercel** MCP | env vars, deploy, status | Каждый push |
| **deep-research** skill | Многоисточная факт-проверка для бизнес-вопросов | Pricing/competitive analysis |

**Что новое добавляется этим планом:**

| Agent flow | Триггер | Действие |
|---|---|---|
| `notify-waitlist.ts` (cron-style) | После set CP keys в Vercel env | Bulk-email 50+ leads с персонализированным CTA |
| Beta-feedback loop (manual) | После 5+ paid users | Subagent читает Google Sheet → выделяет 3 темы → пишет 1-page brief |
| SEO content auto-publish (manual) | После 1k visits на /blog | Subagent пишет 1 статью/неделю на основе search terms |

**Принцип Anthropic agents:** state stays in БД (Supabase), не в conversation context.
Subagents stateless, вызываются по триггерам. Не пытаемся слепить мегаагента —
лепим узкие быстрые workflows.

---

## Risk Register (свежие риски с этим планом)

| # | Риск | Likelihood | Impact | Митигация |
|---|---|---|---|---|
| R1 | CP отказывает в подключении (например, не нравится категория MCC) | M | H | Backup: Robokassa (1 день оформления, нет CP-strict KYC), уже plan B расписан в `BETA-OUTREACH` |
| R2 | waitlist собрал 200 emails, в день запуска все письма попали в спам | M | M | Resend → DKIM + SPF + DMARC настроить в DNS заранее, тест в mail-tester.com перед bulk |
| R3 | Bulk-email в день запуска перегрузил Vercel/Supabase | L | M | `notify-waitlist.ts` уже с rate-limit 10/сек и `--limit N` для постепенного rollout |
| R4 | TG-аккаунт worker'а забанили в первый день | M | M | RECOVERY гайд в `TG-WORKER-DEPLOY-ONELINER.md` — новая SIM, новый api_id за 30 минут, без потери данных |
| R5 | Mass refund > 25% на 3-й день | L | H | `/api/billing/webhook` уже логирует все refund-events, мониторим Sentry. Если триггер — stop sales, опрос причин |

---

## Где НУЖНО участие человека (в порядке приоритета)

### ❗ Сергей (всё что не требует Яны)

```
[ ] 1. Применить миграцию 009 на Supabase prod (5 мин)
       → Supabase → SQL Editor → вставить содержимое
         supabase/migrations/009_waitlist.sql → Run
       → Проверить: SELECT * FROM public.waitlist LIMIT 0; → OK
       → Без этого /waitlist Server Action будет валиться

[ ] 2. Promote изменения этой сессии на prod (5 мин)
       → git add -A && git commit -m "feat: waitlist + outreach pack"
       → git push origin careerpilot
       → vercel --prod (или дождаться auto-deploy)
       → Открыть /waitlist на prod — проверить что форма работает

[ ] 3. Купить vibeoffer.today на Reg.ru (10 мин)
       → См. docs/DOMAIN-CONFIG-careerpilot-ru.md шаг 1
       → Если .ru занят — .app или getvibeoffer.today

[ ] 4. Подвязать домен к Vercel (20 мин активных + 1-24ч DNS)
       → docs/DOMAIN-CONFIG-careerpilot-ru.md шаги 2-3

[ ] 5. Отправить уведомление в РКН (152-ФЗ ст. 22) (30 мин)
       → https://pd.rkn.gov.ru → Подать уведомление об обработке ПДн
       → Реквизиты: ИП Бирюкова, ИНН 010510099667
       → Категории ПДн: email, ФИО, телефон, CV-текст
       → Цель: оказание услуг карьерного сервиса
       → Поручение на обработку: Supabase (США? нет — Frankfurt EU) + Anthropic
       → Это ОБЯЗАТЕЛЬНО до приёма первых пользователей

[ ] 6. SIM + api_id/api_hash + TG worker deploy (25 мин)
       → docs/TG-WORKER-DEPLOY-ONELINER.md от начала до конца

[ ] 7. После одобрения CP — добавить ключи в Vercel + redeploy (10 мин)
       → vercel env add CLOUDPAYMENTS_PUBLIC_ID production
       → vercel env add CLOUDPAYMENTS_API_SECRET production
       → vercel --prod

[ ] 8. Запустить bulk-email из waitlist (15 мин)
       → vercel env add RESEND_API_KEY production (получить на resend.com — бесплатно 100/день)
       → tsx scripts/notify-waitlist.ts --dry-run --limit=5  (проверить)
       → tsx scripts/notify-waitlist.ts --limit=10            (rollout первой волной)
       → tsx scripts/notify-waitlist.ts                        (всем остальным)

[ ] 9. Отправить персональные TG/Whatsapp сообщения 20 знакомым из своего пула
       → docs/BETA-OUTREACH-TEMPLATES.md шаблон A
```

### ❗ Яна

```
[ ] 1. Сфотографировать паспорт стр. 2-3 (5 мин)
       → Для подачи CP. Отправить Сергею в любой месенджер.

[ ] 2. Подать заявку на merchant.cloudpayments.ru (45 мин)
       → docs/CP-SUBMISSION-PACKET-2026-06-02.md — копипаст всех полей
       → Загрузить 6 документов (5 уже есть, паспорт — из п. 1)
       → Email для подтверждения: work.ib@inbox.ru
       → Ждать одобрения 1-3 рабочих дня

[ ] 3. Подать заявку в АТОЛ Онлайн на онлайн-кассу (1 день)
       → https://online.atol.ru → Подключить ОФД
       → УСН доходы 6%, без НДС
       → Тариф «Касса в облаке» от ~₽2k/мес
       → Касса нужна по 54-ФЗ — без неё первый платёж может прилететь штраф

[ ] 4. Отправить персональные TG-сообщения 10 знакомым (30 мин)
       → docs/BETA-OUTREACH-TEMPLATES.md шаблон A
       → Особенно ценны: знакомые junior frontend/backend/designer/marketing
```

---

## Финальный summary

**Что собрано в этой сессии (всё на ветке `careerpilot`, готово к commit + push):**
- ✅ Waitlist E2E (миграция + страница + Server Action + клиентская форма)
- ✅ Onboarding graceful fallback в waitlist
- ✅ Лендинговый CTA в waitlist
- ✅ CP submission packet с cover letter
- ✅ Beta outreach templates (4 шаблона + список 30 имён к заполнению)
- ✅ Domain config guide (Reg.ru → Vercel → Yandex 360)
- ✅ TG worker 1-command deploy
- ✅ Bulk-email script `notify-waitlist.ts`
- ✅ Этот master plan

**Что зависит от человека (батч ниже):**
- 1 действие от Яны (паспорт → подача CP)
- 6 действий от Сергея (миграция, домен, РКН, TG worker, CP-ключи, outreach)

**Когда CP одобрит:** одна команда `vercel env add CLOUDPAYMENTS_*` + `vercel --prod`
+ `tsx scripts/notify-waitlist.ts`. От одобрения до первого платежа — часы, не дни.
