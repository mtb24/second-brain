# BRAIN.md — Ken's Second Brain System

Last updated: 2026-03-27

---

## Overview

A personal operating system / second brain running on a DigitalOcean VPS. Ingests thoughts, logs agent activity, runs a trading strategy tournament, and provides a Mission Control dashboard with an embedded AI agent (Cortex).

---

## Server

| Item | Value |
|------|-------|
| Provider | DigitalOcean |
| IP | 147.182.240.24 |
| User | `brain` |
| Project root | `~/brain/` (`/home/brain/brain/`) |
| OS | Ubuntu 24.04, 4GB RAM / 2 vCPU |

---

## Domains

| Domain | Purpose |
|--------|---------|
| `brain.kendowney.com` | Ingest API + MCP server |
| `mission.kendowney.com` | Mission Control dashboard + OpenClaw proxy |
| `honestfit.kendowney.com` | Honest Fit Assessment (TanStack Start, Docker `brain-honest-fit`) |

DNS managed via DigitalOcean.

---

## Repo root (git workspace)

The GitHub repo root (local: `/Users/kendowney/Sites/SecondBrain/`) includes **`CLAUDE.md`** — instructions for the Dev Partner (Cursor/Claude) on workflow, deploy pipeline, and conventions. It is not deployed as a runtime artifact; it exists for humans and agents working in the repo.

Optional paths tracked in git:

- `openclaw/skills/strategy-master/` — mirror of the VPS OpenClaw workspace skill (see **Strategy Master Agent** below)
- `openclaw/skills/adventure-photo/` — mirror of **adventure-photo** (Telegram → B2 → Adventures page; see **Workspace skills** below)

---

## Git on the VPS (`~/brain`)

The server checkout uses a **deploy key**; **`main`** is the default branch (historically `master` existed — **do not recreate `master`**). **`git push` to GitHub over SSH works** from the VPS for routine deploys and doc updates.

---

## Directory Structure

```
~/brain/
├── .env                        ← single source of truth for all credentials
├── docker-compose.yml          ← stack definition (db, ingest, mcp, tournament, mission, personal-site, honest-fit)
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
├── personal-site/              ← kendowney.com (TanStack Start)
│   └── Dockerfile
├── honest-fit/                 ← honestfit.kendowney.com (HFA; not in this repo — sync from ~/Sites/AI/HonestFitAssessment)
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
| personal-site | brain-personal-site | 127.0.0.1:4174 | custom (Node 22 Alpine) |
| honest-fit | brain-honest-fit | 127.0.0.1:3002→3000 | custom (Node 22 Alpine, pnpm; `vite preview`) |

**Host 3001** is already used by **tournament** on the host; honest-fit uses **3002** → container **3000**. Compose: `env_file: .env` (shared `~/brain/.env`).

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
B2_BUCKET=...
B2_KEY_ID=...
B2_APP_KEY=...               ← note: B2_APP_KEY not B2_APPLICATION_KEY
B2_BUCKET_NAME=kendowney-assets   ← public assets bucket for kendowney.com adventures (us-west-004; see `personal-site/scripts/upload-adventure-images.sh`)
B2_PUBLIC_URL=https://f004.backblazeb2.com/file/kendowney-assets   ← friendly URL prefix, no trailing slash; images at `{B2_PUBLIC_URL}/adventures/<slug>/<file>`
DB_URL=postgresql://brain:...@localhost:5432/brain
DRY_RUN=true
```

**Local Mac:** `/Users/kendowney/Sites/SecondBrain/.env` (same content, never committed)

**Backblaze public buckets:** Creating an **allPublic** bucket via API may return `no_payment_history` until the B2 account has billing on file. After that, create `kendowney-assets` as allPublic (us-west-004 → `f004` host) and keep `B2_PUBLIC_URL` / default `VITE_ADVENTURE_B2_BASE` aligned with the B2 UI friendly URL.

---

## Database

Engine: Postgres 16 + pgvector
Volume: `brain_pgdata` (Docker named volume)

### Tables

| Table | Purpose |
|-------|---------|
| `thoughts` | Ingested notes/logs with vector embeddings |
| `tournament_strategies` | Strategy definitions (momentum, mean-revert, breakout) |
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

### brain.kendowney.com
- `/ingest/` → `127.0.0.1:8000`
- `/mcp/` → `127.0.0.1:3000`

### mission.kendowney.com
- `/` → `127.0.0.1:4173`
- `/openclaw/` → `127.0.0.1:18789` with `proxy_set_header X-Forwarded-User "iframeuser"`

### kendowney.com
- `/` → `127.0.0.1:4174` (personal site — Docker `brain-personal-site`)
- **Nginx:** configured in `/etc/nginx/sites-available/brain` (enabled); apex `server_name kendowney.com` proxies to `4174` — not `sites-available/default` (disabled on VPS).

