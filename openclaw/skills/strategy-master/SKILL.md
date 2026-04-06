---
name: strategy-master
description: Every 12h — pull recent tournament results from OB1 (and DB fallback), analyze winners/losers, propose 1–2 new declarative strategies on Telegram, wait for YES/NO, insert approved strategies as active or log rejections to OB1.
user-invocable: true
metadata: {"openclaw":{"emoji":"♟️"}}
---

# Strategy Master (Tournament)

Scheduled automation: you are the **strategy-master** run. Ken has pre-authorized
this workflow — do **not** ask permission to start. **Do** wait for Ken’s YES/NO
on each proposed strategy before inserting into Postgres.

Tournament rounds run **every 3 hours** (see `Tournament round (3h)` cron). This
skill runs **every 12 hours** at **06:00 and 18:00 UTC** — between round times so
you are not competing with the orchestrator.

This skill should be launched through the fallback-aware runner:
`tournament/scripts/strategy-master-cron.sh` → `openclaw/skills/_shared/model-fallback-runner.sh`.
That wrapper enforces Google primary, Ollama fallback (`llama3.2-16k`, 16k+ context required by OpenClaw), 60s cooldown after rate limits, and Telegram notification on fallback status.

**Deploy:** The gateway loads this skill from **`~/.openclaw/workspace/skills/strategy-master/`** on the VPS. This file in git is a mirror — after edits, rsync that directory to the workspace path and run **`systemctl --user restart openclaw-gateway`**. See **`tournament/scripts/cron-update-strategy-master.md`** (section **1b**).

## Constants

- **Telegram DM (Ken):** `7221971575` — same as `TELEGRAM_TARGET` in `~/brain/.env`
- **Ingest API:** `http://127.0.0.1:8000` (inside VPS)
- **Brain root:** `~/brain` (also `/home/brain/brain`)
- **Tournament code reference (declarative rules):** `~/brain/tournament/src/orchestrator.ts` — functions `_templateDocForStrategy`, `_buildDeclarativeDoc`, `_sanitizeStrategyDoc`, and the research prompt under `_researchNewStrategies` (lines ~192–215)

---

## Step 1 — Load credentials

```bash
set -a
# shellcheck source=/dev/null
source ~/brain/.env
set +a
export API_SECRET
```

If `API_SECRET` is empty, log failure to OB1 (source `strategy-master`) and stop.

---

## Step 2 — Query OB1 for recent tournament activity (last 24 hours)

Pull thoughts tagged to the tournament project. Prefer **`project_tag=tournament`**;
include **`source=tournament`** (orchestrator summaries + bot logs) and **`source=tournament-cron`**
(full round output). Merge and **filter to the last 24 hours** by `created_at`.

```bash
CUTOFF=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)

curl -s -H "Authorization: Bearer ${API_SECRET}" \
  "http://127.0.0.1:8000/thoughts/recent?limit=300&project_tag=tournament" | \
  jq --arg c "$CUTOFF" '[.[] | select(.created_at >= $c)]' > /tmp/ob1-tournament-24h.json
```

If the filtered list is empty or obviously incomplete, **fallback — authoritative DB**
(last 24h completed rounds):

```bash
docker exec brain-db psql -U brain -d brain -t -A -c "
SELECT r.id::text, r.ended_at::text, s.name, p.pnl_percent::text, p.fitness_score::text
FROM tournament_rounds r
JOIN tournament_performance p ON p.round_id = r.id
JOIN tournament_strategies s ON s.id = p.strategy_id
WHERE r.status = 'complete'
  AND r.ended_at IS NOT NULL
  AND r.ended_at > NOW() - INTERVAL '24 hours'
ORDER BY r.ended_at DESC, p.fitness_score DESC;
" 2>/dev/null | tee /tmp/db-rounds-24h.txt
```

---

## Step 3 — Analyze what won, lost, and why

From OB1 text and/or DB rows:

- Identify **which strategy names** finished top vs bottom per round.
- Note **patterns** (e.g. higher volatility favors shorter holds; drift up favors
  long-biased rules). Use **plain language** in your head — you will explain to Ken
  without finance jargon in Telegram.

If there is **no usable data** in the window, still send Ken a short Telegram note
that there was nothing to analyze this run, then stop (optional: log to OB1).

---

## Step 4 — Generate 1–2 new strategy **candidates**

For each candidate you need:

| Field | Rule |
|--------|------|
| **name** | Short **kebab-case** (e.g. `soft-dip-scout`). Must not collide with an existing `tournament_strategies.name` — check with `SELECT name FROM tournament_strategies WHERE name='<name>';` |
| **tier** | `conservative` \| `balanced` \| `aggressive` — maps to position size, leverage, and stop width in the doc |
| **doc** | Must follow the **declarative doc contract** below (same as tournament sanitizer template) |

### Declarative `doc` contract (mandatory)

The orchestrator’s sanitizer ultimately keeps strategies on **prompt-native fields only**:
**1h change %, 24h change %, balance, open positions**, plus **dollar PnL** for exits.
**Low thresholds** (e.g. `0.1` for % moves). **No RSI, SMA, Bollinger, or computed indicators.**

Structure (exactly three bullets + closing line):

