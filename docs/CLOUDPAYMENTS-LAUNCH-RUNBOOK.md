# CloudPayments · Launch Runbook

**Purpose:** от «ИП Бирюкова готова» до **первой ₽99 в ВТБ счёт**.

**Owner:** Сергей / Яна. Claude помогает на всех технических шагах.

---

## 0. Pre-flight — что уже готово

### Технически (на проде сегодня)
- [x] `/offer` — с реквизитами ИП Бирюковой, CloudPayments указан как платёжный сервис
- [x] `/privacy` — 152-ФЗ compliant
- [x] `/refund` — Refund Policy (новое, требование CloudPayments)
- [x] Signup checkbox «принимаю Оферту + Privacy + Refund» (не pre-checked, по требованию РКН)
- [x] Footer с полными реквизитами ИП (ИНН, ОГРНИП, адрес, email)
- [x] `/api/billing/checkout` — создаёт hosted Pay URL через `/orders/create`
- [x] `/api/billing/webhook` — HMAC-SHA256 verify + Pay/Recurrent dispatch
- [x] Subscription auto-renewal — встроена в первый платёж (рекуррент)
- [x] Migration 007 (provider-agnostic columns) — в проде
- [x] Domain-ready: смена домена = 1 env var

### Что нужно сделать СЕЙЧАС (до подачи заявки)
- [ ] **Применить migration 008** (consent_accepted_at) — открыть Supabase SQL Editor, paste:
  ```sql
  alter table public.user_profiles
    add column if not exists consent_accepted_at timestamptz;
  ```
- [ ] **Купить домен vibeoffer.today** (или альтернативу) на reg.ru / nic.ru (~₽200/год)
- [ ] **Привязать домен к Vercel** (5 мин через dashboard или REST API)
- [ ] **NEXT_PUBLIC_SITE_URL** обновить в Vercel env (1 мин)

---

## 1. Подача заявки в CloudPayments (Сергей/Яна)

### 1.1. Регистрация
1. Открыть https://cloudpayments.ru/account/registration
2. Тип организации: **Индивидуальный предприниматель**
3. Email Яны + телефон + код подтверждения

### 1.2. Заполнение анкеты магазина
| Поле | Значение |
|---|---|
| Название магазина | VibeOffer |
| Сайт | https://vibeoffer.today (или vercel.app до миграции) |
| Категория MCC | 7372 — Computer Software Stores / 5734 — Computer Software |
| Описание услуги | «AI-помощник для поиска работы. Месячная подписка с автопродлением. Помощь в составлении персонализированных резюме и cover letter, AI-оценка вакансий по 10 критериям.» |
| Средний чек | 299 ₽ |
| Прогноз оборота / месяц | от 30 000 ₽ (~100 платящих × ₽299) |
| Способы оплаты | Карты МИР, Visa, Mastercard, СБП, T-Pay |
| Рекуррентные платежи | **ДА** (важно отметить) |

### 1.3. Реквизиты ИП Бирюковой
| Поле | Значение |
|---|---|
| ФИО | Бирюкова Яна Владимировна |
| ИНН | 010510099667 |
| ОГРНИП | 326774600321772 |
| Адрес регистрации | 109316, г. Москва, Волгоградский пр-т, д. 32/5 к. 4, кв. 1407А |
| Расчётный счёт | 40802810100810373215 |
| Банк | Банк ВТБ (ПАО), Филиал «Центральный» |
| БИК | 044525411 |
| Корр. счёт | 30101810145250000411 |
| Налогообложение | УСН доходы |

### 1.4. Загрузка документов (из `D:\ИП Бирюкова\`)
- Паспорт (стр. 2-3 + регистрация)
- Лист записи ЕГРИП
- ИНН свидетельство
- Уведомление об открытии счёта в ВТБ

### 1.5. Ссылки на юридические страницы
Указать в анкете URL:
- Оферта: https://vibeoffer.today/offer (или vercel.app/offer)
- Privacy: https://vibeoffer.today/privacy
- Refund: https://vibeoffer.today/refund

---

## 2. Подключение АТОЛ Онлайн (54-ФЗ касса)

CloudPayments **сама не делает чеки** — нужна интегрированная облачная касса.

### 2.1. Регистрация на ATOL
1. https://online.atol.ru/ → «Подключить»
2. Тариф для нового ИП: **3 месяца бесплатно** (далее ~₽1500/мес)
3. Реквизиты те же что у CloudPayments

### 2.2. Связка ATOL ↔ CloudPayments
1. В кабинете ATOL: создать «Магазин» с теми же реквизитами
2. Получить **ATOL_LOGIN + ATOL_PASSWORD + ATOL_GROUP_CODE**
3. В кабинете CloudPayments → Настройки → 54-ФЗ → Внешняя касса → АТОЛ
4. Ввести 3 параметра выше

