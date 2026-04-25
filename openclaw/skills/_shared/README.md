# OpenClaw Model Fallback Wrapper

This folder contains launcher helpers that enforce model routing policy for OpenClaw agent turns.

## Policy

- **Live VPS routing (2026-04-25):** `digitalocean/openai-gpt-5.4-mini` primary, `ollama/qwen2.5:0.5b` first fallback, `ollama/llama3.2-1b-16k:latest` second fallback.
- **Gateway / Telegram (Cortex):** Prefer **DigitalOcean Serverless Inference** as the cloud primary, using OpenClaw's OpenAI-compatible provider config (`baseUrl: https://inference.do-ai.run/v1`, `api: openai-completions`, key from `DIGITALOCEAN_MODEL_ACCESS_KEY`). The current default is DigitalOcean's `openai-gpt-5.4-mini` model so Cortex stays off Anthropic while preserving the DO route. Keep small local Ollama models as degraded fallbacks on the 4GB VPS.
- **Cron / scripted runs:** **`model-fallback-runner.sh`** uses **Ollama-only** fallback by default — override **`OPENCLAW_FALLBACK_MODEL`** if you add another provider to scripted runs.
- Cooldown: 60 seconds after a primary rate-limit before trying primary again

**Why not plain `llama3.2`?** OpenClaw’s gateway/embedded path requires an Ollama model whose context window is at least **16000** tokens. Stock `llama3.2` is often **2048**, which produces `FailoverError: Model context window too small` and Telegram’s generic failure message.

## Gemma 4 on Ollama (Google partnership)

- **Pull:** `ollama pull gemma4:e2b` (smallest **edge** build in the library; ~**7.2 GB**). **Requires a recent Ollama** (e.g. **≥0.20** — **0.18** returns **412** on pull).
- **OpenClaw:** Register **`ollama/gemma4:e2b`** under **`models.providers.ollama.models`** with **`contextWindow`: 131072** (or rely on Ollama’s reported length) — **no Modelfile** needed for the 16k minimum.
- **RAM:** The **4GB** brain VPS is **too small** for **`gemma4:e2b`** in practice: Ollama reported **~7.3 GiB** required vs **~3.9 GiB** available on a live **`/api/generate`** probe (**2026-04-07**). Use Gemma 4 when the host has **~8GB+ RAM** (or Ollama runs on a larger machine). Until then, **`llama3.2-1b-16k`** remains the realistic local fallback if it fits.

## Ollama models on the VPS (one-time)

After `rsync` of this repo to `~/brain/openclaw/`:

**0.5B Qwen primary** (current live default on the 4GB VPS):

```bash
ollama pull qwen2.5:0.5b
```

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

Register custom Ollama ids under **`models.providers.ollama.models`** when using merge mode, then **`systemctl --user restart openclaw-gateway`**.

Current live tuning on the VPS:

- `qwen2.5:0.5b` is kept warm via Ollama systemd keepalive
- OpenClaw keeps local Telegram fallbacks at **16k+ effective context** so the gateway does not reject them before inference
- Bootstrap and compaction limits are tightened to reduce local-model timeout risk on the VPS CPU

Verify:

```bash
curl -sf http://127.0.0.1:11434/api/show -d '{"name":"qwen2.5:0.5b"}' | jq '.model_info["qwen2.context_length"]'
curl -sf http://127.0.0.1:11434/api/show -d '{"name":"llama3.2-16k:latest"}' | jq '.model_info["llama.context_length"], .parameters'
curl -sf http://127.0.0.1:11434/api/show -d '{"name":"llama3.2-1b-16k:latest"}' | jq '.model_info["llama.context_length"], .parameters'
```

You should see Qwen report **32768** and the custom Llama variants report **16384** (or equivalent in `parameters`).

## Cortex / Telegram (gateway) fallback

The wrapper only affects commands it wraps (e.g. strategy-master cron). For **Telegram**, the live VPS routing is currently maintained directly in **`~/.openclaw/openclaw.json`** with a DigitalOcean-first chain:

1. `digitalocean/openai-gpt-5.4-mini`
2. `ollama/qwen2.5:0.5b`
3. `ollama/llama3.2-1b-16k:latest`

If Telegram starts timing out again, first inspect prompt size / compaction and the DigitalOcean response status before reintroducing Groq. The recent failure mode on the VPS was not provider unavailability alone; it was large Telegram sessions causing local timeouts, Groq TPM rejection, and then Gemini quota errors in sequence.

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
- a model list including `qwen2.5:0.5b`
- a model name starting with `llama3.2-1b-16k`

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