```text
You are a {kebab-name} trader. BTC only.
- If {entry condition using only 1h change %, 24h change %, balance, open positions}, {BUY or SELL} with {X}% of balance at {Y}x leverage.
- If {exit condition using positions + dollar pnl}, CLOSE.
- Otherwise HOLD.
Respond with JSON only. Never explain your reasoning.
```

**Rules when authoring the doc string (do not output this checklist to Ken):**

- Never use “Compute”, “Calculate”, “I need to”, or reasoning language.
- Only reference data present in the bot decision prompt: current price, **1h change %**, **24h change %**, **balance**, **open positions**.
- Never reference RSI, SMA, Bollinger Bands, or any indicator requiring candle math.
- Do **not** add extra bullets beyond the three shown (entry, exit, otherwise HOLD).
- Use **BUY** or **SELL** only (no long/short parentheticals).
- Always end with: `Respond with JSON only. Never explain your reasoning.`
- Exits must be **dollar PnL**-style (e.g. `pnl >= 6 or pnl <= -5`) combined with position context as needed.

Match **tier** to the numbers: conservative → smaller % of balance, lower leverage,
tighter pnl bands; aggressive → the opposite.

---

## Step 5 — Telegram: propose each strategy and wait for YES/NO

For **each** candidate, send a **separate** Telegram message (so replies stay clear).
Use OpenClaw CLI from the VPS:

```bash
/usr/bin/openclaw message send --channel telegram --target "7221971575" -m "$(cat <<'EOF'
Strategy proposal #1 — soft-dip-scout

What it does (plain English):
This bot buys a small slice when BTC has dipped a little on the day, betting the dip
will bounce instead of keep falling.

Why it might work now:
Recent rounds showed buyers stepping in after mild pullbacks while the 24h drift
stayed positive — this rule tries to catch that kind of bounce.

Risk: conservative — smaller position, tighter stop, so wins and losses stay modest.

Reply YES or NO to this message only.
EOF
)"
```

**Use `--json`** on send if you need the outbound message id for polling.

**Wait for Ken’s reply** to **that** proposal: poll recent Telegram DMs, e.g. every
30–60 seconds, for up to **30–45 minutes** (this run is allowed a long timeout):

```bash
/usr/bin/openclaw message read --channel telegram --target "7221971575" --limit 20 --json
```

Treat the **latest** message that looks like an answer as authoritative: **`YES`** /
**`NO`** (case-insensitive). If Ken clarifies (`yes approve`, `nope`), infer intent.

- **YES** → go to Step 6 for that strategy.
- **NO** → go to Step 7 for that strategy.

If no reply within your wait window, send one reminder, then mark that proposal as
**timed out** and log to OB1; do **not** insert.

---

## Step 6 — YES: insert `tournament_strategies` as **active**

Use **`source = master`**, **`status = active`**, **`parent_ids = '{}'`**,
**`generation`** = `(SELECT COALESCE(MAX(generation),0) + 1 FROM tournament_strategies)`
(or reuse orchestrator’s generation pattern if you can read it — monotonic increase is fine).

**Preferred:** run `INSERT` via `docker exec brain-db psql` with the `doc` passed safely
(e.g. dollar-quoting `$doc$ ... $doc$` in SQL).

Example shape (adjust names and doc):

```sql
INSERT INTO tournament_strategies
  (name, generation, tier, status, source, parent_ids, doc)
VALUES (
  'soft-dip-scout',
  (SELECT COALESCE(MAX(generation), 0) + 1 FROM tournament_strategies),
  'conservative',
  'active',
  'master',
  '{}',
  $doc$
You are a soft-dip-scout trader. BTC only.
- If open positions is none and 24h change % <= -0.1, BUY with 20% of balance at 2x leverage.
- If open positions includes side long and (pnl >= 5 or pnl <= -4), CLOSE.
- Otherwise HOLD.
Respond with JSON only. Never explain your reasoning.
$doc$
);
```

Confirm success. Tell Ken on Telegram the strategy is **live for future tournament selection**.

---

## Step 7 — NO: log rejection to OB1

```bash
curl -s -S -X POST "http://127.0.0.1:8000/ingest" \
  -H "Authorization: Bearer ${API_SECRET}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg name "soft-dip-scout" \
    --arg reason "Ken declined — did not fit current risk appetite" \
    --arg doc "$DOC_PLAIN" \
    '{
      type: "text",
      content: ("[strategy-master] Rejected strategy proposal: " + $name + "\nReason: " + $reason + "\nDoc was:\n" + $doc),
      source: "strategy-master",
      metadata: {
        "domain_tag": "trading_research",
        "project_tag": "tournament",
        "visibility": "personal"
      }
    }')"
```

Acknowledge briefly on Telegram and move to the next proposal (if any).

---

## Step 8 — Close out

Post a **short** OB1 log summarizing the run (sources consulted, proposals sent,
accepted/rejected/timed out). Reply **one line** to the cron harness: `done` or
`failed: <reason>`.

## Rules

- Never insert a strategy without an explicit **YES** on that proposal.
- Never put indicator jargon in Ken-facing Telegram explanations.
- Never write a `doc` that violates the declarative contract (Step 4).
- If `psql` or `docker exec` fails, report the exact error to Ken and in OB1.