Теперь каждый платёж через CloudPayments → автоматически чек в ФНС через АТОЛ.

---

## 3. Уведомление Роскомнадзора (152-ФЗ ст. 22)

**Обязательно** — штраф до ₽300k за необработанное.

1. Открыть https://pd.rkn.gov.ru/operators-registry/notification/
2. Заполнить форму как «новый оператор»:
   - Оператор: ИП Бирюкова Я.В.
   - Цели обработки: «Оказание услуг по подписочной модели сервиса VibeOffer»
   - Категории субъектов: «пользователи сервиса VibeOffer»
   - Категории ПДн: ФИО, email, история взаимодействия с сервисом, IP-адрес
   - Срок обработки: до отзыва согласия
   - Подача через ЛК или почтой
3. **30 дней рассмотрения** → запись в реестре операторов

---

## 4. После одобрения CloudPayments (~1-3 дня)

В личном кабинете CP → Настройки → Сайты → выбрать наш магазин → API:
- **Public ID** (формат `pk_xxxxxxxxxxxxxxxxxxxxxxxxx`)
- **API Password** (секрет)

Скинуть эти 2 значения Claude → залью в Vercel env:
```
CLOUDPAYMENTS_PUBLIC_ID = pk_xxx
CLOUDPAYMENTS_API_PASSWORD = xxx
```

Также в CP кабинете → Уведомления:
- URL для всех событий: `https://vibeoffer.today/api/billing/webhook`
- Метод: POST
- Включить события: Pay, Fail, Refund, Cancel, Recurrent

---

## 5. ₽1 sandbox test (Claude делает ~10 мин)

После получения ключей:
1. Sign in как `maria.test+sandbox@careerpilot.dev`
2. Open `/?intent=pro&promo=BETA99` → Pro → /signup → galочка → /onboarding
3. Fill CV (350+ chars) + цели junior → Step 3 AI advice
4. Click **«Оформить за ₽99 →»** → redirect на `pay.cloudpayments.ru/p/...`
5. На форме CP: **test card `4012 8888 8888 1881`** (Visa test), CVC `123`, expiry `12/30`
6. Expect: redirect на `/billing/success?order=<uid>-<ts>-<rand>`
7. Verify в Supabase:
   ```sql
   select user_id, tier, status, provider, provider_order_id,
          provider_recurring_token, current_period_start, current_period_end
   from public.subscriptions order by updated_at desc limit 3;
   ```
   Expected: `status='active'`, `provider='cloudpayments'`, `provider_recurring_token` populated.
8. /matches — banner должен показать «Pro · безлимит» (green pill).

---

## 6. Live launch (после sandbox green)

В Vercel env переключить `CLOUDPAYMENTS_API_PASSWORD` с test_* на live_*.

Trigger redeploy. Прогнать тот же тест с реальной картой ₽99 (твой возврат потом).

Деньги падают в ВТБ счёт в течение **T+1 рабочий день**.

---

## Failure modes + rollback

| Симптом | Причина | Fix |
|---|---|---|
| `/api/billing/checkout` возвращает 502 | CP credentials missing/wrong | Re-check Vercel env, redeploy |
| Init returns `Success: false` | Магазин ещё не активен в CP | Подождать одобрения / связаться с менеджером CP |
| Webhook возвращает 401 на реальный CP callback | HMAC mismatch — API_PASSWORD env не совпадает с CP | Скопировать password ровно из кабинета CP |
| `subscriptions.status` стоит `pending` после success | Webhook не сработал — URL неверный в CP кабинете | Проверить URL в CP → Уведомления |
| Чек не пришёл клиенту | АТОЛ не привязан или сертификат истёк | CP кабинет → 54-ФЗ → проверить connection |

**Полный rollback**: убрать `CLOUDPAYMENTS_PUBLIC_ID` в Vercel env → 502 на checkout → новые оплаты не идут. Существующие подписки не трогаются.

---

## Numbers to track в первые 48h

```sql
-- Платящие
select count(*) from subscriptions where status='active';

-- Брошенные checkouts (>0 = CTA работает, но юзеры бросают на форме CP)
select count(*) from subscriptions
where status='pending' and updated_at > now() - interval '1 hour';

-- Mix Pro/Premium
select tier, count(*) from subscriptions
where status='active' group by tier;

-- Conversion: signups → платящие
select
  (select count(*) from auth.users where created_at > now() - interval '24 hours') as new_signups,
  (select count(*) from subscriptions where status='active' and updated_at > now() - interval '24 hours') as new_paid;
```

Sentry — следить за тегом `billing/*`.

End of runbook.
