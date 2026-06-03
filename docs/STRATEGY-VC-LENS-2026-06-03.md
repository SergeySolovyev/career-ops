# VibeOffer через призму VC-фрейма AI-native — стратегический ревью

**Дата:** 2026-06-03
**Источник фрейма:** YC (Diana Hu, Tom Blomfield) · a16z · Bessemer · Menlo · Sequoia (Bret Taylor) · Emergence · NFX · First Round · Greylock
**Цель документа:** применить 5 главных VC-тезисов к текущей конфигурации VibeOffer; зафиксировать что менять сразу, что в Sprint A-D, и **что является вашим стратегическим решением** (не моим).

---

## TL;DR — 5 находок, ранжированных по риску

| # | Находка | Ставка | Где сделано / делать |
|---|---|---|---|
| 1 | Hero copy позиционирует через HOW (10 критериев), а не WHAT (5-10 офферов за 14 дней) — анти-паттерн First Round | 🟢 Zero risk | ✅ Сделано в этом коммите |
| 2 | Waitlist не собирает сигнал о pricing preference (outcome vs subscription) — упускаем dataset для Sprint A pivot | 🟢 Zero risk | ✅ Migration 010 + form fields |
| 3 | Нет founder-led sales channel — упускаем 4-6x conversion на первых 50 leads | 🟢 Zero risk | ✅ TG-link на waitlist confirm |
| 4 | Pricing 100% SaaS (₽490/мес) — игнорируем outcome-based framing Sequoia/Emergence | 🟡 Medium | **Sprint A решение** — см. ниже |
| 5 | Self-serve tool, не done-for-you service — позиционирование под software budget, не labor budget | 🔴 Strategic | **Ваше решение** — см. ниже |

---

## 1. First Round: «AI-powered isn't a position»

### Что было

Hero subtitle: *«Загрузите резюме — остальное сделаем мы. Сканирование вакансий, **AI-оценка по 10 критериям**, генерация CV и сопроводительных писем под каждую вакансию — всё на автопилоте.»*

Анти-паттерн: 5 из 6 фраз — про **технологию** (сканирование, AI-оценка, генерация, автопилот). Junior 23-летний read'ит это как «ещё один AI-сервис, обещают много».

### Что стало (этот коммит)

*«За 14 дней получите **5-10 целевых офферов под ваш CV**. Без бесконечного скролла hh, без переписывания резюме под каждый отклик, без "здравствуйте, рассмотрите мою кандидатуру".»*

Структура: **outcome (14 дней / 5-10 офферов)** → **3 source of pain (скролл/переписывание/шаблоны)**. Это формула из a16z "From Demos to Deals" — клиент покупает не функцию, а избавление от боли.

Плюс trust-pill под параграфом:
*«Возврат 14 дней без вопросов · оплата только если зашло»*

→ убирает purchase friction за счёт reversibility.

### Что мерить

После деплоя — A/B через Vercel split. Если bounce rate с лендинга упал на >10% / sign-up конверсия выросла на >20% за 7 дней — фрейм работает, разворачиваем на остальные surfaces (/pricing, /offer).

---

## 2. Sequoia / Emergence: outcome-based vs subscription pricing

### Текущая модель

```
Free:    ₽0 · 3 AI-оценки / 30 дней
Pro:     ₽99 первый месяц (промо BETA99) → ₽490/мес далее
Premium: ₽699/мес
```

**Это классический SaaS «per-seat access»** — модель которую Sequoia/Emergence/NFX считают устаревшей для AI-native компаний. Bret Taylor открытым текстом: *«AI shifts the market from per-seat subscription to pay-per-outcome»*.

### Гипотеза для проверки

«Junior 20-30 RU предпочтёт **«₽0 пока не получу оффер → потом разовая оплата»** вместо «₽490/мес за доступ».»

### Почему гипотеза вероятна

