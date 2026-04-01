---
name: adventure-photo
description: When Ken sends a photo to Cortex on Telegram, save it under /home/brain/adventure-images/adventures/<category>/ on the VPS (HEIC→JPEG via heif-convert), regenerate adventureManifest.files.json from that tree, rebuild personal-site Docker. Nginx serves images at https://kendowney.com/images/adventures/… — no B2.
user-invocable: true
metadata: {"openclaw":{"emoji":"🏔️"}}
---

# Adventure photo (Telegram → VPS disk → kendowney.com)

Ken’s **Adventures** page reads image lists from `~/brain/personal-site/app/data/adventureManifest.files.json`. **Image files** live **on the VPS host** (not in Docker, not in git) at:

`/home/brain/adventure-images/adventures/<category>/<filename>`

**Nginx** serves them at **`https://kendowney.com/images/adventures/<category>/<filename>`** (`alias` in `/etc/nginx/sites-available/brain`). The site uses same-origin URLs built in `adventureManifest.ts` (`IMAGE_BASE` = `/images/adventures`).

Run this workflow on the **VPS** (`brain` user) only — paths assume **`~/brain`** = `/home/brain/brain/` (git checkout) and **`/home/brain/adventure-images/`** is a sibling directory on the host.

---

## Skill rules

1. **Photo with no category** — Reply: *“Adventure photo? Which category? (cycling, off-road-moto, outdoors, or type a new one)”* and wait for the next message with the category slug.
2. **Photo with caption** — Treat the **caption text** (trimmed) as the category slug. Normalize: lowercase, trim, collapse internal whitespace to single spaces, then replace spaces with `-`. Allow `a-z`, `0-9`, and `-` only; strip or replace other characters.
3. **New categories** — Allowed. `mkdir -p` the category folder under `/home/brain/adventure-images/adventures/<slug>/`.
4. **HEIC / HEIF** — If the download is HEIC, convert to **JPEG** with `heif-convert` (install **`libheif-examples`** if missing). Save **only** the `.jpg`. Ken does not choose a format.
5. **Confirmation** — After write + manifest + **Docker rebuild**, send:
   - Category name
   - **Full URL** `https://kendowney.com/images/adventures/<category>/<filename>` (encode path segments for spaces/special chars)
   - That **personal-site** was rebuilt.

**No Backblaze** — do not run `b2` for this skill.

---

## Constants

| Item | Value |
|------|--------|
| Image root (host) | `/home/brain/adventure-images/adventures/` |
| Manifest path | `$HOME/brain/personal-site/app/data/adventureManifest.files.json` |
| Regenerate manifest | `ADVENTURE_STAGING_ROOT=/home/brain/adventure-images/adventures` + `node ~/brain/personal-site/scripts/generate-adventure-manifest.mjs` |
| Public URL base | `https://kendowney.com/images/adventures` |
| Telegram user (Ken) | `7221971575` (same as `TELEGRAM_TARGET` in `~/brain/.env` when set) |

---

## Step 1 — Resolve category and photo source

- From the **Telegram message**: largest photo → `file_id` (last element of `photo` array).
- **Category**: caption on the same message if non-empty; else Ken’s **next** reply (normalized slug).

If `file_id` is missing, ask Ken to resend as a photo.

---

## Step 2 — Download image to a temp file (and HEIC → JPEG)

Use the **Telegram Bot API** (bot token from OpenClaw / gateway — **never** print the token).

