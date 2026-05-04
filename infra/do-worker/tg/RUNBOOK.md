# Telegram MTProto Worker — Deployment Runbook

End-to-end runbook for deploying the new `tg-worker` container alongside the existing `browserless` and `flowise` services on the CareerPilot DigitalOcean droplet.

**Estimated total time:** 15–20 minutes (excluding propagation waits).
**Risk level:** Low — `tg-worker` is additive; existing HH automation keeps running if anything fails.

---

## Section 1: Prerequisites

Before you start, make sure you have all of the following at hand:

**Accounts / access**
- SSH access to the droplet as `root` (or a sudoer). Check: `ssh root@<droplet-ip>` works.
- A working **dedicated** Telegram account (NOT your personal one — risk of ban). The account should already have joined all 10 default channels from Telegram Desktop.
- Access to https://my.telegram.org (logs in via that same Telegram account).
- Access to the Vercel dashboard for the CareerPilot project (Settings → Environment Variables).
- Access to the Supabase SQL editor for the prod project (for migration 003).

**Local tools**
- An SSH client (Windows Terminal / iTerm / PuTTY).
- `curl` for verification.

**Information you'll need to look up**
- Droplet IP and the existing `WORKER_DOMAIN` value (used for the HH worker).
- The dedicated TG account's phone number (with country code, e.g. `+79991234567`).
- 2FA password if you set one on the dedicated account (skip if none).

**Files / repo**
- The droplet already has `/opt/cp-worker/` cloned from the `careerpilot` branch. If not, clone it first.

---

## Section 2: Get Telegram credentials (5 min)

1. Open https://my.telegram.org in a browser. Log in with the **dedicated** Telegram account (phone + code sent in-app).
2. Click **API development tools**.
3. Fill the "Create new application" form:
   - **App title:** `CareerPilot`
   - **Short name:** `careerpilot`
   - **URL:** `https://careerpilot.app` (or any URL you control — not validated)
   - **Platform:** `Other`
   - **Description:** `Internal job-channel reader for CareerPilot.`
4. Click **Create application**.
5. On the resulting page, copy:
   - `App api_id` — a small integer (e.g. `12345678`)
   - `App api_hash` — a 32-character hex string (e.g. `0123456789abcdef0123456789abcdef`)

> **Warnings**
> - **Never share `api_hash`** or commit it. Anyone with it can impersonate this app.
> - You can only create **one** app per account from this UI. If you misconfigure it, contact Telegram support — there's no self-serve delete.
> - Keep the browser tab open until Section 3 is done.

---

## Section 3: Generate StringSession (3 min)

The MTProto session is generated **once, interactively** on the droplet. It does NOT expire unless you log out from another device.

```bash
# 1. SSH into droplet
ssh root@<droplet-ip>

# 2. Go to deployment dir and pull latest code
cd /opt/cp-worker
git fetch origin
git checkout careerpilot
git pull

# 3. Run auth.js inside a one-shot Node container (mounts the tg/ folder)
cd /opt/cp-worker/infra/do-worker/tg
docker run --rm -it \
  -e TG_MTPROTO_API_ID=<api_id_from_section_2> \
  -e TG_MTPROTO_API_HASH=<api_hash_from_section_2> \
  -v "$(pwd):/app" -w /app \
  node:20-alpine sh -c "npm install --omit=dev && node auth.js"
```

You'll be prompted in order:

1. `Phone number (with country code, e.g. +79991234567):` — enter the dedicated account's number.
2. `Code from Telegram:` — Telegram sends the login code **inside the app** (Telegram Desktop / mobile). Paste it.
3. `2FA password (skip if none):` — press Enter if not set, otherwise type and press Enter.

If successful, the script prints:

```
========== SAVE THIS SESSION STRING ==========
1ApDFSaQByY9...<very long base64 blob, ~350 chars>...kHnQ==
================================================
Add to .env as TG_MTPROTO_SESSION=<value>
```

**Copy the entire string into your clipboard right now — it is not stored anywhere on the droplet yet.**

---

## Section 4: Configure env vars (2 min)

Generate the shared HMAC secret on the droplet:

```bash
openssl rand -hex 32
# → e.g. 4f3c8e1a2b9d7f6e5c4b3a2918e7d6c5b4a39281706f5e4d3c2b1a0918273645
```

Edit (or create) `/opt/cp-worker/infra/do-worker/.env`:

```bash
nano /opt/cp-worker/infra/do-worker/.env
```

Add the following block (do NOT remove existing `BROWSERLESS_*` / `FLOWISE_*` / `WORKER_DOMAIN` lines):