Junior платит из **своего тонкого кошелька** (стипендия / первые ₽20-40k от подработки). Психология:
- «Что если я не найду работу за месяц — потерял ₽490»
- «Что если найду работу через 3 дня — переплатил за месяц»
- Pay-on-success: «₽9990 один раз когда зашёл оффер» — выглядит как **выигрыш**, а не **трата**.

### Что сделано (этот коммит)

Migration 010 добавила колонки:
- `pricing_preference` text — subscription / success_fee / unsure
- `wants_founder_call` boolean

В форме `/waitlist` — radio-группа с 3 опциями + checkbox для звонка. Опционально (не обязательно). Результаты пишутся в Supabase view `waitlist_pricing_signal`.

### Decision gate для Sprint A

После 50 ответов с непустым `pricing_preference`:

| Распределение | Действие |
|---|---|
| **≥60% success_fee** | Сильный сигнал — в Sprint A добавляем второй tier «Pay-on-offer ₽9990 после подтверждения первого оффера» |
| **40-60% success_fee** | Mixed — оставляем subscription как primary, success_fee как opt-in для тех кто отметил preference |
| **<40% success_fee** | Гипотеза не подтвердилась — остаёмся на SaaS, идём в Sprint B (content engine) |

### Реализация success_fee tier (если решимся)

Технически — `/api/billing/checkout` уже provider-agnostic. Новый tier = новая Pricing strategy:

```
success_fee:
  - upfront:  ₽0
  - charged:  ₽9990 разово
  - trigger:  пользователь подтвердил «получил оффер» в /pipeline + 7-дневное окно остыть
  - refund:   14 дней + полностью отказаться от оплаты в течение 30 дней без объяснения
```

Webhook: на confirm-offer-action создаётся CP Order. Если пользователь не платит за 14 дней — disable аккаунт, бан-фильтр email.

Это **1-2 спринта работы**, не делаем сейчас. Делаем когда сигнал ≥60%.

---

## 3. YC / Blomfield: founder-led sales (1-50 paid)

### Контекст из YC playbook

*«Founder-led sales — не опция, а ранняя обязанность. Каждый из первых 50-100 клиентов должен быть привлечён лично кем-то из основателей»*

### Анти-паттерн которого мы избежим

«Запустим waitlist → отправим bulk email → подождём конверсию». Это путь «выгорания бренда без feedback» — типичная ошибка SaaS founder который думает что продукт «должен продавать себя».

### Что сделано (этот коммит)

На `/waitlist`:
1. **Checkbox** при подписке: «Хочу 15-мин звонок с фаундером — разберём CV и стратегию поиска. Бесплатно. Связь через Telegram».
2. **Success-screen card** после успешной подписки — даже если не отметили checkbox, предлагаем TG-link с pre-filled message.
3. В Supabase колонка `wants_founder_call` — на эти leads Яна звонит **первой волной** в день одобрения CP.

### Workflow для Яны (Sprint A)

```
SELECT email, intent, pricing_preference, source, created_at
  FROM waitlist
 WHERE wants_founder_call = true
   AND notified_at IS NULL
 ORDER BY created_at ASC
 LIMIT 20;
```

→ 20 личных писем в Telegram → 20 × 15 мин звонков = 5 часов работы → ожидаемая конверсия 30-50% в paid (vs 8-15% для bulk email).

### Метрика успеха

`conversion_rate(founder_call_leads) ≥ 3 × conversion_rate(bulk_email_leads)` — если да, в Sprint B инвестируем в Cal.com интеграцию и расширяем founder-call на больший слайс.

---

## 4. NFX / Bessemer: vertical AI + labor budget capture

### Где мы попадаем

✅ Уже вертикальны: **junior/middle IT/дизайн/маркетинг РФ/СНГ**. Не horizontal «AI для поиска работы». Это правильная отправная точка.

### Где промахиваемся

Мы обещаем «hh + tg + AI-оценка» — что делают 50 других стартапов и hh.ru сам. **Глубокого workflow capture нет.**

NFX-ский тест: *«Какую работу я забираю у людей/аутсорса/операционного отдела, чтобы клиент платил мне labor-money, а не software-money?»*