### honestfit.kendowney.com
- `/` → `127.0.0.1:3002` (Docker `brain-honest-fit`)
- **Nginx:** `/etc/nginx/sites-available/honestfit` (enabled); TLS via Let’s Encrypt (certbot `--nginx`).

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
| **Session close** | `~/.openclaw/workspace/skills/session-close/SKILL.md` | Deployed and tested — summarizes session, proposes BRAIN.md edits, commits on approval |
| **Strategy master** | `~/.openclaw/workspace/skills/strategy-master/SKILL.md` | Deployed — see below |
| **Adventure photo** | `~/.openclaw/workspace/skills/adventure-photo/SKILL.md` | Deployed — Ken sends a photo on Telegram; Cortex asks for category (or uses caption); uploads to B2 `adventures/<category>/`, regenerates `personal-site/app/data/adventureManifest.files.json` from `b2 ls --json`, rebuilds `personal-site` Docker; confirms with public B2 URL |

### OpenClaw cron (Gateway scheduler)

Persisted at `~/.openclaw/cron/jobs.json`. **Note:** `openclaw cron list` from the VPS often fails with a WebSocket handshake error to localhost; use **`jobs.json` on disk** to verify schedules (see Known Gotchas).

| Job name | Schedule (UTC) | Purpose |
|----------|----------------|---------|
| Tournament round (3h) | `0 */3 * * *` | Runs `tournament/scripts/tournament-cron.sh` (isolated agent turn) |
| Strategy master (12h) | `0 6,18 * * *` | Runs strategy-master skill — **job id:** `c5a4596a-9cc1-4881-b982-dbc441355fa5` |

### Strategy Master Agent

- **Schedule:** every **12 hours** at **06:00 and 18:00 UTC** (offset from 3-hour tournament rounds).
- **Behavior:** Loads recent tournament results from OB1 (and DB fallback), infers winners/losers, proposes **1–2** new strategies via **Telegram** with **plain-English** explanations (no finance jargon in the user-facing text). Waits for **YES** / **NO** per proposal; on YES inserts into `tournament_strategies` as **`active`** with **`source='master'`**; on NO logs rejection to OB1.
- **Strategy docs:** Must follow the **declarative doc format** enforced by `_sanitizeStrategyDoc` / `_templateDocForStrategy` in `tournament/src/orchestrator.ts` (prompt-native fields only; dollar PnL exits; ending with `"Respond with JSON only. Never explain your reasoning."`).
- **Cron payload:** `~/brain/tournament/scripts/openclaw-strategy-master-cron-message.txt`

---

## Honest Fit Assessment (HFA)

URL: https://honestfit.kendowney.com  
Source repo (local): `/Users/kendowney/Sites/AI/HonestFitAssessment/` — default git branch **`master`** (not `main`).  
VPS: `~/brain/honest-fit/` — build with `docker compose build honest-fit && docker compose up -d honest-fit`.

**Dockerfile notes:** Multi-stage Node 22 Alpine + pnpm; production serves with **`vite preview`** on port 3000. Runner image must include **`dist` + `src` + `public` + `node_modules`** (TanStack Start preview resolves the router from `src`). In **`vite.config.ts`**, **`preview.allowedHosts: true`** (or an explicit host list) — otherwise Nginx’s `Host: honestfit.kendowney.com` is rejected with **403** by Vite’s host check.

---

## Mission Control

URL: https://mission.kendowney.com
Stack: TanStack Start (SSR), Node 22 Alpine, port 4173

Pages: Dashboard · Thoughts · Search · Agents · Trading · OpenClaw

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
- **Strategy Master** — 12h cron for proposed strategies (see **Strategy Master Agent** above)

### Active strategies

**Rows with `status = 'active'` in production Postgres** (authoritative for who competes next):

| name | status |
|------|--------|
| `momentum-breakout` | active |
| `trend-rider` | active |

*As of 2026-03-26 the live DB has **two** active rows; others are `retired` or inactive.*

**Six declarative template names** in `tournament/src/orchestrator.ts` (`_templateDocForStrategy` presets — used when the sanitizer normalizes a strategy doc): `dip-buyer`, `trend-rider`, `volatility-fade`, `momentum-breakout`, `funding-rate-fade`, `range-reversal`. New or auto-researched strategies must still follow the same **declarative rules** (prompt-native fields, dollar PnL exits, no indicator jargon) or the sanitizer replaces the doc with a template.

### Future work

- **Real exchange adapter** (not shipped yet)

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
  /Users/kendowney/Sites/SecondBrain/personal-site/ \
  brain@147.182.240.24:~/brain/personal-site/

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
- **Cortex refuses unsupervised action** — correct per AGENTS.md
- **`routeTree.gen.ts`** — generated by TanStack Router Vite plugin at build time. If you see `createFileRoute arg not assignable to undefined`, run `npm run build` inside `mission-control/` to regenerate it. Commit the result.
- **`DRY_RUN`** — only gates live adapters (`isLive=true`). MockAdapter ignores it and always simulates trades.