```ini
# === Telegram MTProto worker ===
TG_MTPROTO_API_ID=12345678
TG_MTPROTO_API_HASH=0123456789abcdef0123456789abcdef
TG_MTPROTO_SESSION=1ApDFSaQByY9...kHnQ==
TG_WORKER_SECRET=4f3c8e1a2b9d7f6e5c4b3a2918e7d6c5b4a39281706f5e4d3c2b1a0918273645
TG_WORKER_DOMAIN=tg-<droplet-ip-dashed>.nip.io
# Optional: cap on validate's history pull; defaults to 30 in code
# TG_VALIDATE_LIMIT=30
```

Variable purpose:

| Var | Purpose |
|---|---|
| `TG_MTPROTO_API_ID` | App ID from my.telegram.org. |
| `TG_MTPROTO_API_HASH` | App hash from my.telegram.org. Secret. |
| `TG_MTPROTO_SESSION` | Persistent login session (output of `auth.js`). Secret. |
| `TG_WORKER_SECRET` | HMAC key for signing requests from Vercel. **Must match `WORKER_SHARED_SECRET` on Vercel side.** |
| `TG_WORKER_DOMAIN` | Public hostname Caddy will provision a Let's Encrypt cert for. Use `tg-<ip-with-dashes>.nip.io` (no DNS setup needed) or your own subdomain via A-record. |

Save (`Ctrl+O`, `Enter`, `Ctrl+X`). Set tight perms:

```bash
chmod 600 /opt/cp-worker/infra/do-worker/.env
```

> Replace `<droplet-ip-dashed>` with the IP using dashes — e.g. for `165.245.217.177` use `tg-165-245-217-177.nip.io`.

---

## Section 5: Deploy worker (2 min)

```bash
cd /opt/cp-worker/infra/do-worker
git pull                              # ensure docker-compose.yml + Caddyfile have the tg-worker block
docker compose build tg-worker        # first-time build of the Node image
docker compose up -d tg-worker        # starts the new container only
docker compose up -d caddy            # restart Caddy to pick up new vhost + provision TLS
docker compose logs --tail=30 tg-worker
```

Expected log output:

```
[tg-worker] Telegram MTProto connected
[tg-worker] HTTP listening on :3200
```

If you see `Missing required env vars` — the `.env` was not loaded; double-check `docker compose config | grep TG_` lists all four values.

If you see Caddy provisioning errors, give it 30–60 s for the ACME challenge to complete:

```bash
docker compose logs --tail=20 caddy
```

---

## Section 6: Verify worker reachability (1 min)

**From the droplet (internal):**

```bash
curl -s http://localhost:3200/health
# {"ok":true,"ts":1714000000000}
```

**From your laptop (external, through Caddy + TLS):**

```bash
curl -s https://tg-<droplet-ip-dashed>.nip.io/health
# {"ok":true,"ts":1714000000000}
```

**Signed scan test** (proves HMAC + MTProto round-trip):

```bash
SECRET="<paste TG_WORKER_SECRET>"
DOMAIN="tg-<droplet-ip-dashed>.nip.io"
TS=$(date +%s)
BODY='{"channels":[{"username":"g_jobbot","sinceMessageId":0}],"limitPerChannel":3}'
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

curl -s -X POST "https://${DOMAIN}/tg/scan" \
  -H "Content-Type: application/json" \
  -H "X-CP-Timestamp: $TS" \
  -H "X-CP-Signature: $SIG" \
  -d "$BODY" | head -c 400
# → {"channels":[{"username":"g_jobbot","status":"ok","messages":[...3 items...],"lastMessageId":...}]}
```

If you see `{"error":"bad_signature"}` — your local clock skew is >60 s, or you copied the secret wrong.

---

## Section 7: Configure Vercel env vars (2 min)

1. Open https://vercel.com → CareerPilot project → **Settings → Environment Variables**.
2. Add the following (Production + Preview, unless noted):

| Name | Value | Scope |
|---|---|---|
| `WORKER_BASE_URL` | `https://tg-<droplet-ip-dashed>.nip.io` | Production, Preview |
| `WORKER_SHARED_SECRET` | **same value as `TG_WORKER_SECRET` on droplet** | Production, Preview |
| `CRON_SECRET` | new value from `openssl rand -hex 32` | Production (required) |
| `ANTHROPIC_HAIKU_MODEL` | `claude-haiku-4-5` | Production, Preview (optional — defaults in code) |

3. Click **Save** on each.
4. Trigger a new deployment so the variables take effect: **Deployments → ... → Redeploy** on latest production deployment.