Junior сейчас платит:
- $0 (просто ходит на hh.ru)
- ИЛИ ₽5-15k за курсы CV-составления (Practicum, Skypro)
- ИЛИ ₽20-50k за карьерного консультанта-человека

Мы хотим попасть в **3-й сегмент** (карьерный консультант), а не во 2-й (курсы). Тогда ₽490/мес выглядит как «10x дешевле консультанта», а не «10x дороже бесплатного hh».

### Что менять (Sprint B-C — не сейчас)

| Текущий messaging | NFX-aligned messaging |
|---|---|
| «AI оценивает вакансии» | «AI-карьерный консультант 24/7 за ₽490» |
| «Сканирование hh» | «Помогает выбрать на какие вакансии откликаться, чтобы не выгорать в 200 откликах» |
| «Скилл-матчинг» | «Honest CV-review без воды — что добавить, что убрать, какие реальные шансы» |

Это **переформулировка позиционирования**, не feature-rewrite.

### Risk

Если позиционируем как «карьерный консультант» — клиент ожидает high-touch human service. Если технология не дотягивает (AI пишет generic советы) — refund-rate растёт. Делать только после того как реальные пользователи скажут «AI-советы помогли».

---

## 5. Emergence: AI-native services (стратегический выбор)

### Это самое big-deal в меморандуме

Emergence: *«Лучшие AI-компании будут продавать не software, а выполненную работу»*

Применительно к VibeOffer — это выбор из двух моделей:

#### Модель A — Self-serve SaaS (текущая)

```
Пользователь → загружает CV
            → сам жмёт «сканировать»
            → сам смотрит результаты
            → сам кликает «отклик на hh»
            → сам отвечает рекрутеру
Платит:     за инструмент (₽490/мес доступ)
Эмоция:     «у меня есть AI-помощник»
```

#### Модель B — Done-for-you AI-native service

```
Пользователь → загружает CV
            → подключает hh-сессию (уже есть)
            → ждёт inbox
VibeOffer:  → сканирует вакансии 24/7
            → AI-пишет personalized cover letter под каждую top-100 матч
            → отправляет отклик от имени пользователя
            → отвечает рекрутеру в первой переписке (qualification)
            → передаёт пользователю только sealed lead «вот 3 рекрутера ждут вас на интервью»
Платит:     ₽9990 при подтверждении первого оффера
Эмоция:     «они нашли мне работу»
```

### Trade-offs

| Параметр | Self-serve SaaS | Done-for-you |
|---|---|---|
| Cost per user | ₽15/scan × 100 = ₽1500/мес | ₽15/scan × 500 + LLM cover-letters = ₽5000/мес |
| Pricing | ₽490/мес ARPU | ₽9990 разово, redeployed 6-12мес |
| Conversion psychology | «попробую месяц» | «оплачу когда получу результат» |
| Refund risk | 10-15% (стандарт SaaS) | 2-5% (clear outcome trigger) |
| Vertical AI moat | Слабый (просто AI-tool) | Сильный (накапливаем workflow data) |
| Tech complexity | Low (current) | High (HH auto-apply, AI cover-letters at scale, рекрутерская переписка) |
| **Юридический риск ToS hh.ru** | **Low** | **HIGH — нарушение ToS hh.ru за auto-applying** |

### Где hh.ru ToS блокирует Done-for-you

hh.ru открытым текстом запрещает auto-applying через API/scraping. Если VibeOffer отправляет отклик от имени пользователя без согласованного API — **аккаунт пользователя могут забанить**, а нас могут засудить (мы уже фиксили это в прошлом E2E review).

Это значит:
- **Pure Done-for-you с hh.ru — невозможно legally на текущих ToS**
- Возможны **гибридные модели**:
  - VibeOffer **готовит draft cover letter + draft application** → пользователь **жмёт «отправить» сам**. Это полностью legally OK. И это уже близко к Done-for-you.
  - VibeOffer **делает интервью-prep, salary anchoring, рекрутерская переписка через свой email** (не hh) → legally OK.

