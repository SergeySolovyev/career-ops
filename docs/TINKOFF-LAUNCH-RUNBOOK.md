# Tinkoff Касса · Launch Runbook

**Purpose:** every step to go from "Tinkoff just approved my ИП" to "first ₽99 in my ВТБ account".

**Owner:** Sergey. Claude assists at every step that doesn't touch the bank or the cardholder.

**Estimated time:** 20–30 min from credentials in hand to first ₽1 sandbox payment verified.

---

## 0. Pre-flight (already done — do not redo)

- [x] Migration `006_subscriptions` applied to Supabase prod
- [x] `lib/tinkoff-billing.ts` shipped (Init / verify webhook / sign)
- [x] `/api/billing/checkout` returns 401 anon, 502 without keys (live on prod)
- [x] `/api/billing/webhook` returns 401 anon (live on prod)
- [x] `/billing/success` and `/billing/fail` render (live on prod)
- [x] Landing CTAs point to `/signup?intent=pro&promo=BETA99` and `/signup?intent=premium`
- [x] Signup → onboarding intent passthrough (whitelisted)
- [x] Onboarding Step 3 emerald CTA "Оформить за ₽99 →" (Pro) / "₽699 →" (Premium)
- [x] `/matches` QuotaBanner — Free counter + amber upgrade-card at quota

---

## 1. Once Tinkoff approves (Sergey)

You'll receive in lk.tinkoff.ru/business → Касса → Магазины:

1. **TerminalKey** (e.g. `1234567890ABC`) — public-ish identifier
2. **Password** — SECRET. Treat like a private key. Don't paste anywhere with logs.
3. Two terminals: **boevoy** (production) and **demo** (sandbox)

> **Critical:** start with DEMO terminal. Real money flows only after sandbox passes.

---

## 2. Vercel env vars (Sergey + Claude, ~5 min)

We've burned trying both CLI and REST API. The working path:

**Option A — REST API direct (preferred, no install):**

```powershell
# Replace the two ##REPLACE## values
$env:VERCEL_TOKEN = "##REPLACE_VERCEL_PERSONAL_TOKEN##"  # from vercel.com/account/tokens
$h = @{ Authorization = "Bearer $env:VERCEL_TOKEN"; "Content-Type" = "application/json" }
$projectId = "prj_6CyWea6QEJ7foNAcaCH5ydlzDmmz"
$teamId = "team_RP269AmEtfC5vO0jdFbpaotV"

# 1) TINKOFF_TERMINAL_KEY (DEMO terminal first)
$body1 = @{ key="TINKOFF_TERMINAL_KEY"; value="##REPLACE_DEMO_TERMINAL##"; type="encrypted"; target=@("production","preview","development") } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Headers $h -Body $body1

# 2) TINKOFF_PASSWORD (DEMO password)
$body2 = @{ key="TINKOFF_PASSWORD"; value="##REPLACE_DEMO_PASSWORD##"; type="encrypted"; target=@("production","preview","development") } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Headers $h -Body $body2

# 3) TINKOFF_API_BASE = sandbox URL (so we don't hit production by mistake)
$body3 = @{ key="TINKOFF_API_BASE"; value="https://rest-api-test.tinkoff.ru/v2"; type="plain"; target=@("production","preview","development") } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Headers $h -Body $body3
```

**Option B — dashboard:** vercel.com → careerpilot → Settings → Environment Variables → Add. Same 3 keys.

**Then trigger redeploy** (env vars apply on next build):

```powershell
# Get latest deploy and re-trigger
$last = (Invoke-RestMethod -Uri "https://api.vercel.com/v6/deployments?projectId=$projectId&teamId=$teamId&limit=1" -Headers $h).deployments[0]
$body = @{ name="careerpilot"; deploymentId=$last.uid; target="production" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "https://api.vercel.com/v13/deployments?teamId=$teamId" -Headers $h -Body $body
```

---

## 3. Webhook URL → register in Tinkoff dashboard (Sergey, 2 min)

In lk.tinkoff.ru/business → Касса → Магазины → ваш магазин (DEMO) → Настройки → Уведомления:

