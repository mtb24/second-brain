---
name: adventure-photo
description: When Ken sends a photo to Cortex on Telegram, upload it to Backblaze B2 under adventures/<category>/ (HEIC is converted to JPEG on the VPS), regenerate adventureManifest.files.json, rebuild personal-site Docker, and confirm with the public B2 URL.
user-invocable: true
metadata: {"openclaw":{"emoji":"🏔️"}}
---

# Adventure photo (Telegram → B2 → kendowney.com)

Ken’s **Adventures** page reads image lists from `~/brain/personal-site/app/data/adventureManifest.files.json`. Files live in B2 bucket **`kendowney-assets`** at keys **`adventures/<category>/<filename>`**. Public base URL (matches `adventureManifest.ts` default):

`https://f004.backblazeb2.com/file/kendowney-assets/adventures`

Run this workflow on the **VPS** (`brain` user) only — paths and Docker assume `~/brain`.

---

## Skill rules

1. **Photo with no category** — Reply: *“Adventure photo? Which category? (cycling, off-road-moto, outdoors, or type a new one)”* and wait for the next message with the category slug.
2. **Photo with caption** — Treat the **caption text** (trimmed) as the category slug (e.g. caption `baja-racing` → category `baja-racing`). Normalize: lowercase, trim, collapse internal whitespace to single spaces, then replace spaces with `-`. Allow `a-z`, `0-9`, and `-` only; strip or replace other characters.
3. **New categories** — Allowed. Create `adventures/<new-slug>/` implicitly by uploading there.
4. **HEIC / HEIF** — If the download is HEIC (iPhone Telegram uploads), convert to **JPEG** on the VPS with `heif-convert` (install `libheif-examples` if needed). Upload **only** the `.jpg` to B2. Ken does not need to choose a format.
5. **Confirmation** — After upload + manifest + **Docker rebuild**, send:
   - Category name
   - **Full B2 file URL** (path-segment encode slug and filename like the site does — spaces, parens, etc.)
   - That **personal-site was rebuilt** so the Adventures page should show the new photo live (no separate manual “deploy” step for Ken unless something failed).

---

## Constants

| Item | Value |
|------|--------|
| Brain root | `~/brain` |
| Manifest path | `~/brain/personal-site/app/data/adventureManifest.files.json` |
| B2 bucket | `kendowney-assets` |
| B2 key prefix | `adventures/<category>/<filename>` |
| Telegram user (Ken) | `7221971575` (same as `TELEGRAM_TARGET` in `~/brain/.env` when set) |
| Example categories | `cycling`, `off-road-moto`, `outdoors` |

---

## Step 1 — Resolve category and photo source

- From the **Telegram message**: largest photo → `file_id` (Bot API: last element of `photo` array has highest resolution).
- **Category**: caption on the same message if present and non-empty; else use Ken’s **following** reply as the slug (apply normalization above).

If `file_id` is missing (e.g. only text), ask Ken to resend as a photo.

---

## Step 2 — Download image to a temp file (and HEIC → JPEG)

Use the **Telegram Bot API** (same bot token OpenClaw uses for Telegram — read from OpenClaw config / gateway env; **never** print the token).

```bash
TMP="$(mktemp -t adventure-XXXXXX)"
JPG_OUT=""
cleanup_adventure_tmp() { rm -f "$TMP" "$JPG_OUT" 2>/dev/null; }
trap cleanup_adventure_tmp EXIT

# Set TOKEN from your Telegram channel credentials (OpenClaw / ~/.openclaw — do not echo).
# FILE_ID from the message (largest photo).

META=$(curl -sS "https://api.telegram.org/bot${TOKEN}/getFile?file_id=${FILE_ID}")
FILE_PATH=$(echo "$META" | jq -r '.result.file_path // empty')
if [[ -z "$FILE_PATH" || "$FILE_PATH" == "null" ]]; then
  echo "getFile failed: $META" >&2
  exit 1
fi

curl -sS -o "$TMP" "https://api.telegram.org/file/bot${TOKEN}/${FILE_PATH}"

# FILENAME for B2: basename only; no path segments; no leading dot.
FILENAME=$(basename "$FILE_PATH")
[[ -z "$FILENAME" || "$FILENAME" == "." || "$FILENAME" == ".." ]] && FILENAME="telegram-$(date -u +%Y%m%dT%H%M%SZ).bin"
[[ "$FILENAME" =~ ^\. ]] && FILENAME="telegram-$(date -u +%Y%m%dT%H%M%SZ)${FILENAME}"

# HEIC / HEIF → JPEG (silent). Check bytes, not only extension — Telegram may use .jpg for HEIC.
MIME=$(file -b --mime-type "$TMP" 2>/dev/null || true)
HEIC=0
case "${FILENAME,,}" in
  *.heic) HEIC=1 ;;
esac
if [[ "$MIME" == *heif* ]] || [[ "$MIME" == *heic* ]]; then
  HEIC=1
fi

if [[ "$HEIC" -eq 1 ]]; then
  if ! command -v heif-convert >/dev/null 2>&1; then
    # Same as: which heif-convert || sudo apt-get install -y libheif-examples
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libheif-examples >/dev/null 2>&1
  fi
  JPG_OUT="$(mktemp -t adventure-jpg-XXXXXX).jpg"
  heif-convert "$TMP" "$JPG_OUT" >/dev/null 2>&1 || { echo "heif-convert failed" >&2; exit 1; }
  rm -f "$TMP"
  TMP="$JPG_OUT"
  base="${FILENAME%.*}"
  [[ -z "$base" ]] && base="telegram-$(date -u +%Y%m%dT%H%M%SZ)"
  FILENAME="${base}.jpg"
fi
```

