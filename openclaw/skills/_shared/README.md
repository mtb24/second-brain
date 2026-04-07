# OpenClaw Model Fallback Wrapper

This folder contains launcher helpers that enforce model routing policy for OpenClaw agent turns.

## Policy

- Primary model: `google/gemini-2.5-flash`
- **Gateway / Telegram (Cortex):** On a **4GB RAM** VPS, **Ollama + OpenClaw’s 16k minimum** often cannot run when Gemini fails (see **BRAIN.md** gotcha). Configure fallbacks with **`openclaw models --agent main …`** so a **cloud** model (e.g. **`anthropic/claude-3-5-haiku-20241022`**) comes **before** any **`ollama/…`** id.
- **Cron / scripted runs:** This repo’s **`model-fallback-runner.sh`** still uses **Ollama-only** fallback by default (no Anthropic) — override with env if you change policy.
- Cooldown: 60 seconds after a primary rate-limit before trying primary again

**Why not plain `llama3.2`?** OpenClaw’s gateway/embedded path requires an Ollama model whose context window is at least **16000** tokens. Stock `llama3.2` is often **2048**, which produces `FailoverError: Model context window too small` and Telegram’s generic failure message.

## Ollama models on the VPS (one-time)

After `rsync` of this repo to `~/brain/openclaw/`:

**3B + 16k context** (heavier — may OOM on 4GB):

```bash
ollama pull llama3.2
ollama create llama3.2-16k -f ~/brain/openclaw/skills/_shared/Modelfile.llama3.2-16k
```

**1B + 16k context** (recommended fallback on 4GB RAM):

```bash
ollama pull llama3.2:1b
ollama create llama3.2-1b-16k -f ~/brain/openclaw/skills/_shared/Modelfile.llama3.2-1b-16k
```

Point **`agents.defaults.model.fallbacks`** in **`~/.openclaw/openclaw.json`** at **`ollama/llama3.2-1b-16k:latest`** first; register the same id under **`models.providers.ollama.models`** with **`contextWindow`: 16384**, then **`systemctl --user restart openclaw-gateway`**.

Verify:

```bash
curl -sf http://127.0.0.1:11434/api/show -d '{"name":"llama3.2-16k:latest"}' | jq '.model_info["llama.context_length"], .parameters'
curl -sf http://127.0.0.1:11434/api/show -d '{"name":"llama3.2-1b-16k:latest"}' | jq '.model_info["llama.context_length"], .parameters'
```

You should see context **16384** (or equivalent in `parameters`).

## Cortex / Telegram (gateway) fallback

The wrapper only affects commands it wraps (e.g. strategy-master cron). For **Telegram** failover, `~/.openclaw/openclaw.json` must list the Ollama id(s) (e.g. **`ollama/llama3.2-1b-16k:latest`** first on 4GB RAM), then restart `openclaw-gateway`.

## Script

- `model-fallback-runner.sh`

It wraps any OpenClaw command and:
1. Configures primary + fallback model route
2. Executes the wrapped command
3. Detects rate-limit failures (`429`, `rate limit`, `quota exceeded`, etc.)
4. Checks Ollama reachability + model availability before local fallback
5. Retries once on local fallback
6. Notifies Ken on Telegram about fallback usage/failure

State file:
- `~/.openclaw/workspace/state/model-routing.json`

## Ollama Verification Commands

Run on the VPS:

```bash
curl -sf http://127.0.0.1:11434/api/tags | jq .
```

Expected:
- HTTP success
- a model name starting with `llama3.2-16k`

Optional service check:

```bash
systemctl is-active ollama
```

## Strategy Master Launcher

`tournament/scripts/strategy-master-cron.sh` now routes the strategy-master agent turn through this wrapper and uses a stable session id (`strategy-master-cron`) so context survives retries during fallback.

## OpenClaw Cron Wiring

Two prompt files are used intentionally:

- `tournament/scripts/openclaw-strategy-master-cron-message.txt`:
  cron payload used by OpenClaw scheduler; this now tells the cron turn to execute `strategy-master-cron.sh`.
- `tournament/scripts/strategy-master-agent-prompt.txt`:
  the real strategy-master task prompt passed by `strategy-master-cron.sh` into `openclaw agent`.

This split avoids recursive self-invocation and keeps fallback policy centralized in the wrapper script.

## Repo → VPS

Rsync **`openclaw/skills/_shared/`** to **`~/brain/openclaw/skills/_shared/`** on the VPS (same as the rest of **`~/brain/openclaw/`**). This folder is **not** an OpenClaw workspace skill — only **`../strategy-master/`** (and similar) need an extra copy under **`~/.openclaw/workspace/skills/`**; see **BRAIN.md** → OpenClaw → workspace skills, and **`tournament/scripts/cron-update-strategy-master.md`** § **1b**.
