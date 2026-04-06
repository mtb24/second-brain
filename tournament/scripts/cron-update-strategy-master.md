# Strategy Master Cron Update (VPS)

Use these exact commands on the VPS (`brain` user) to point the OpenClaw cron job to the fallback-aware script flow.

## 1) Sync updated files from local repo

```bash
rsync -av --delete --exclude='node_modules' --exclude='.git' \
  /Users/kendowney/Sites/SecondBrain/tournament/ \
  brain@147.182.240.24:~/brain/tournament/

rsync -av --delete --exclude='node_modules' --exclude='.git' \
  /Users/kendowney/Sites/SecondBrain/openclaw/ \
  brain@147.182.240.24:~/brain/openclaw/
```

## 1b) Copy strategy-master into the live OpenClaw workspace

Cortex reads skills from **`~/.openclaw/workspace/skills/`**, not from **`~/brain/openclaw/`**. After changing **`openclaw/skills/strategy-master/`** in git, sync the runtime copy:

```bash
rsync -av \
  /Users/kendowney/Sites/SecondBrain/openclaw/skills/strategy-master/ \
  brain@147.182.240.24:~/.openclaw/workspace/skills/strategy-master/
```

Reload the gateway so loaded skill text is fresh:

```bash
ssh brain@147.182.240.24 'systemctl --user restart openclaw-gateway'
```

## 2) Ensure executables on VPS

```bash
ssh brain@147.182.240.24 "chmod +x \
  ~/brain/openclaw/skills/_shared/model-fallback-runner.sh \
  ~/brain/tournament/scripts/strategy-master-cron.sh"
```

## 3) Update the existing strategy-master cron job payload

Known job id in this environment: `c5a4596a-9cc1-4881-b982-dbc441355fa5`

```bash
ssh brain@147.182.240.24 "openclaw cron edit c5a4596a-9cc1-4881-b982-dbc441355fa5 \
  --message \"\$(cat ~/brain/tournament/scripts/openclaw-strategy-master-cron-message.txt)\""
```

## 4) Keep model override aligned with primary

```bash
ssh brain@147.182.240.24 "openclaw cron edit c5a4596a-9cc1-4881-b982-dbc441355fa5 \
  --model google/gemini-2.5-flash"
```

## 5) Dry-run once

```bash
ssh brain@147.182.240.24 "openclaw cron run c5a4596a-9cc1-4881-b982-dbc441355fa5 --expect-final --timeout 120000"
```

## 6) Verify cooldown/fallback state file (if rate-limit path occurs)

```bash
ssh brain@147.182.240.24 "cat ~/.openclaw/workspace/state/model-routing.json"
```

## Notes

- If `openclaw cron list` is flaky, rely on the known job id above and/or `~/.openclaw/cron/jobs.json`.
- This wiring intentionally avoids Anthropic in the wrapper route.
- **`~/brain/openclaw/`** holds the git mirror for scripts and shared helpers; **`~/.openclaw/workspace/skills/strategy-master/`** is what the gateway uses for the skill body — keep both in sync when **`SKILL.md`** changes.
