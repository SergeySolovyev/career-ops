# Sprint 2 — Pivot UX для масс-маркета РФ/СНГ

**Status:** 📐 Design (not yet started)
**Estimated effort:** 1 неделя (5 рабочих дней)
**Predecessor:** Sprint 1 (TG-Channels Parser) — committed, awaits prod migration

---

## 1. Why this sprint

VibeOffer v1 был под Директорский ICP (CDO/Head of AI, ₽500K–1.5M). После Sprint 1 у нас два источника вакансий — но UI/copy всё ещё «директорский». Пользователь решил **полный pivot на масс-маркет 20–30 лет, IT/digital в городах РФ/СНГ**, готовых платить ₽300–500/мес ("капуччино pricing"). Это требует переписать tone, scoring criteria и onboarding под новую аудиторию.

**Без Sprint 2** текущая аудитория увидит лендинг с "Для Director / VP · FinTech · AI/ML · Банки" и сразу bounce'нет — это **conversion killer**.

---

## 2. ICP (target persona)

| Параметр | Значение |
|---|---|
| Возраст | 20–30 лет |
| Локация | Москва / СПб / Казань / Новосибирск / Екатеринбург + регионы |
| Опыт | Junior (0–2y) / Middle (2–5y) |
| Профессии | Frontend / Backend / QA / DevOps / Data Analyst / Product / UX / Marketing |
| Зарплата текущая | ₽60K–250K |
| Зарплата желаемая | +30–50% |
| Готовность платить | ₽300–500/мес ("капуччино") |
| Главная боль | "Час в день впустую на скроллинг hh + 50 нерелевантных tg-каналов" |
| Предпочитаемый канал | Telegram > веб > email |
| Time-to-value ожидание | 5 минут от signup до первой релевантной вакансии |

---

## 3. Что меняем (по слоям)

### 3.1 Landing (`apps/web/app/page.tsx`)

**Сейчас:**
- Pill: "Для Director / VP · FinTech · AI/ML · Банки"
- Hero: "AI найдёт работу за вас" (нейтрально, оставляем)
- Canvas-анимация показывает: Director ML / Head of AI / VP Product
- Pricing: $0/$19/$39 (USD)
- Тестимониалы: Director, ML Platform · Head of AI, FinTech (₽1.1–1.5M)

**После Sprint 2:**
- Pill: **"Для junior / middle · IT, дизайн, маркетинг · РФ + СНГ"**
- Hero: оставляем (универсально)
- Canvas: показывать **Frontend Junior / Middle Backend / Data Analyst / UX-дизайнер** со зарплатами 80–250К
- Pricing: **₽0 / ₽299 / ₽699** (RUB) — вилка под "капуччино"
- Тестимониалы: Junior Frontend (Москва, ₽120К) · Middle DevOps (СПб, ₽220К) · Data Analyst (Казань, удалёнка ₽180К)
- Под hero — **новая proof tile**: "TG-каналы: g_jobbot, devjobs_ru, +8 ещё" ← USP

### 3.2 Onboarding (`apps/web/app/(app)/onboarding/page.tsx`)

**Сейчас:** 3 шага — CV / Roles / AI первая рекомендация. Требует **загрузить CV** на step 1 — это блокер для junior без оформленного CV.

**После Sprint 2:** Опциональный CV (можно пропустить, появится "Используем чек-лист скиллов"). Новый flow:
1. **Skills checklist** (вместо CV для тех у кого его нет): 50 чекбоксов сгруппированных по доменам (Frontend / Backend / DevOps / Data / Design / Marketing). User отмечает — формируется псевдо-CV для AI scoring.
2. **Target roles + город + удалёнка checkbox**
3. **Подключить HH или сразу TG (skip HH allowed)**
4. **AI первая рекомендация** (как сейчас)

### 3.3 Scoring criteria (`packages/core/src/evaluator/pre-screen.ts`)

**Сейчас:** `SENIORITY_PATTERNS` regex дает +0.5 score за слова "директор", "head of", "VP", "CDO". Это перекошено под Sprint 0 директорский ICP.

**После Sprint 2:** Новые pattern weights:

| Pattern | Score impact | Why |
|---|---|---|
| `junior|стажер|младший|trainee` | +0.5 для junior ICP | reverse seniority bonus |
| `middle|средний` | +0.3 для middle ICP | |
| `обучение|менторство|курс|стажировка` | +0.4 | важно для junior |
| `удалённо|remote|relocation` | +0.3 для не-MSK | |
| `стажировка|без опыта` | +0.5 если ICP=trainee | |
| `senior|lead|head|principal` | **−0.3** | overqualified для junior ICP |
| `от 5 лет|опыт 5+` | −0.5 | overqualified требование |

ICP должен быть в `user_profiles.icp_segment` (новое поле): `junior` / `middle` / `senior`. На основе этого pattern weights адаптируются.

### 3.4 AI prompt (`packages/core/src/evaluator/ai-evaluate.ts`)

**Сейчас:** Generic "Career advisor evaluating job vacancies".

**После Sprint 2:** Учесть ICP в system prompt:
> "You are evaluating fit for a {icp_segment} candidate in IT/digital RU market. Consider: career growth opportunities, mentorship availability, work-from-home options, fair junior/middle salary band ({80–250K} for {junior/middle}), no overqualification requirements."

