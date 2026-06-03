# Подключение домена vibeoffer.today к Vercel + Yandex 360 mail

**Время на выполнение:** 30 минут активных действий + до 24ч DNS propagation.

---

## 1. Покупка домена (10 минут)

**Рекомендация:** регистрируем у Reg.ru или Beget — оба принимают карты РФ,
дешевле чем Namecheap для .ru.

| Регистратор | Цена .ru/год | Карта РФ | DNS-панель |
|---|---|---|---|
| Reg.ru | ₽199 | да | удобная |
| Beget | ₽179 | да | очень удобная |
| RU-CENTER | ₽290 | да | бюрократическая |

**Действие Сергея:**
1. https://www.reg.ru/domain/new/ → ввести `vibeoffer.today`
2. Если занят — план B: `vibeoffer.today` (₽1490/год у Reg.ru) или
   `getvibeoffer.today` (₽199/год).
3. Оформить с защитой персональных данных whois (₽199 поверх) — иначе
   email Сергея публично торчит в whois.

---

## 2. Vercel — добавление домена (5 минут)

```bash
# Через Vercel CLI (если установлен):
vercel domains add vibeoffer.today careerpilot

# Или в web UI:
# 1. https://vercel.com/<team>/careerpilot/settings/domains
# 2. Add Domain → vibeoffer.today
# 3. Vercel покажет DNS-записи (см. п. 3)
```

После добавления Vercel выдаст одну из двух конфигураций:
- **Nameservers (рекомендую):** делегируете весь DNS Vercel'у — единая панель
- **CNAME/A records:** оставляете DNS у регистратора, прописываете 2 записи

---

## 3. DNS-записи (выбрать один сценарий)

### Сценарий A — делегирование nameservers Vercel'у (рекомендую)

В панели Reg.ru → DNS-серверы:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Сохранить. Propagation 1-24ч. После — Vercel сам подымает SSL.

**Минус:** Yandex 360 mail настройка усложнится (нужно прописать MX через
Vercel DNS API). Если не хочется — сценарий B.

### Сценарий B — DNS остаётся у регистратора (проще для почты)

В DNS-панели Reg.ru добавить:

```
Тип    Имя    Значение                           TTL
A      @      76.76.21.21                        3600
CNAME  www    cname.vercel-dns.com.              3600
```

И для почты Yandex 360 (если выбираете эту почту — см. п. 4):

```
MX     @      mx.yandex.net.                     10  3600
TXT    @      v=spf1 redirect=_spf.yandex.net    3600
TXT    mail._domainkey   <значение из Yandex>    3600
CNAME  mail   domain.mail.yandex.net.            3600
```

Yandex даст точные значения в момент подключения домена.

---

## 4. Почта поддержки support@vibeoffer.today (15 минут)

### Вариант 1 — Yandex 360 для бизнеса (рекомендую)

- https://360.yandex.ru/business → Подключить домен
- Цена: 0₽ до 5 пользователей, далее 199₽/мес/юзер
- Создать ящики: `support@vibeoffer.today`, `info@vibeoffer.today`,
  `yana@vibeoffer.today` (опц.)
- DNS-записи прописать у регистратора (см. п. 3 B)
- Подтвердить домен через TXT-запись (Yandex выдаст)

### Вариант 2 — MailRu для бизнеса (альтернатива)

Аналогично, https://biz.mail.ru. Меньше фич, но если что-то с Yandex не сложилось.

### Вариант 3 — временно email-forwarding через Reg.ru (бесплатно)

В DNS Reg.ru есть «Email-форвардинг»: всё что приходит на `support@vibeoffer.today`
→ переотправляется на личный email Сергея. Без отправки исходящих — только приём.
**Подходит для первых 100 пользователей**, дальше переводимся на 360.

---

## 5. Vercel env vars — обновить после подключения домена

```bash
vercel env add NEXT_PUBLIC_SITE_URL production
# Значение: https://vibeoffer.today

vercel env add NEXT_PUBLIC_SITE_URL preview
# Значение: https://vibeoffer.today

# В offer/page.tsx, refund/page.tsx, privacy/page.tsx есть жёсткие
# упоминания vibeoffer.today — заменить на vibeoffer.today:
git grep -l "vibeoffer.today" apps/web/
# Найти и заменить — это один коммит
```

Также:
- `apps/web/lib/cloudpayments.ts` — проверить `successUrl` использует `NEXT_PUBLIC_SITE_URL`
- `apps/web/app/api/billing/checkout/route.ts` — там `baseUrl` берётся из env, OK
- `apps/web/app/api/billing/webhook/route.ts` — webhook URL отдаётся в CP анкете,
  обновить там же: `https://vibeoffer.today/api/billing/webhook`

После обновления env vars:
```bash
vercel --prod
```

---

## 6. Финальный чек-лист (после propagation)

- [ ] `curl -I https://vibeoffer.today` → 200 OK с заголовком от Vercel
- [ ] `curl -I https://vibeoffer.today/offer` → 200, оферта показывается
- [ ] DNS check: https://dnschecker.org/?#A/vibeoffer.today → зелёные галки в РФ
- [ ] SSL: https://www.ssllabs.com/ssltest/analyze.html?d=vibeoffer.today → A+
- [ ] Email test: написать на `support@vibeoffer.today`, дошло до целевого ящика
- [ ] В CP личном кабинете обновить: site=vibeoffer.today, webhook=vibeoffer.today/api/billing/webhook

---

**Стоимость пакета подключения:** ~₽400/год домен + ~₽199/мес (Yandex 360 с 6-го юзера).
До 5 юзеров почта бесплатна.
