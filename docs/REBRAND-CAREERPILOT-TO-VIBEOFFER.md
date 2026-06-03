# Rebrand: CareerPilot → VibeOffer

**Дата:** 2026-06-03
**Тип:** Brand/product naming change. **Юр. лицо не меняется** (ИП Бирюкова Я.В.).
**Trigger:** домен careerpilot.ru недоступен, vibeoffer.today свободен и резонирует с ICP (20-30 RU, junior IT/design/marketing).

---

## Что изменилось

| Layer | Старое | Новое |
|---|---|---|
| Product brand (user-facing) | CareerPilot | **VibeOffer** |
| Primary domain | careerpilot-umber.vercel.app | **vibeoffer.today** |
| Marketing taglines | «AI-карьерный советник» | «AI находит работу где совпадёт вайб» |
| Email FROM | careerpilot.app | support@vibeoffer.today |
| Telegram bot brand | @careerpilot_bot | @vibeoffer_today_bot (план) |
| TG channel | — | @vibeoffer_today (план) |

---

## Что НЕ изменилось

| Layer | Значение | Почему оставлено |
|---|---|---|
| Юр. лицо | ИП Бирюкова Я.В., ИНН 010510099667 | Юридический объект, не меняется |
| Банковские реквизиты | ВТБ р/с 40802810100810373215 | — |
| Vercel project name | `careerpilot` | Внутреннее, не отображается |
| Git ветка | `careerpilot` | Internal |
| npm package alias | `@careerpilot/core` | Внутренние импорты, миграция = высокий риск, нулевая польза |
| localStorage key | `careerpilot:user-profile` | Миграция сотрёт CV existing demo-юзеров |
| Custom event name | `careerpilot:toast` | Внутреннее |
| Vercel preview URL pattern | `careerpilot-*.vercel.app` | Генерится Vercel'ом по project name |
| CSRF allowlist regex | matches preview URLs выше | Совместимость с превью-деплоями |

---

## Inventory изменений в коде

**Файлов изменено:** 34
**Замен `CareerPilot` → `VibeOffer`:** 73
**Замен `careerpilot-umber.vercel.app` → `vibeoffer.today`:** 22
**Замен `careerpilot.ru/.app` → `vibeoffer.today`:** 49

**Файл переименован:**
- `docs/DOMAIN-CONFIG-careerpilot-ru.md` → `docs/DOMAIN-CONFIG-vibeoffer-today.md`

**Новые артефакты:**
- `docs/BRAND-VIBEOFFER-LANDING-COPY.md` — draft новой landing-копии (готов к применению)
- `docs/REBRAND-CAREERPILOT-TO-VIBEOFFER.md` (этот файл)

---

## Что НЕ переделано в этом коммите (sprint после CP-launch)

| # | Что | Почему отложено |
|---|---|---|
| 1 | Полная переработка landing copy из `BRAND-VIBEOFFER-LANDING-COPY.md` | Текущий копи работает, новый — улучшение, не блокер. Применить после первого фидбэка от 10 платящих |
| 2 | Логотип VibeOffer (SVG wordmark) | Дизайн-задача. Пока используем text-only «VibeOffer» с Sparkles иконкой как раньше |
| 3 | Favicon | Аналогично |
| 4 | OG-image (соц-превью) | Сгенерирую через `next/og` в отдельном коммите |
| 5 | Migration localStorage `careerpilot:user-profile` → `vibeoffer:user-profile` | Сломает существующие demo-кабинеты. Делаем когда demo очистим |
| 6 | Rename npm package `@careerpilot/core` → `@vibeoffer/core` | Большая работа, внутренний impact, нулевой brand-impact |

---

## CP-submission импликации

**До этого коммита** CP-anketa должна была подаваться под:
- Название магазина: «CareerPilot»
- Сайт: careerpilot-umber.vercel.app
- Cover letter упоминал «CareerPilot»

**После этого коммита:**
- Название магазина: **«VibeOffer»**
- Сайт: **vibeoffer.today** (после покупки и DNS propagation)
- Cover letter обновлён автоматически в `docs/CP-SUBMISSION-PACKET-2026-06-02.md`

**Важно для Яны:** анкета подаётся ОДИН раз под VibeOffer. Никаких rebrand'ов после этого, никаких re-submission, никакой задержки одобрения.

**Юр. документы на сайте** (оферта, политика конфиденциальности, политика возврата) — все 3 файла обновлены: ИП Бирюкова осталась, продукт стал VibeOffer.

---

## Roadmap пост-rebrand

### Phase 1 — Сразу (от 30 минут до 24 часов)

```
Сергей:
[ ] 1. Купить vibeoffer.today на Reg.ru или Beget (~₽2 100, 10 мин)
[ ] 2. Подвязать к Vercel:
       → vercel domains add vibeoffer.today careerpilot
       → или в UI: https://vercel.com/<team>/careerpilot/settings/domains
[ ] 3. Обновить Vercel env var: NEXT_PUBLIC_SITE_URL=https://vibeoffer.today
[ ] 4. vercel --prod (или auto-deploy через push)
[ ] 5. После SSL установки на Vercel — `curl https://vibeoffer.today` → 200 OK
[ ] 6. Зарезервировать TG handles:
       → @vibeoffer_today
       → @vibeoffer_app (backup)
       → @vibeoffer_inc (backup)
[ ] 7. Зарезервировать соцсети:
       → instagram.com/vibeoffer.today
       → x.com/vibeoffer_today
       → vk.com/vibeoffer
       → tiktok.com/@vibeoffer.today

Яна:
[ ] 8. Подача CP-анкеты под VibeOffer (см. CP-SUBMISSION-PACKET-2026-06-02.md)
```

### Phase 2 — После одобрения CP + первых 50 платящих юзеров

```
[ ] 9.  Применить landing copy из BRAND-VIBEOFFER-LANDING-COPY.md
[ ] 10. Создать логотип-wordmark VibeOffer (SVG)
[ ] 11. Сгенерировать OG-image через next/og
[ ] 12. Telegram bot — переименовать в @vibeoffer_today_bot, поменять описание
[ ] 13. Email-кампания «мы обновили имя» (если есть legacy юзеры)
```

### Phase 3 — Через 6 месяцев

```
[ ] 14. Запросить @vibeoffer через Telegram Support (если inactive 6+ мес)
[ ] 15. Migrate npm package @careerpilot/core → @vibeoffer/core (отдельный спринт)
[ ] 16. Rename Vercel project careerpilot → vibeoffer (только если нужно для team optics)
```

---

## Rollback plan (если внезапно нужно)

Эта миграция — **plain sed-replace**. Откат:

```bash
git revert <commit-hash>
git push origin careerpilot
```

Бизнес-impact отката: 0. Юр. лицо не меняется, реквизиты не меняются, CP-анкета не подавалась пока — можно подать под старым брендом. **Окно безболезненного отката закроется** в момент когда:
1. Яна нажмёт «submit» на CP-anketa под VibeOffer
2. Зарегистрируется vibeoffer.today
3. Первый юзер заплатит под брендом VibeOffer

До этих 3 событий — откат бесплатный.
