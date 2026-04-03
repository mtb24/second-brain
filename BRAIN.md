# BRAIN.md — Ken's Second Brain System

Last updated: 2026-04-02

---

## Overview

A personal operating system / second brain running on a DigitalOcean VPS. Ingests thoughts, logs agent activity, runs a trading strategy tournament, and provides a Mission Control dashboard with an embedded AI agent (Cortex).

---

## Repositories

| Repo | What | Local | VPS |
|------|------|-------|-----|
| [github.com/mtb24/kendowney.com](https://github.com/mtb24/kendowney.com) | Personal site, **K2DS** design system, **Design Lock** demo (public) | `~/Sites/kendowney.com/` | `~/brain/personal-site/` (Docker, port **4174**) |
| [github.com/mtb24/second-brain](https://github.com/mtb24/second-brain) | Infrastructure (tournament, ingest, MCP, mission-control) | `~/Sites/SecondBrain/` | `~/brain/` |
| [github.com/mtb24/honest-fit-assessment](https://github.com/mtb24/honest-fit-assessment) | Legacy HFA prototype (**`master`** branch) | `~/Sites/AI/HonestFitAssessment/` | `~/brain/honest-fit/` optional; **not** served publicly — product is **[honestfit.ai](https://honestfit.ai)** on **64.23.165.78** |

---

## Sites live

| URL | What | Notes |
|-----|------|-------|
| **kendowney.com** | Personal site | Docker **4174**, Nginx reverse proxy |
| **kendowney.com/design-lock** | Design Lock demo | Contract validation (LLM output → validate → render) |
| **storybook.kendowney.com** | K2DS Storybook | Static/component library; Nginx upstream as configured on VPS |
| **mission.kendowney.com** | Mission Control | Docker **4173**; **app-level** auth (username + bcrypt + HMAC session cookie — not Nginx basic auth) |
| **brain.kendowney.com** | Ingest API + MCP | If still enabled — see **Nginx Config** |

**Decommissioned:** **`honestfit.kendowney.com`** — Nginx vhost removed; not a live site. **Honest Fit** (current product) is **https://honestfit.ai** on dedicated VPS **64.23.165.78** (see **github.com/mtb24/honestfit**).

---

## Server

| Item | Value |
|------|-------|
| Provider | DigitalOcean |
| IP | 147.182.240.24 |
| User | `brain` |
| Project root | `~/brain/` (`/home/brain/brain/`) |
| OS | Ubuntu 24.04, 4GB RAM / 2 vCPU |

### DNS & TLS (Cloudflare)

| Item | Detail |
|------|--------|
| **DNS** | **`kendowney.com`** is authoritative in **Cloudflare** (zone migrated from DigitalOcean). The **DigitalOcean DNS zone for kendowney.com can be deleted** — it is no longer authoritative. |
| **Proxy** | **Orange cloud** (proxied) on records that should pass through Cloudflare. |
| **SSL mode** | **Full (Strict)** in the Cloudflare SSL/TLS settings. |
| **Origin cert** | Wildcard **`*.kendowney.com`** (covers subdomains) — PEM/key on the brain VPS: **`/etc/ssl/cloudflare/kendowney.com.pem`** and **`/etc/ssl/cloudflare/kendowney.com.key`**. **No Certbot** on this server (removed). |
| **Email** | **Cloudflare Email Routing:** **`ken@kendowney.com`** → Gmail when configured. |

### SSH keys

| Role | Key / identity |
|------|----------------|
| Mac → GitHub | `ssh-ed25519` …`f50n` — `ken@kendowney.com` (added to GitHub account) |
| VPS → GitHub (deploy) | `ssh-ed25519` …`39er` — **`brain-vps-deploy`** (deploy key on **second-brain** repo) |

---

## Domains

| Domain | Purpose |
|--------|---------|
| `brain.kendowney.com` | Ingest API + MCP server (if still enabled) |
| `mission.kendowney.com` | Mission Control dashboard + OpenClaw proxy |
| `storybook.kendowney.com` | K2DS Storybook |
| `kendowney.com` | Personal site — **https://github.com/mtb24/kendowney.com** (rsync → `~/brain/personal-site/`, container `brain-personal-site`; **Design Lock** at `/design-lock`) |

DNS and TLS: see **DNS & TLS (Cloudflare)** above. See **Sites live** for ports and auth notes.

---

## Repo root (git workspace)

The GitHub repo root (local: `/Users/kendowney/Sites/SecondBrain/`) includes **`CLAUDE.md`** — instructions for the Dev Partner (Cursor/Claude) on workflow, deploy pipeline, and conventions. It is not deployed as a runtime artifact; it exists for humans and agents working in the repo.

Optional paths tracked in git:

- `openclaw/skills/strategy-master/` — mirror of the VPS OpenClaw workspace skill (see **Strategy Master Agent** below)
- `openclaw/skills/adventure-photo/` — mirror of **adventure-photo** (Telegram → VPS static images → Adventures page; see **Workspace skills** below)

Canonical workspace skills on the VPS (not necessarily mirrored here):

- **`~/.openclaw/workspace/skills/session-close/`** — session close workflow
- **`~/.openclaw/workspace/skills/adventure-photo/`** — adventure photos (see **Adventure images**)

---

## K2DS design system

Source: **`packages/k2ds/`** in the **kendowney.com** repo (`@kendowney/k2ds`).

| Topic | Detail |
|-------|--------|
| Stack | React + TypeScript + Tailwind |
| Storybook | **10** (ESM-only) — `localhost:6006` |
| Components | Button, PageHeader, ProjectCard, SkillPill, Nav (5) |
| Tokens | Desert noir + cobalt blue palette; **`figma-tokens.json`** is the source of truth (token bridge) |
| Contracts | JSON Schema per component; **Ajv** validation |
| Pipeline | prompt → parse → validate → render |
| MUI | Design-system-agnostic integration proof |
| Modes | **strict**, **lenient**, **report** |

---

## Git on the VPS (`~/brain`)

The server checkout uses a **deploy key**; **`main`** is the default branch (historically `master` existed — **do not recreate `master`**). **`git push` to GitHub over SSH works** from the VPS for routine deploys and doc updates.

---

## Directory Structure

```
/home/brain/adventure-images/   ← kendowney.com adventure photos (NOT in git / NOT in Docker; Nginx serves /images/adventures/)
└── adventures/<category>/...

~/brain/   (git checkout: /home/brain/brain/)
├── .env                        ← single source of truth for all credentials
├── docker-compose.yml          ← stack definition (db, ingest, mcp, tournament, mission, optional honest-fit); kendowney.com is a separate repo (rsync → personal-site/)
├── backup-db.sh                ← pg_dump backup script (cron 3am daily)
├── BRAIN.md                    ← this file (also mirrored from repo root in git)
├── backups/                    ← pg_dump .sql.gz files (7-day retention)
├── ingest-api/
│   ├── Dockerfile
│   ├── initdb/
│   │   └── 01-init.sql         ← vector extension + thoughts table (auto on fresh DB)
│   ├── main.py
│   ├── routers/
│   └── services/
├── mission-control/            ← TanStack Start dashboard
│   ├── Dockerfile
│   └── app/
│       └── server/
│           └── openclawGateway.ts
├── personal-site/              ← kendowney.com **content only** (rsync from ~/Sites/kendowney.com/ — not in SecondBrain git)
├── honest-fit/                 ← legacy HFA tree (optional); not served at honestfit.kendowney.com (decommissioned)
│   └── Dockerfile
├── tournament/                 ← Trading tournament (TypeScript)
└── archive/                    ← Old compose references
```

---

## Docker Stack

File: `~/brain/docker-compose.yml`
Env: `~/brain/.env` (real file, not symlink)

| Service | Container | Port | Image |
|---------|-----------|------|-------|
| db | brain-db | 127.0.0.1:5432 | pgvector/pgvector:pg16 |
| ingest-api | brain-ingest | 127.0.0.1:8000 | custom (Python 3.12) |
| mcp-server | brain-mcp | 127.0.0.1:3000 | custom (Python 3.12) |
| mission-control | brain-mission | 127.0.0.1:4173 | custom (Node 22 Alpine) |
| honest-fit | brain-honest-fit | 127.0.0.1:3002→3000 | **Legacy:** still in compose if the tree exists; **honestfit.kendowney.com** vhost removed — not a public URL. Current Honest Fit app: **honestfit.ai** (dedicated VPS). |

**kendowney.com (`brain-personal-site`, port 4174):** Source is **https://github.com/mtb24/kendowney.com** → rsync to `~/brain/personal-site/`. It is **not** a service in SecondBrain’s `docker-compose.yml`; build with `docker compose` from **`~/brain/personal-site/`** using **`docker-compose.yml`** in the kendowney.com repo (external `brain_default` network), or maintain an equivalent stanza on the VPS.

**Host 3001** is already used by **tournament** on the host; legacy **honest-fit** (if running) uses **3002** → container **3000**. Compose: `env_file: .env` (shared `~/brain/.env`).

**Removed:** litestream (wrong tool for Postgres — use pg_dump instead)

### Useful commands

```bash
cd ~/brain
docker compose up -d                          # start all
docker compose down --remove-orphans          # stop and clean orphans
docker compose build --no-cache mission-control && docker compose up -d mission-control
docker compose logs --tail 20 mission-control
docker ps | grep brain
```

---

## Environment Variables

Single `.env` at `~/brain/.env`. Contains all vars for all services.

Key vars:

```
POSTGRES_DB=brain
POSTGRES_USER=brain
POSTGRES_PASSWORD=...
API_SECRET=...
MCP_SECRET=...
ANTHROPIC_API_KEY=...
COINGECKO_API_KEY=...
OPENCLAW_GATEWAY_TOKEN=...   ← operator token from device-auth.json
OPENCLAW_GATEWAY_URL=wss://mission.kendowney.com/openclaw/
TOURNAMENT_ANTHROPIC_GAP_MS=5000   ← optional; throttle between Anthropic calls (tournament)
B2_BUCKET=...
B2_KEY_ID=...
B2_APP_KEY=...               ← note: B2_APP_KEY not B2_APPLICATION_KEY (optional — legacy / one-off; **adventure gallery is on-VPS**, not B2)
B2_BUCKET_NAME=kendowney-assets
B2_PUBLIC_URL=https://f004.backblazeb2.com/file/kendowney-assets   ← optional legacy
DB_URL=postgresql://brain:...@localhost:5432/brain
DRY_RUN=true
```

**Local Mac:** `/Users/kendowney/Sites/SecondBrain/.env` (same content, never committed)

**Adventure images (kendowney.com):** Stored on the VPS at **`/home/brain/adventure-images/adventures/<category>/`** (not in git / not in Docker). Nginx serves them at **`/images/adventures/`** with **30-day** cache (`expires` / `Cache-Control: public, immutable` — see **Nginx Config**).

| Path / flow | Detail |
|-------------|--------|
| VPS tree | `/home/brain/adventure-images/adventures/` |
| Local staging | `~/Sites/kendowney.com/images/adventures/` |
| Sync | From kendowney.com repo: **`npm run sync-adventures`** (uses `scripts/sync-adventures.sh`) |
| Telegram | Cortex **adventure-photo** skill → writes on VPS → regenerates manifest → rebuild **personal-site** |
| HEIC | **`sips`** on Mac; **`heif-convert`** on VPS for conversion when needed |

Site uses **`IMAGE_BASE` = `/images/adventures`** in `adventureManifest.ts`.

**Nginx must read under `/home/brain/`:** `www-data` needs **`chmod o+x /home/brain`** (traverse only) and readable image tree, e.g. **`chmod -R a+rX /home/brain/adventure-images`**. Without this, `/images/adventures/...` returns **403**.

**Migrating from B2:** If `b2 sync` from the bucket hits **`download_cap_exceeded`**, sync from the Mac staging folder instead (`rsync` to the path above) — API download caps still apply when pulling from B2 to the VPS.

**Backblaze B2**

| Item | Value |
|------|-------|
| Bucket | **`kendowney-assets`** (public) |
| Region | **us-west-004**; public URL host **f004** (e.g. `https://f004.backblazeb2.com/file/kendowney-assets/...`) |
| Images | **Not** used for site images anymore — **bandwidth cap exceeded** |
| Other assets | Bucket still available for non-image or low-bandwidth use |
| VPS | **B2 CLI** installed via **pip** |

Adventure carousels are on-VPS static files, not B2.

---

## Database

Engine: Postgres 16 + pgvector
Volume: `brain_pgdata` (Docker named volume)

### Tables

| Table | Purpose |
|-------|---------|
| `thoughts` | Ingested notes/logs with vector embeddings |
| `tournament_strategies` | Strategy definitions — includes `notes` (text) and `conditions` (text[]) columns; queryable via `strategy_candidates` view |
| `tournament_rounds` | Round lifecycle records |
| `tournament_bots` | Bot instances per round |
| `tournament_performance` | Final per-bot results per round |
| `tournament_ticks` | Per-tick balance/PnL snapshots (live charting) |

### Schema bootstrap

On a fresh DB, `ingest-api/initdb/01-init.sql` auto-runs and creates:
- `CREATE EXTENSION IF NOT EXISTS vector`
- `thoughts` table

Tournament tables must be created manually after a fresh DB wipe:
```bash
docker exec brain-db psql -U brain -d brain -c "
CREATE TABLE IF NOT EXISTS tournament_strategies (
    id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT, file_path VARCHAR(255),
    active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS tournament_rounds (
    id SERIAL PRIMARY KEY, started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ, status VARCHAR(50) DEFAULT 'running');
CREATE TABLE IF NOT EXISTS tournament_bots (
    id SERIAL PRIMARY KEY, round_id INTEGER REFERENCES tournament_rounds(id),
    strategy_id INTEGER REFERENCES tournament_strategies(id),
    starting_balance NUMERIC(18,8) DEFAULT 10000,
    current_balance NUMERIC(18,8) DEFAULT 10000, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS tournament_performance (
    id SERIAL PRIMARY KEY, bot_id INTEGER REFERENCES tournament_bots(id),
    symbol VARCHAR(20), action VARCHAR(10), price NUMERIC(18,8),
    amount NUMERIC(18,8), pnl NUMERIC(18,8), reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS tournament_ticks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES tournament_rounds(id),
    bot_id UUID REFERENCES tournament_bots(id),
    strategy_id UUID REFERENCES tournament_strategies(id),
    strategy_name VARCHAR(100),
    balance NUMERIC(18,8), pnl NUMERIC(18,8), pnl_percent NUMERIC(10,4),
    tick_at TIMESTAMPTZ DEFAULT NOW());"

# Re-seed strategies
docker exec brain-db psql -U brain -d brain -c "
INSERT INTO tournament_strategies (name, description, file_path) VALUES
  ('momentum', 'Buy when trending up, sell when trending down', 'strategies/momentum.md'),
  ('mean-revert', 'Buy below moving average, sell above', 'strategies/mean-revert.md'),
  ('breakout', 'Buy on volume breakout, sell on breakdown', 'strategies/breakout.md')
ON CONFLICT (name) DO NOTHING;"
```

---

## Backup

Script: `~/brain/backup-db.sh`
Cron: `0 3 * * *` (daily 3am)
Output: `~/brain/backups/brain-db-YYYYMMDD-HHMMSS.sql.gz`
Retention: 7 backups

```bash
~/brain/backup-db.sh   # manual run
```

---

## Nginx Config

**TLS:** Nginx uses the **Cloudflare origin** certificate **`/etc/ssl/cloudflare/kendowney.com.pem`** / **`.key`** (wildcard). Public HTTPS is terminated at Cloudflare (**Full (Strict)**); no Certbot on this VPS.

### brain.kendowney.com
- `/ingest/` → `127.0.0.1:8000`
- `/mcp/` → `127.0.0.1:3000`

### mission.kendowney.com
- `/` → `127.0.0.1:4173`
- `/openclaw/` → `127.0.0.1:18789` with `proxy_set_header X-Forwarded-User "iframeuser"`

### kendowney.com
- `/` → `127.0.0.1:4174` (personal site — Docker `brain-personal-site`)
- `/images/adventures/` → static **`alias /home/brain/adventure-images/adventures/`** (long cache: `expires 30d`, `Cache-Control: public, immutable`)
- **Nginx:** configured in `/etc/nginx/sites-available/brain` (enabled); apex `server_name kendowney.com` proxies to `4174` — not `sites-available/default` (disabled on VPS).

### storybook.kendowney.com
- K2DS Storybook — Nginx `server_name` + upstream as defined on the VPS (static build or local port per deploy).

### honestfit.kendowney.com (removed)
- **Decommissioned** — site config removed from the brain VPS. Do not use this hostname for the current product.

---

## OpenClaw / Cortex

### Gateway config (`~/.openclaw/openclaw.json`)

```json
{
  "gateway": {
    "port": 18789,
    "bind": "lan",
    "auth": { "mode": "trusted-proxy", "trustedProxy": { "userHeader": "x-forwarded-user" } },
    "trustedProxies": ["127.0.0.1"],
    "controlUi": {
      "allowedOrigins": [
        "http://127.0.0.1:18789",
        "http://172.18.0.1:18789",
        "http://172.18.0.6:18789",
        "https://mission.kendowney.com"
      ]
    }
  }
}
```

### Key facts

- Auth mode: **trusted-proxy** — NO token required from services
- Mission Control connects via `wss://mission.kendowney.com/openclaw/` (through Nginx)
- Nginx injects `X-Forwarded-User: iframeuser` → OpenClaw trusts `127.0.0.1` (Nginx) and accepts
- `openclawGateway.ts` uses `auth: {}` (no token) for this connection path
- **Never use `ws://172.19.0.1:18789` directly** — trusted-proxy only works via Nginx
- Docker bridge IP for `brain_default` network: `172.19.0.1`
- OpenClaw runs as systemd user service, port 18789
- Agent: **Cortex 🧠**, model: `claude-sonnet-4-6`
- Telegram bot: `@kensbrainbot`, Ken telegramUserId: `7221971575`

### Workspace skills (VPS)

| Skill | Path | Status |
|-------|------|--------|
| **Session close** | `~/.openclaw/workspace/skills/session-close/` (`SKILL.md`) | Deployed — summarizes session, proposes BRAIN.md edits, commits on approval |
| **Strategy master** | `~/.openclaw/workspace/skills/strategy-master/` | Deployed — **12h** cron (currently **paused** with tournament — see **Tournament**) |
| **Adventure photo** | `~/.openclaw/workspace/skills/adventure-photo/` | Deployed — Ken sends a photo on Telegram; Cortex asks for category (or uses caption); writes to **`/home/brain/adventure-images/adventures/<category>/`**, regenerates manifest via **`generate-adventure-manifest.mjs`** (`ADVENTURE_STAGING_ROOT` = that tree), rebuilds `personal-site` Docker; confirms with **`https://kendowney.com/images/adventures/...`** |

### OpenClaw cron (Gateway scheduler)

Persisted at `~/.openclaw/cron/jobs.json`. **Note:** `openclaw cron list` from the VPS often fails with a WebSocket handshake error to localhost; use **`jobs.json` on disk** to verify schedules (see Known Gotchas).

| Job name | Schedule (UTC) | Purpose |
|----------|----------------|---------|
| Tournament round (3h) | `0 */3 * * *` | Runs `tournament/scripts/tournament-cron.sh` — **job id `66b7a9fc`** — **`enabled: false`** while paused |
| Strategy master (12h) | `0 6,18 * * *` | Runs strategy-master skill — **job id:** `c5a4596a-9cc1-4881-b982-dbc441355fa5` — **paused** with tournament |

### Strategy Master Agent

- **Schedule:** every **12 hours** at **06:00 and 18:00 UTC** (offset from 3-hour tournament rounds).
- **Behavior:** Loads recent tournament results from OB1 (and DB fallback), infers winners/losers, proposes **1–2** new strategies via **Telegram** with **plain-English** explanations (no finance jargon in the user-facing text). Waits for **YES** / **NO** per proposal; on YES inserts into `tournament_strategies` as **`active`** with **`source='master'`**; on NO logs rejection to OB1.
- **Strategy docs:** Must follow the **declarative doc format** enforced by `_sanitizeStrategyDoc` / `_templateDocForStrategy` in `tournament/src/orchestrator.ts` (prompt-native fields only; dollar PnL exits; ending with `"Respond with JSON only. Never explain your reasoning."`).
- **Cron payload:** `~/brain/tournament/scripts/openclaw-strategy-master-cron-message.txt`

---

## Honest Fit Assessment (HFA) — legacy prototype

**Public URL was** `https://honestfit.kendowney.com` — **decommissioned** (Nginx removed on brain VPS).

**Current Honest Fit product:** **[https://honestfit.ai](https://honestfit.ai)** on dedicated VPS **64.23.165.78** — repo **[github.com/mtb24/honestfit](https://github.com/mtb24/honestfit)**.

**Legacy prototype repo:** [github.com/mtb24/honest-fit-assessment](https://github.com/mtb24/honest-fit-assessment) — local **`~/Sites/AI/HonestFitAssessment/`** — default branch **`master`** (not `main`). Optional checkout on brain: `~/brain/honest-fit/` (no longer exposed on a public hostname from this server).

| Topic | Detail |
|-------|--------|
| **Voice (story interview)** | Web Speech API — **Chrome-first** for mic + TTS |
| **Auto-speak toggle** | `localStorage` key **`hfa-story-interview-auto-speak`** (voice reply toggle) |
| **Profile data** | **`candidateProfile.local.ts`** is source of truth in the HFA repo |
| **Synced copy** | Profile synced to personal site: **`personal-site/app/data/kenProfile.ts`** (kendowney.com repo) |

**Dockerfile notes (if you still build the legacy container):** Multi-stage Node 22 Alpine + pnpm; production serves with **`vite preview`** on port 3000. Runner image must include **`dist` + `src` + `public` + `node_modules`**. In **`vite.config.ts`**, set **`preview.allowedHosts`** appropriately for whatever host you test against — a strict host check causes **403** if the `Host` header does not match.

---

## Mission Control

URL: https://mission.kendowney.com
Stack: TanStack Start (SSR), Node 22 Alpine, port 4173

Pages: Dashboard · Thoughts · Search · Agents · Trading · OpenClaw

**App-level auth (not Nginx):** Session cookie `mc_session` (HMAC-SHA256 with `MC_SESSION_SECRET`), bcrypt password via `MC_PASSWORD_HASH`, username **`MC_USERNAME`** (e.g. **`ken`**). Public routes: `/login`, `/logout` (POST clears session). All other pages and `/api/*` handlers require a valid session.

Env (also in `docker-compose.yml` for the `mission-control` service): **`MC_USERNAME`**, **`MC_PASSWORD_HASH`**, **`MC_SESSION_SECRET`**, **`MC_SESSION_TTL_DAYS`** (default 7 days in app if unset). **Docker Compose interpolates `$` in `.env`:** bcrypt hashes must escape each `$` as **`$$`** in `~/brain/.env` (e.g. `MC_PASSWORD_HASH=$$2b$$10$$...`). Hash helper: `npm run hash-mc-password --workspace=mission-control -- 'password'`.

---

## Tournament

Local: `/Users/kendowney/Sites/SecondBrain/tournament/`
Server: `~/brain/tournament/`

### Phase 1 (complete)
- Exchange adapter + MockAdapter, CoinGecko fetcher
- Claude decision engine, 3 strategies seeded
- Bot runner, OB1 logging, DB tables

### Phase 2 (complete)

- **Round orchestration** — single round record, parallel bots, **shared market data** across competitors
- **Parallel bots** — concurrent execution with shared `MockAdapter` conditions
- **Performance tracking** — leaderboard, per-bot final metrics
- **Live charting** — Mission Control Trading page: leaderboard, **live chart** (poll), round history
- **Tick data** — per-tick DB writes to **`tournament_ticks`** (balance / PnL snapshots for charts)
- MockAdapter price simulation: seeded from CoinGecko, then ±0.1% random walk per tick
- `DRY_RUN` guard applies to live adapters only — MockAdapter always executes
- Round duration selector: 10m / 30m / 1h / 3h
- Bot names = strategy name (clean, no timestamp suffix)
- Auto-research new strategies via Claude when slots exceed supply (docs must stay **declarative** — see `orchestrator.ts` sanitizer)

### Phase 3 (complete)

- **3-hour tournament rounds via OpenClaw** — isolated cron job runs `tournament/scripts/tournament-cron.sh` (see `openclaw-cron-message.txt` pattern in `tournament/scripts/`)
- **Strategy Master** — 12h cron for proposed strategies (see **Strategy Master Agent** below)

### Cron & runtime (current)

| Item | Status / detail |
|------|-----------------|
| **Tournament cron** | **PAUSED** — OpenClaw job id **`66b7a9fc`** in **`~/.openclaw/cron/jobs.json`** has **`enabled: false`** |
| **Strategy master cron** | **Paused** together with tournament (same gateway scheduler) |
| **Anthropic API throttle** | Env **`TOURNAMENT_ANTHROPIC_GAP_MS`** (default **5000** ms) — implementation: `tournament/src/bot/anthropicThrottle.ts` |
| **Regime detector (Phase 1)** | **`getStrategySignal()`** runs before each round; logs to OB1 with **`source: tournament-regime`** |

**Re-enable tournament rounds:** set **`enabled: true`** for the tournament job in **`jobs.json`**, then restart **`openclaw-gateway`** (systemd user service).

### Active strategies

**Rows with `status = 'active'` in production Postgres** (authoritative for who competes next). Query: `SELECT name, tier, status, conditions FROM strategy_candidates WHERE status = 'active';`

As of 2026-04-01, active strategies include: `bounce-hunter`, `volatility-spike`, `quick-dip-fade`, `flat-range-buyer`, `spike-fade-short`, `daily-dip-catch`, `calm-range-scalper`, `hourly-bounce-long`, and others added by Strategy Master.

**`strategy_candidates` view** — queryable by regime: `SELECT name, tier, conditions FROM strategy_candidates WHERE 'trending' = ANY(conditions);`

**Condition tags in use:** `trending`, `momentum`, `ranging`, `choppy`, `bearish`, `dip`, `volatile`

**Historical winner:** `mean-revert` (+$9.92 across 12 rounds, retired) — un-retire when market is ranging.

**Six declarative template names** in `tournament/src/orchestrator.ts` (`_templateDocForStrategy` presets — used when the sanitizer normalizes a strategy doc): `dip-buyer`, `trend-rider`, `volatility-fade`, `momentum-breakout`, `funding-rate-fade`, `range-reversal`. New or auto-researched strategies must still follow the same **declarative rules** (prompt-native fields, dollar PnL exits, no indicator jargon) or the sanitizer replaces the doc with a template.

### Future work

- **Real exchange adapter** (not shipped yet)
- **Meta-layer / regime detector** (planned) — polls all approved strategy signals before a round, classifies market regime (trending/bearish/choppy/volatile), routes capital to best-fit strategies. Foundation exists: `conditions` tags + OB1 round history.

---

## Local Development

```
/Users/kendowney/Sites/SecondBrain/
├── CLAUDE.md               ← Dev Partner rules (workflow, deploy, brain search)
├── BRAIN.md                ← system doc (commit when updated)
├── .env                    ← credentials (never commit)
├── docker-compose.yml
├── ingest-api/initdb/01-init.sql
├── openclaw/skills/        ← optional mirrors of ~/.openclaw/workspace/skills/
├── mission-control/
└── tournament/
```

### Rsync to server
```bash
rsync -av --delete --exclude='node_modules' --exclude='.git' \
  /Users/kendowney/Sites/SecondBrain/mission-control/ \
  brain@147.182.240.24:~/brain/mission-control/

rsync -av --delete --exclude='node_modules' --exclude='.git' \
  /Users/kendowney/Sites/SecondBrain/tournament/ \
  brain@147.182.240.24:~/brain/tournament/

rsync -av --delete --exclude='node_modules' --exclude='.git' \
  --exclude='dist' --exclude='.output' --exclude='.nitro' --exclude='.tanstack' \
  /Users/kendowney/Sites/kendowney.com/ \
  brain@147.182.240.24:~/brain/personal-site/

# Legacy HFA only — honestfit.kendowney.com is not served from the brain VPS
rsync -av --delete \
  --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='.pnpm-store' \
  --exclude='.env.local' \
  /Users/kendowney/Sites/AI/HonestFitAssessment/ \
  brain@147.182.240.24:~/brain/honest-fit/
```

### Sync from server
```bash
scp brain@147.182.240.24:~/brain/.env /Users/kendowney/Sites/SecondBrain/.env
scp brain@147.182.240.24:~/brain/docker-compose.yml /Users/kendowney/Sites/SecondBrain/docker-compose.yml
```

---

## Known Gotchas

- **Docker bridge IP** for `brain_default` is `172.19.0.1` (not 172.18.0.1)
- **OpenClaw is trusted-proxy only** — must go through Nginx, never direct ws://
- **`openclaw cron list`** (CLI on the VPS) may **fail with a WebSocket handshake error** to `127.0.0.1:18789` — **`~/.openclaw/cron/jobs.json` on disk** is the reliable source for scheduled jobs
- **Git default branch on the VPS** is **`main`** (repo was historically `master` — **do not recreate `master`**)
- **Auto-researched / hand-authored strategy docs** must use the **declarative doc format** enforced by `_sanitizeStrategyDoc` in `tournament/src/orchestrator.ts` (prompt-native fields only; dollar PnL exits; closing line `Respond with JSON only. Never explain your reasoning.`)
- **`B2_APP_KEY`** — never `B2_APPLICATION_KEY`
- **Vector extension** — `initdb/01-init.sql` handles fresh DB; if DB exists run: `docker exec brain-db psql -U brain -d brain -c "CREATE EXTENSION IF NOT EXISTS vector;"`
- **Tournament tables** not in `initdb/01-init.sql` — create manually after DB wipe
- **`docker compose down` wipes named volumes** — backup first
- **`~/brain/.env` is a real file** — not a symlink
- **Adventure static files under `/home/brain/adventure-images/`** — Nginx serves them; **`chmod o+x /home/brain`** (and `a+rX` on the image tree) required or browsers get **403**
- **Tournament + Strategy Master crons** — **paused** in `~/.openclaw/cron/jobs.json` (`enabled: false`); re-enable only after intentional review
- **TLS on brain VPS** — **Cloudflare origin** cert at **`/etc/ssl/cloudflare/kendowney.com.pem`** / **`.key`**; **Full (Strict)** at Cloudflare; **no Certbot**
- **kendowney.com** — lives in **`~/Sites/kendowney.com/`** / **github.com/mtb24/kendowney.com**, not under SecondBrain; **`docker compose`** in SecondBrain no longer defines `personal-site`
- **Cortex refuses unsupervised action** — correct per AGENTS.md
- **`routeTree.gen.ts`** — generated by TanStack Router Vite plugin at build time. If you see `createFileRoute arg not assignable to undefined`, run `npm run build` inside `mission-control/` to regenerate it. Commit the result.
- **`DRY_RUN`** — only gates live adapters (`isLive=true`). MockAdapter ignores it and always simulates trades.
- **Mission Control `MC_PASSWORD_HASH` in `~/brain/.env`** — Docker Compose treats `$` as variable interpolation; use `$$` per dollar sign in the bcrypt string or the hash is corrupted at container start.
- **`COINGECKO_API_KEY` missing from container** — tournament silently falls back to anonymous CoinGecko tier → 429 errors. Verify: `docker exec brain-tournament env | grep COINGECKO`. Restart with env: `set -a && source ~/brain/.env && set +a && docker compose up -d --force-recreate tournament`. TODO: add `env_file: .env` to tournament service in docker-compose.yml.
- **OB1 `project_tag: off-road-moto`** — used for personal moto/Baja photo captures via Telegram.
- **OpenClaw updated** 2026-04-01: `2026.3.13` → `2026.3.28`.
