# Подключение домена vibeoffer.today — pошаговый гайд для Сергея

**Состояние на 2026-06-08:** домен `vibeoffer.today` + `www.vibeoffer.today` уже
добавлены в Vercel project `careerpilot` (через `vercel domains add`).
**Vercel ждёт DNS verification.**

Осталось 3 шага. Все 3 ваши, я уже сделал всё что мог автономно.

---

## Шаг 1 — Купить vibeoffer.today (10 мин · ₽2-3k)

`.today` это global TLD, поэтому регистратор любой. Из того что у вас уже есть
опыт с другими доменами в Vercel (`atlas-pay.online`, `essive.pro` и т.д.):

| Регистратор | Цена .today | Карты РФ | Совет |
|---|---|---|---|
| **Namecheap** | $25-30 первый год · $35 продление | работают исторически | **рекомендую** — простой UI, удобный DNS |
| **Porkbun** | $25 первый год · $30 продление | работают через VPN | дешевле, но UI спартанский |
| **Cloudflare Registrar** | $22 (at-cost) | да | требует домен уже на CF DNS — не наш кейс |
| **Reg.ru** | возможно есть в расширенном каталоге | да | если показывает «нет в зонах» — пропускаем |

**Действие:**
1. https://www.namecheap.com/domains/registration/results/?domain=vibeoffer.today
2. Add to cart → Checkout
3. **ВКЛЮЧИТЬ** «WhoisGuard» / «PrivacyGuard» (бесплатно у Namecheap) — иначе
   email Сергея торчит в публичном whois
4. Срок 2 года для лучшего SEO-trust signal
5. Payment

---

## Шаг 2 — DNS-записи у регистратора (5 мин)

В DNS-панели Namecheap (или Porkbun, или вашего регистратора) добавить **одну**
A-запись:

```
Тип    Имя     Значение         TTL
A      @       76.76.21.21      Automatic (300-3600)
```

Где `@` = корневой домен (vibeoffer.today).

**Для `www.vibeoffer.today`** (опционально, можно пропустить):

```
Тип       Имя     Значение                  TTL
CNAME     www     cname.vercel-dns.com      Automatic
```

**Сохранить.** DNS propagation 10 минут — 24 часа.

**Альтернатива** (для тех кто хочет полный контроль через Vercel DNS):
вместо A-записи поменять nameservers на:
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Но рекомендую **A-запись** — проще, обратимее, не теряем регистраторский DNS UI.

---

## Шаг 3 — Финализация (1 минута, скрипт)

После того как DNS пропагировался (Vercel пришлёт email «vibeoffer.today verified» —
обычно 10-30 мин), запустить:

```bash
cd "C:\Yandex.Disk\Yandex.Disk\! work -  i found job\careerpilot-git"
bash scripts/finalize-domain.sh
```

Скрипт автоматически:
1. ✅ Проверит DNS резолв
2. ✅ Обновит `NEXT_PUBLIC_SITE_URL` в Vercel env (Production)
3. ✅ Триггернёт `vercel --prod` redeploy
4. ✅ Smoke-test `https://vibeoffer.today` → 200 OK

---

## Что я уже сделал автономно (commit будет ниже)

| ✅ Действие | Команда / Результат |
|---|---|
| Vercel CLI auth verified | `vercel whoami` → `sergeysolovyev` |
| Project state checked | `careerpilot` linked в `sergeys-projects-04c8641c` |
| Env vars audited | 16 env vars OK · `NEXT_PUBLIC_SITE_URL` уже есть, поменяем на этапе финализации |
| **Domain attached to project** | `vercel domains add vibeoffer.today` → ✅ Success |
| **www subdomain attached** | `vercel domains add www.vibeoffer.today` → ✅ Success |
| Finalize-script написан | `scripts/finalize-domain.sh` — DNS check + env swap + redeploy + smoke-test |
| Этот гайд обновлён | `docs/DOMAIN-CONFIG-vibeoffer-today.md` |

---

## Что НЕ нужно делать (защита от типичных ошибок)

❌ **НЕ менять `NEXT_PUBLIC_SITE_URL` до DNS verification** — иначе сайт сломается
для редиректов/писем на 1-24ч пока DNS не пропагируется. Скрипт делает это
**после** проверки.

❌ **НЕ покупать «бесплатные SSL»** или «email-почту» вдогонку — у Vercel SSL
автоматический (Let's Encrypt), почту настроим отдельно через Yandex 360 / Resend.

❌ **НЕ выбирать .ru вместо .today** — vibeoffer.today уже добавлен в Vercel
project, переключение на .ru = пересборка половины брендинга.

❌ **НЕ выбирать длинный срок регистрации > 2 лет** — для .today TLD продление
$35/год может сильно вырасти; safer to renew yearly после первого года.

---

## После регистрации (Sprint A items, не блокеры)

Когда сайт заработает с vibeoffer.today:

1. **CloudPayments webhook update** — в merchant.cloudpayments.ru →
   Сайты → URL уведомлений: `https://vibeoffer.today/api/billing/webhook`
2. **Email setup (для Resend bulk-email из waitlist):**
   - Resend → Domains → Add vibeoffer.today
   - Resend выдаст 3 DNS-записи (SPF, DKIM, return-path) — добавить у регистратора
   - mail-tester.com проверка на 9/10+ score
3. **(опц.) Yandex 360 для support@vibeoffer.today** — если хотим
   человеческий support inbox. До 5 ящиков бесплатно.

---

**Резюме:** **3 действия от вас (~15 минут активных + ожидание DNS).**
Я сделал всё остальное — домен в Vercel project, скрипт финализации готов.