### 3.5 Pricing (`apps/web/app/page.tsx` → pricing block)

| Тариф | Сейчас | После |
|---|---|---|
| Free | $0 / 3 evals/mo | **₽0 / 5 evals/mo** (повысить чтобы дать понюхать) |
| Pro | $19 / unlimited evals | **₽299 / 100 evals/mo + Telegram-уведомления** |
| Premium | $39 / + auto-apply | **₽699 / unlimited + auto-apply + 5 TG-каналов сверх 10 default** |

---

## 4. Файлы которые меняем (8 шт.)

| Файл | Изменения | Примерно строк |
|---|---|---|
| `apps/web/app/page.tsx` | Landing copy + pricing + тестимониалы + canvas data | ~80 |
| `apps/web/app/(app)/onboarding/page.tsx` | Опциональный CV + skills checklist | ~150 |
| `packages/core/src/evaluator/pre-screen.ts` | New pattern weights, ICP-aware | ~30 |
| `packages/core/src/evaluator/ai-evaluate.ts` | ICP в system prompt | ~10 |
| `apps/web/app/(app)/dashboard/page.tsx` | "Доброе утро, {name}" — copy под junior tone | ~5 |
| `apps/web/components/onboarding/SkillsChecklist.tsx` (NEW) | 50-checkbox component с группировкой | ~120 |
| `apps/web/lib/skills-catalog.ts` (NEW) | Структура: 6 domains × 8–10 skills | ~80 |
| `supabase/migrations/004_pivot_ux.sql` (NEW) | `user_profiles.icp_segment + skills[] + city + remote_ok` | ~30 |

**~500 строк нового/изменённого кода. Comparable к Sprint 1.**

---

## 5. Migration 004 (черновик)

```sql
-- Sprint 2: Pivot UX — масс-маркет ICP fields on user_profiles
alter table public.user_profiles add column if not exists icp_segment text
  default 'junior' check (icp_segment in ('junior', 'middle', 'senior'));
alter table public.user_profiles add column if not exists skills text[] default array[]::text[];
alter table public.user_profiles add column if not exists city text;
alter table public.user_profiles add column if not exists remote_ok boolean default true;

create index if not exists user_profiles_city_idx on public.user_profiles(city);
create index if not exists user_profiles_icp_idx on public.user_profiles(icp_segment);
```

**Рисков нет:** все колонки nullable с дефолтами. Существующие user_profiles без новых полей продолжат работать (icp_segment по умолчанию 'junior' — самый широкий паттерн).

---

## 6. Acceptance criteria

- [ ] Открыть `/` без авторизации — pill сменился на "Для junior / middle"
- [ ] Pricing block показывает ₽0 / ₽299 / ₽699 (не USD)
- [ ] Canvas-анимация показывает junior/middle вакансии (не директорские)
- [ ] `/signup` → onboarding step 1 опциональный — есть кнопка "Использовать чек-лист скиллов"
- [ ] Skills checklist открывает 6 доменов с 8–10 чекбоксами в каждом
- [ ] При Junior ICP: вакансия "Senior Backend, опыт 5+" получает score < 2.5 (предыдущая версия — 4.0+)
- [ ] При Junior ICP: вакансия "Junior Frontend в Mokka, обучение, удалёнка" получает score > 4.0
- [ ] Build зелёный, regression check 8×200+3×307 на проде

---

## 7. Risks

| Риск | Митигация |
|---|---|
| Существующие Director-юзеры (Сергей) видят junior tone | Demo Сергея сохраняется, его профиль остаётся `icp_segment='senior'` — copy адаптируется |
| Перерендер pricing block ломает SEO | Новые цены в RUB → лучше для RU поиска (целевой рынок) |
| Skills checklist слишком длинный → bounce | Default expanded только Frontend; остальные collapsed; counter "выбрано 5/8" внизу |
| AI prompt с ICP даёт хуже general-purpose оценки | A/B: 50% юзеров на новый prompt, 50% на старый; смотрим precision на test fixtures (можно reuse Sprint 1's vitest infrastructure) |

---

## 8. Out of scope этого Sprint

- Multi-language (English version) — отдельный Sprint
- Mobile native app — на 2027
- Job alerts через email — Sprint 4 (Hardening)
- Resume builder (создаём CV из skills checklist) — отдельная итерация после Sprint 4

---

## 9. Что готов делать прямо сейчас

Я могу автономно стартовать:

1. **Migration 004** SQL (показываю → твой OK → apply через MCP когда OAuth восстановится)
2. **Skills catalog** (`apps/web/lib/skills-catalog.ts`) — структура данных, 6×10 = 60 скиллов
3. **SkillsChecklist** компонент — UI с группировкой
4. **Refactor `pre-screen.ts`** — добавить ICP-aware patterns + unit tests на 10 кейсов
5. **Landing copy refactor** (page.tsx) — pill + pricing + тестимониалы + canvas data

**Без user gates** могу довести до build-зелёный + commit на preview. **Promote в production** требует твой OK.

---

**Что делать дальше?** Жду решения:
- A) **Сразу всё (5 файлов)** — как Sprint 1, через 1-2 дня preview готов
- B) **По одному файлу** с твоим review между ними (медленнее, но контролируемо)
- C) **Сначала только pre-screen.ts + ai-evaluate.ts** (backend) — без UI, посмотреть как новые scoring работают на текущих 109 evaluations