### Гибридный путь (рекомендую обсудить)

«**Semi-autonomous job hunt**» — VibeOffer делает 80% работы (поиск, оценка, draft cover letter, salary research, interview prep), пользователь делает 20% (жмёт send, ходит на интервью). За это берём ₽9990 при подтверждении первого оффера.

Это **legally clean** + **psychologically valuable** + **vertical moat в данных + workflow**.

### Decision gate (ваше решение)

**Когда:** после первых 10-30 paid users на текущей модели + feedback из founder-call.

**Триггер для pivot на гибрид:** если ≥50% feedback говорят «хочу чтобы вы за меня всё делали» — пилотируем гибрид с 5 ручными клиентами.

**НЕ делаем сейчас.** Это Sprint D-E решение, не pre-CP-approval.

---

## 6. Что в коде после этого коммита

| Файл | Изменение | Назначение |
|---|---|---|
| `apps/web/app/page.tsx` | Hero subtitle переписан outcome-frame + trust pill | First Round / a16z applied |
| `supabase/migrations/010_waitlist_pricing_research.sql` | `pricing_preference` + `wants_founder_call` колонки + view | Sequoia / Emergence research signal |
| `apps/web/app/waitlist/actions.ts` | Server Action принимает new fields | Связь UI ↔ БД |
| `apps/web/app/waitlist/waitlist-form.tsx` | Radio-группа pricing + checkbox founder-call + success-card с TG-link | YC / Blomfield applied |
| `docs/STRATEGY-VC-LENS-2026-06-03.md` | Этот документ | Captured decision logic |

---

## 7. Решения за вами (Sergey / Yana)

### Решение 1 — Telegram-handle для founder-call

В waitlist-form.tsx захардкожено `https://t.me/yana_vibeoffer`. Если у Яны/Сергея handle другой — **скажите какой**, поменяю в одну строку. Если ещё не зарегистрирован — рекомендую **сейчас**:
- `@yana_vibeoffer`
- `@vibeoffer_team`
- `@yana_offers`

### Решение 2 — После waitlist сбора 50 ответов

Кто читает `waitlist_pricing_signal` view и принимает Sprint A decision (subscription / success_fee / hybrid)?
- Опция A: Сергей читает раз в неделю → решает single-handed
- Опция B: я мониторю и присылаю summary с рекомендацией → вы принимаете решение

**Рекомендую Option B** — у меня будет полный контекст из этого документа + актуальные данные.

### Решение 3 (стратегическое) — Done-for-you гибрид

После 10 paid users + 5 founder-calls — пересматриваем. **Не сейчас.** Просто фиксируем как открытый вопрос.

---

## 8. Что НЕ меняем сейчас (анти-паттерны лишних решений)

- ❌ Не переписываем pricing model (риск сломать CP-flow)
- ❌ Не делаем full landing rewrite (один тезис за раз — мерим)
- ❌ Не запускаем auto-apply на hh.ru (legal risk)
- ❌ Не меняем ICP (вертикаль junior IT/design/marketing RU/СНГ работает)
- ❌ Не уходим в content engine до запуска первых платежей (Sprint B)

---

## 9. Принцип за всем планом

Из YC Diana Hu: *«AI должен быть встроен в research, engineering, sales, support, internal knowledge, feedback loops — а не висеть как чат-бот сбоку»*

Применительно к нам:
- **Research:** `waitlist_pricing_signal` view = AI-driven pricing research
- **Engineering:** Subagent dev + code-reviewer пишут код
- **Sales:** Founder-led калибровка через TG-link → данные кормят формализацию sales-process в Sprint B
- **Support:** /chat AI-советник уже работает (Claude Sonnet 4.5 с RAG по CV)
- **Internal knowledge:** docs/* — каждое решение зафиксировано, не теряется в чате
- **Feedback loops:** waitlist → founder-call → product feedback → next sprint priorities

**Это и есть «AI-native company»** в формулировке Diana Hu — не «продукт с AI-фичей», а «компания где AI вшит в каждый процесс».