```bash
TMP="$(mktemp -t adventure-XXXXXX)"
JPG_OUT=""
cleanup_adventure_tmp() { rm -f "$TMP" "$JPG_OUT" 2>/dev/null; }
trap cleanup_adventure_tmp EXIT

META=$(curl -sS "https://api.telegram.org/bot${TOKEN}/getFile?file_id=${FILE_ID}")
FILE_PATH=$(echo "$META" | jq -r '.result.file_path // empty')
if [[ -z "$FILE_PATH" || "$FILE_PATH" == "null" ]]; then
  echo "getFile failed: $META" >&2
  exit 1
fi

curl -sS -o "$TMP" "https://api.telegram.org/file/bot${TOKEN}/${FILE_PATH}"

FILENAME=$(basename "$FILE_PATH")
[[ -z "$FILENAME" || "$FILENAME" == "." || "$FILENAME" == ".." ]] && FILENAME="telegram-$(date -u +%Y%m%dT%H%M%SZ).bin"
[[ "$FILENAME" =~ ^\. ]] && FILENAME="telegram-$(date -u +%Y%m%dT%H%M%SZ)${FILENAME}"
# Reject path injection
FILENAME="${FILENAME//\//_}"

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

---

## Step 3 — Write file to the static tree

**`CATEGORY`** = normalized slug (no `/`).

```bash
DEST_DIR="/home/brain/adventure-images/adventures/${CATEGORY}"
mkdir -p "$DEST_DIR"
cp -- "$TMP" "${DEST_DIR}/${FILENAME}"
```

Requires the `brain` user to own `/home/brain/adventure-images/` (see BRAIN.md). Use `sudo` only if the tree was created root-owned by mistake.

---

## Step 3b — Optimize image on VPS

Resize to max 1600px on longest edge and compress JPEG to quality 75. This keeps
file sizes web-friendly without any quality perceptible at typical screen sizes.

```bash
FILE_PATH="${DEST_DIR}/${FILENAME}"

# Ensure ImageMagick is installed
if ! command -v convert >/dev/null 2>&1; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq imagemagick >/dev/null 2>&1
fi

# Resize only if an edge exceeds 1600px; recompress JPEG to Q=75
ext_lc=$(printf '%s' "${FILENAME##*.}" | tr '[:upper:]' '[:lower:]')
case "$ext_lc" in
  jpg|jpeg)
    convert "$FILE_PATH" -resize '1600x1600>' -quality 75 "$FILE_PATH" 2>/dev/null \
      || echo "warning: ImageMagick optimize failed for $FILE_PATH" >&2
    ;;
  png|webp)
    convert "$FILE_PATH" -resize '1600x1600>' "$FILE_PATH" 2>/dev/null \
      || echo "warning: ImageMagick resize failed for $FILE_PATH" >&2
    ;;
esac
```

GIFs are skipped (ImageMagick can break animation). If `convert` still fails after
install, log a warning and continue — the unoptimized original is already on disk.

---

## Step 4 — Regenerate `adventureManifest.files.json`

```bash
export ADVENTURE_STAGING_ROOT=/home/brain/adventure-images/adventures
node "$HOME/brain/personal-site/scripts/generate-adventure-manifest.mjs"
```

This overwrites `~/brain/personal-site/app/data/adventureManifest.files.json` from the on-disk category folders.

---

## Step 5 — Rebuild personal-site (required)

If **`~/brain/docker-compose.yml`** still defines a `personal-site` service:

```bash
cd ~/brain && docker compose build personal-site && docker compose up -d personal-site
```

Otherwise build from the synced tree (see **kendowney.com** repo `docker-compose.yml`):

```bash
cd ~/brain/personal-site && docker compose build && docker compose up -d
```

If the build fails, report the error — do not claim the site updated.

---

## Step 6 — Telegram confirmation

Example:

*Saved to **off-road-moto** as `IMG_9999.jpg`. Open: `https://kendowney.com/images/adventures/off-road-moto/IMG_9999.jpg` (encode segments if needed). Regenerated manifest and rebuilt **personal-site**.*

---

## Operational notes

- **Local bulk sync:** `~/Sites/kendowney.com/scripts/sync-adventures.sh` (macOS) — HEIC/resize with **sips**, then **rsync** to `brain@147.182.240.24:/home/brain/adventure-images/adventures/`, then **generate-adventure-manifest.mjs** locally (`npm run sync-adventures` in the **kendowney.com** repo).
- **Nginx 403:** `www-data` must traverse `/home/brain` and read files — see BRAIN.md (`chmod o+x /home/brain`, `chmod -R a+rX /home/brain/adventure-images`).
- **Do not** commit the manifest from this flow unless Ken asks; the VPS working tree + Docker image are what matter for production.
- **Idempotency:** Regenerating the manifest rescans the whole static tree.
