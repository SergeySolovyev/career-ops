# CareerPilot Telegram Worker

Lightweight HTTP service that reads public Telegram channels via MTProto
(Telethon-style, but Node — uses [`gramjs`](https://gram.js.org)).

## Why a separate worker?

- MTProto needs a persistent TCP connection — Vercel serverless (60-300s) can't host it.
- One shared "reader" account scales to all CareerPilot users (passive read-only behavior).
- Lives next to Browserless on the same Droplet (4GB Frankfurt) — no extra hosting cost.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/tg/scan` | Fetch new messages from N channels (sinceMessageId per ch) |
| `POST` | `/tg/validate` | Check if channel exists + recent activity |

All POST endpoints require HMAC-SHA256 over `<X-CP-Timestamp>.<rawBody>`
using `TG_WORKER_SECRET` (matches `WORKER_SHARED_SECRET` on Vercel side).

## One-time setup

### 1. Get Telegram API credentials

1. Open https://my.telegram.org → **API development tools**
2. Create new application (any name, e.g. "CareerPilot")
3. Save `api_id` (number) + `api_hash` (32-char hex)

### 2. Create a dedicated reader account

**Don't use your personal account** — Telegram may ban it for automated reads.

- Buy a cheap SIM (~500₽) or use a virtual number service that supports SMS
- Register a new Telegram account using that number from a fresh device
- **From Telegram Desktop on the new account**: pre-join the 10 default channels
  (`@g_jobbot`, `@forfrontend`, `@hh_devjobs`, `@itmozg`, `@itjobsrussia`,
  `@qajobs`, `@devops_jobs`, `@datasciencejobs_ru`, `@designhuntersjobs`,
  `@product_management_jobs`). Plus any custom channels users may add later.

### 3. Generate persistent session

```bash
ssh root@<droplet-ip>
cd /opt/cp-worker/tg

# Set credentials in shell (don't commit!)
export TG_MTPROTO_API_ID=12345
export TG_MTPROTO_API_HASH=<32-char hash>

# Run the auth flow
docker run --rm -it \
  -e TG_MTPROTO_API_ID -e TG_MTPROTO_API_HASH \
  -v $(pwd):/app -w /app node:20-alpine sh -c \
  "npm install && node auth.js"
# Will prompt for phone, code, optional 2FA — copy the StringSession output
```

Save the printed session string to `.env` as `TG_MTPROTO_SESSION=<value>`.
This session does NOT expire unless you log out from another device.

### 4. Generate worker shared secret

```bash
openssl rand -hex 32
```

Use the same value on both sides:
- `TG_WORKER_SECRET` in worker `.env`
- `WORKER_SHARED_SECRET` in Vercel env vars

### 5. Deploy alongside Browserless

The TG worker is added as a third service in the existing
`infra/do-worker/docker-compose.yml`. After updating `.env`:

```bash
ssh root@<droplet-ip>
cd /opt/cp-worker
git pull
docker compose up -d tg-worker
docker compose logs -f tg-worker      # watch for "MTProto connected"
```

Caddy will route `https://tg-<droplet-ip-dashed>.nip.io/*` to the worker.

### 6. Configure Vercel env

```
WORKER_BASE_URL=https://tg-165-245-217-177.nip.io
WORKER_SHARED_SECRET=<same as TG_WORKER_SECRET>
```

## Environment

| Var | Required | Notes |
|---|---|---|
| `TG_MTPROTO_API_ID` | yes | from my.telegram.org |
| `TG_MTPROTO_API_HASH` | yes | from my.telegram.org |
| `TG_MTPROTO_SESSION` | yes | output of `auth.js` |
| `TG_WORKER_SECRET` | yes | shared HMAC secret |
| `PORT` | no | default 3200 |

## Verification

```bash
# Health
curl https://tg-<droplet-ip>.nip.io/health
# {"ok":true,"ts":1714000000000}

# Validate (needs HMAC — easier from Vercel via /api/tg/validate)
```

## Operational notes

- **Rate limits**: gramjs auto-retries `FLOOD_WAIT` errors. We additionally cap
  channel concurrency at 5 + add 200ms delay between channels. Practical
  throughput: ~30 messages/sec — plenty for 100+ users.
- **Account ban**: rare for purely passive reads. Mitigate by:
  - Pre-joining channels from Telegram Desktop (not via `messages.joinChannel` API)
  - Avoiding `getDialogs` calls (looks like enumeration)
  - Keeping a backup SIM ready
- **Session corruption**: if `MTProto disconnected` appears repeatedly,
  re-run `auth.js` to regenerate StringSession.