- **URL:** `https://careerpilot-umber.vercel.app/api/billing/webhook`
- **Метод:** `POST`
- **Тип:** `JSON`
- **События:** все (`AUTHORIZED`, `CONFIRMED`, `REJECTED`, `REFUNDED`)

Sign the webhook check with the SAME Password as Init. (Our `verifyWebhookSignature` reads it from env.)

---

## 4. ₽1 sandbox test (Claude does this, ~10 min)

Once env is set + webhook is registered, I'll execute:

1. **Sign in to prod** with a real beta tester email (you, or maria.test+sandbox@careerpilot.dev)
2. **Open** `/?intent=pro&promo=BETA99` → click Pro → /signup → confirm → /onboarding
3. **Fill** Step 1 (CV paste, 200 chars min) + Step 2 (Frontend Developer, junior, Moscow, remote OK)
4. **Generate** Step 3 first AI advice (just for journey completeness)
5. **Click** "Оформить за ₽99 →" — expect redirect to `securepay.tinkoff.ru` (or sandbox equivalent)
6. **On Tinkoff form:** use test card `2200 7700 0000 0024` (CVC `123`, expiry `12/30`)
7. **Expect:** redirect back to `/billing/success?order=<uid>-<ts>-<rand>`
8. **In Supabase** SQL editor — verify the row landed:
   ```sql
   select user_id, tier, status, tinkoff_order_id, tinkoff_rebill_id,
          tinkoff_payment_id, current_period_start, current_period_end, updated_at
   from public.subscriptions
   order by updated_at desc
   limit 3;
   ```
   Expected: `tier='pro'`, `status='active'`, `tinkoff_rebill_id` populated (NOT NULL — needed for recurring), `current_period_end ≈ now + 1 month`.
9. **Test the user-side gate:** open `/matches` — banner should say "Pro · безлимит" (green pill).
10. **Test the recurring path** later: re-charge via Charge API with `tinkoff_rebill_id`.

---

## 5. Promotion to live terminal (Sergey, 2 min)

After sandbox green:

1. In Vercel env, change `TINKOFF_TERMINAL_KEY` + `TINKOFF_PASSWORD` to **boevoy** (production) values
2. Change `TINKOFF_API_BASE` to `https://securepay.tinkoff.ru/v2` (or just unset — that's the default)
3. Re-register webhook URL on the boevoy магазин (same URL, same events)
4. Re-deploy via dashboard or REST API

---

## 6. First real payment smoke (15 min after promote)

Same flow as ₽1 sandbox, but with your own real card. ₽99 leaves your card and lands in your ИП ВТБ счёт within 1 banking day (Tinkoff payouts T+1).

---

## Failure modes + rollback

| Symptom | Cause | Fix |
|---|---|---|
| `/api/billing/checkout` returns 502 | `TINKOFF_TERMINAL_KEY` missing or wrong | Re-set env, redeploy |
| `/api/billing/webhook` returns 401 on real Tinkoff callback | HMAC mismatch — Password env doesn't match Tinkoff terminal | Compare in lk.tinkoff.ru and Vercel; must match exactly |
| Init returns `Success: false` with `ErrorCode 100` | Webhook URL not registered in Tinkoff | Add NotificationURL in Tinkoff dashboard |
| `subscriptions.status` stays `pending` after success redirect | Webhook didn't fire (URL wrong) OR signature failed (Password wrong) | Check Vercel function logs for `[billing/webhook]` |
| Want to refund test ₽1 | Tinkoff dashboard → Платежи → найти → "Отменить операцию" | — |

**Total rollback:** unset `TINKOFF_TERMINAL_KEY` env var → /api/billing/checkout returns 502 → no new payments. Existing `subscriptions` rows untouched. Users see "Не удалось создать платёж" toast (already handled in onboarding `setCheckoutError`).

---

## Numbers to track in first 48h

- `select count(*) from subscriptions where status='active'` — paying customers
- `select count(*) from subscriptions where status='pending' and created_at > now() - interval '1 hour'` — abandoned checkouts (>0 means CTA reaches users but they bail at Tinkoff form)
- `select tier, count(*) from subscriptions where status='active' group by tier` — Pro vs Premium mix
- Sentry: any `billing/*` errors → investigate within 30 min

End of runbook.