If the file was already JPEG/PNG/WebP, `FILENAME` stays as above. **Never** upload `.heic` to B2.

---

## Step 3 — Authorize B2 and upload

Load keys from `~/brain/.env` (same pattern as other automation):

```bash
export B2_APPLICATION_KEY_ID=$(grep '^B2_KEY_ID=' ~/brain/.env | cut -d= -f2-)
export B2_APPLICATION_KEY=$(grep '^B2_APP_KEY=' ~/brain/.env | cut -d= -f2-)
b2 account authorize "$B2_APPLICATION_KEY_ID" "$B2_APPLICATION_KEY"
```

**Category** shell variable: `CATEGORY` (normalized slug). **Remote key:** `adventures/${CATEGORY}/${FILENAME}`.

```bash
BUCKET="kendowney-assets"
b2 upload-file --contentType auto "$BUCKET" "$TMP" "adventures/${CATEGORY}/${FILENAME}"
```

---

## Step 4 — Regenerate `adventureManifest.files.json` from B2

Prefer **`b2 ls --recursive --json`** so parsing is reliable (plain `ls` text format can vary).

```bash
MANIFEST="$HOME/brain/personal-site/app/data/adventureManifest.files.json"
LIST_JSON=$(mktemp)
export LIST_JSON
b2 ls --recursive --json "b2://kendowney-assets/adventures/" > "$LIST_JSON"
```

Build JSON shaped like the site expects: **`{ "<category-slug>": ["file1.jpg", ...], ... }`** — filenames are **relative to that category** (same as `adventureManifest.files.json` in git).

Use **Node** (available where personal-site builds):

```bash
node <<'NODE' > "$MANIFEST"
const fs = require('fs')
const raw = fs.readFileSync(process.env.LIST_JSON, 'utf8')
const rows = JSON.parse(raw)
const arr = Array.isArray(rows) ? rows : (rows.files || rows.fileVersions || [])
const out = {}
for (const r of arr) {
  const fn = r.fileName || r.file_name
  if (!fn || typeof fn !== 'string') continue
  if (!fn.startsWith('adventures/')) continue
  const rest = fn.slice('adventures/'.length)
  const slash = rest.indexOf('/')
  if (slash < 1) continue
  const cat = rest.slice(0, slash)
  const name = rest.slice(slash + 1)
  if (!name) continue
  if (!out[cat]) out[cat] = []
  out[cat].push(name)
}
for (const k of Object.keys(out)) {
  out[k] = [...new Set(out[k])].sort((a, b) => a.localeCompare(b))
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n')
NODE
rm -f "$LIST_JSON"
```

---

## Step 5 — Rebuild personal-site (required)

```bash
cd ~/brain && docker compose build personal-site && docker compose up -d personal-site
```

If the build fails, tell Ken the error tail from `docker compose build` / `docker compose logs personal-site` — do not claim the site updated.

---

## Step 6 — Telegram confirmation

Build the **public URL** (encode path segments):

```text
https://f004.backblazeb2.com/file/kendowney-assets/adventures/<encodeURIComponent(category)>/<encodeURIComponent(filename)>
```

Example message:

*Uploaded to **cycling** as `whiskey50.JPG`. Verify: `https://f004.backblazeb2.com/file/kendowney-assets/adventures/cycling/whiskey50.JPG` (encode path segments if the name has spaces or special characters). Regenerated manifest and rebuilt **personal-site** — Adventures should be live.*

---

## Operational notes

- **Do not** commit `adventureManifest.files.json` from this flow unless Ken asks; the VPS working copy is what Docker build uses.
- If `b2` or `docker compose` is missing, report that explicitly.
- **Idempotency:** Re-running manifest generation after upload is safe; it lists the whole `adventures/` tree.
- **Local bulk sync:** `personal-site/scripts/sync-adventures.sh` (macOS) converts staging HEIC → JPEG with **sips** before `b2 sync`; this skill covers **Telegram** uploads on the VPS with **heif-convert**.