> `WORKER_SHARED_SECRET` (Vercel) and `TG_WORKER_SECRET` (droplet) MUST be byte-identical — they're both sides of the same HMAC. Mismatch = every scan returns 401.

---

## Section 8: Trigger first scan (1 min)

**Apply migration 003 first** (one-time, prod Supabase):

1. Open Supabase Studio → SQL Editor for the production project.
2. Open `supabase/migrations/003_tg_parser.sql` from the repo, paste the entire contents into a new query.
3. Click **Run**. Verify no errors.

**Then in the deployed app:**

1. Open `https://careerpilot-umber.vercel.app/settings`. You should see the 10 default channels seeded.
2. Open `https://careerpilot-umber.vercel.app/matches`.
3. Click the **"Сканировать TG"** button.

Expected result: within ~30 seconds, **5–30 new evaluations from `@g_jobbot`** appear in the matches list with `source='tg'` badge. Worker logs (`docker compose logs -f tg-worker`) show one `POST /tg/scan` line per click.

---

## Section 9: Troubleshooting common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Vercel route returns `worker_unreachable` / 502 | Caddy cert not yet issued, or droplet firewall blocks 443 | `docker compose logs caddy` — look for `obtained certificate`. Check `ufw status` — should allow 80, 443. |
| Every scan returns `bad_signature` (401) | `WORKER_SHARED_SECRET` ≠ `TG_WORKER_SECRET`, or laptop/server clock drift >60 s | Re-copy secret carefully on both sides. `timedatectl` on droplet should show NTP active. |
| Channel returns `{"status":"not_found"}` | Username typo or private channel | Check spelling. MTProto can only read **public** channels (those with `@username`). Private invite-link channels aren't supported. |
| Channel returns `{"status":"flood_wait"}` | Telegram throttled the reader account | Wait the duration in the error message (usually 30–300 s), then retry. The worker auto-paces but bursts can still trip it. |
| Logs spam `AuthKeyError` / `AUTH_KEY_UNREGISTERED` | Session was killed (logged out from another device, banned, or corrupted) | Re-run Section 3 to regenerate `TG_MTPROTO_SESSION`, update `.env`, `docker compose up -d tg-worker`. |
| Logs show `Missing required env vars` and container restarts in a loop | `.env` not loaded by compose | From `infra/do-worker`: `docker compose config` and grep for `TG_` — all four must show non-empty values. |
| `curl /health` returns `{"ok":false,...}` | MTProto disconnected (network blip) | Container will reconnect within ~30 s. If persistent, check egress to `*.telegram.org:443`. |

---

## Section 10: Rollback procedure

**If `tg-worker` breaks production (HH automation MUST keep working):**

```bash
ssh root@<droplet-ip>
cd /opt/cp-worker/infra/do-worker
docker compose stop tg-worker
# Browserless + Flowise + Caddy keep running. HH login/scan/apply unaffected.
```

The Vercel app will fail TG scans (graceful) but HH paths stay green. Optionally also clear `WORKER_BASE_URL` in Vercel to silence client-side retries.

**To remove the worker entirely:**

```bash
docker compose rm -sf tg-worker
docker image rm cp-worker-tg-worker
```

Then comment out the `tg-worker:` block in `docker-compose.yml` and the `{$TG_WORKER_DOMAIN}` block in `Caddyfile`, and `docker compose up -d caddy` to restart Caddy without the vhost.

**To revert migration 003** (only if it caused a prod incident — very unlikely, schema is additive):

```sql
-- run in Supabase SQL editor against prod
DROP FUNCTION IF EXISTS public.tg_seed_default_channels(uuid);
DROP FUNCTION IF EXISTS public.tg_channels_set_updated_at() CASCADE;
DROP TABLE IF EXISTS public.tg_scan_log;
DROP TABLE IF EXISTS public.tg_channels;
ALTER TABLE public.user_evaluations
  DROP COLUMN IF EXISTS tg_channel,
  DROP COLUMN IF EXISTS tg_message_id,
  DROP COLUMN IF EXISTS canonical_key,
  DROP COLUMN IF EXISTS duplicate_of_key;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tg_seeded_at;
DROP INDEX IF EXISTS public.user_evaluations_canonical_idx;
DROP INDEX IF EXISTS public.user_evaluations_tg_channel_idx;
```

After rollback, redeploy Vercel from a commit prior to the TG feature merge to remove client-side calls to `/api/tg/*`.

---

**Done.** The worker is running, scans cost ~$0 incremental on the existing droplet, and you can disable it any time with one `docker compose stop` without touching HH automation.
