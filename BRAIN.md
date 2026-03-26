# BRAIN.md — Ken's Second Brain System

Last updated: 2026-03-26

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

DNS managed via DigitalOcean.

---

## Directory Structure

```
~/brain/
├── .env                        ← single source of truth for all credentials
├── docker-compose.yml          ← 4-service stack definition
├── backup-db.sh                ← pg_dump backup script (cron 3am daily)
├── BRAIN.md                    ← this file
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
DB_URL=postgresql://brain:...@localhost:5432/brain
DRY_RUN=true
```

**Local Mac:** `/Users/kendowney/Sites/SecondBrain/.env` (same content, never committed)

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
- Round orchestration (parallel bots, shared market data)
- Performance tracking + leaderboard
- MockAdapter price simulation: seeded from CoinGecko, then ±0.1% random walk per tick
- `DRY_RUN` guard applies to live adapters only — MockAdapter always executes
- Per-tick DB writes (`tournament_ticks`) for live charting
- Mission Control Trading page: leaderboard, live chart (5s poll), round history
- Round duration selector: 10m / 30m / 1h / 3h
- Bot names = strategy name (clean, no timestamp suffix)
- Auto-research new strategies via Claude when slots exceed supply

### Phase 3 (planned)
- Daily cron scheduling
- Real exchange adapter

---

## Local Development

```
/Users/kendowney/Sites/SecondBrain/
├── .env                    ← credentials (never commit)
├── docker-compose.yml
├── ingest-api/initdb/01-init.sql
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
- **`B2_APP_KEY`** — never `B2_APPLICATION_KEY`
- **Vector extension** — `initdb/01-init.sql` handles fresh DB; if DB exists run: `docker exec brain-db psql -U brain -d brain -c "CREATE EXTENSION IF NOT EXISTS vector;"`
- **Tournament tables** not in `initdb/01-init.sql` — create manually after DB wipe
- **`docker compose down` wipes named volumes** — backup first
- **`~/brain/.env` is a real file** — not a symlink
- **Cortex refuses unsupervised action** — correct per AGENTS.md
- **`routeTree.gen.ts`** — generated by TanStack Router Vite plugin at build time. If you see `createFileRoute arg not assignable to undefined`, run `npm run build` inside `mission-control/` to regenerate it. Commit the result.
- **`DRY_RUN`** — only gates live adapters (`isLive=true`). MockAdapter ignores it and always simulates trades.
